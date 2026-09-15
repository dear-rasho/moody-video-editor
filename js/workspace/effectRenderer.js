// ================================================================
//  js/workspace/effectRenderer.js
//  Visual effects on preview canvas — HIERARCHY-AWARE.
//  Rule: Effect at track Ti applies to ALL display clips BELOW it.
// ================================================================

import { isIdentity } from './transformApplier.js';
import { hasAnyKeyframes, sampleAll } from './keyframeStore.js';

const CSS_ID = 'effect-renderer-styles';

let currentLayerTransformKey = '';
let currentCssFilter = '';
let currentMotionKey = '';

function getState() { return window.__appState; }

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .clip[data-clip-type="effect/plain"] {
      background: #4c1d95 !important;
      border-color: #a78bfa !important;
      color: #fff !important;
    }
    .clip[data-clip-type="effect/plain"].selected {
      border-color: var(--accent) !important;
      box-shadow: 0 0 0 2px var(--accent) !important;
    }
  `;
  document.head.appendChild(s);
}

export function initEffectRenderer() {
  injectStyles();
  window.__applyVisualEffects = applyVisualEffects;

  document.addEventListener('editor:timeline-changed', onPausedRefresh);
  document.addEventListener('effects:refresh', onPausedRefresh);
  document.addEventListener('transform:changed', onPausedRefresh);
  document.addEventListener('keyframe:changed', onPausedRefresh);
  document.addEventListener('ratio:changed', onPausedRefresh);

  requestAnimationFrame(function () {
    const eng = window.__playbackEngine;
    const t = eng ? eng.getTime() : 0;
    applyVisualEffects(t);
  });
}

// ═══════════════════════════════════════════════════════════════
//  🆕 DEBOUNCED REFRESH
//
//  Problem: prompt se 5 layers banti hain → 7 events fire hote
//  hain → 7 RAFs scheduled → applyVisualEffects 7 baar chalti
//  hai → pixel effects COMPOUND ho jate hain → pehla look kharab
//
//  Fix: Sirf EK RAF ko chalne do, aur usme base redraw karke
//  ek hi baar effects apply karo.
// ═══════════════════════════════════════════════════════════════
let pendingRefresh = false;

function onPausedRefresh() {
  const eng = window.__playbackEngine;
  if (eng && eng.isPlaying && eng.isPlaying()) return;

  // Redraw immediately (visual feedback ke liye)
  const preview = window.__previewCanvasInstance;
  if (preview && typeof preview.redraw === 'function') {
    try { preview.redraw(); } catch (_) {}
  }

  // Agar already pending hai to skip — sirf ek hi RAF chalega
  if (pendingRefresh) return;
  pendingRefresh = true;

  requestAnimationFrame(function () {
    pendingRefresh = false;

    // Fresh base redraw karo (compounding rokne ke liye)
    const preview2 = window.__previewCanvasInstance;
    if (preview2 && typeof preview2.redraw === 'function') {
      try { preview2.redraw(); } catch (_) {}
    }

    const eng2 = window.__playbackEngine;
    const t2 = eng2 ? eng2.getTime() : 0;
    applyVisualEffects(t2);
  });
}
// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function isDisplayClip(c) {
  if (!c) return false;
  if (c.__textId) return true;
  if (c.__stickerId) return true;
  if (c.type && (c.type.indexOf('video/') === 0 || c.type.indexOf('image/') === 0)) return true;
  return false;
}

function isEffectClip(c) {
  return !!(c && c.__effectId);
}

function clipContains(clip, time) {
  const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const d = Number.isFinite(clip.duration) ? clip.duration : 0;
  return time >= s && time < s + d;
}

function getActiveVisualClips(time) {
  const appState = getState();
  if (!appState) return [];
  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();
  const active = [];

  for (let t = 0; t < tracks.length; t++) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip) continue;
      if (clipContains(clip, time)) {
        active.push({ clip, trackIndex: t });
        break;
      }
    }
  }
  active.sort((a, b) => a.trackIndex - b.trackIndex);
  return active;
}

function getTopDisplayTrackIndex(time) {
  const active = getActiveVisualClips(time);
  for (let i = active.length - 1; i >= 0; i--) {
    if (isDisplayClip(active[i].clip)) return active[i].trackIndex;
  }
  return -1;
}

function getEffectsAbove(time, trackIndex) {
  const active = getActiveVisualClips(time);
  const result = [];
  for (let i = 0; i < active.length; i++) {
    const e = active[i];
    if (!isEffectClip(e.clip)) continue;
    if (e.trackIndex > trackIndex) result.push(e);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN APPLY
// ═══════════════════════════════════════════════════════════════
function applyVisualEffects(time) {
  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) return;

  const topDisplayTrack = getTopDisplayTrackIndex(time);

  if (topDisplayTrack < 0) {
    if (currentCssFilter !== '') {
      canvas.style.removeProperty('filter');
      currentCssFilter = '';
    }
    if (currentMotionKey !== '') {
      canvas.style.removeProperty('transform');
      currentMotionKey = '';
    }
    return;
  }

  const effects = getEffectsAbove(time, topDisplayTrack);

  // 1) CSS FILTER
  let cssFilterStr = '';
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (!st) continue;
    if (st.kind === 'filter' || st.kind === 'effect') {
      const part = buildCssFilter(st.filters);
      if (part) cssFilterStr = cssFilterStr ? cssFilterStr + ' ' + part : part;
    }
  }
  if (cssFilterStr !== currentCssFilter) {
    if (cssFilterStr) canvas.style.setProperty('filter', cssFilterStr, 'important');
    else canvas.style.removeProperty('filter');
    currentCssFilter = cssFilterStr;
  }

  // 2) MOTION
  let motionStr = '';
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (!st || !st.motion) continue;
    const m = computeMotion(st.motion, time);
    if (m) motionStr = motionStr ? motionStr + ' ' + m : m;
  }
  if (motionStr !== currentMotionKey) {
    if (motionStr) canvas.style.setProperty('transform', motionStr, 'important');
    else canvas.style.removeProperty('transform');
    currentMotionKey = motionStr;
  }

  // 3) LAYER TRANSFORM — video/image ONLY
  const preview = window.__previewCanvasInstance;
  if (preview && typeof preview.setLayerTransform === 'function') {
    const active = getActiveVisualClips(time);
    let topVideoOrImageClip = null;
    for (let i = active.length - 1; i >= 0; i--) {
      const c = active[i].clip;
      if (!c || !c.type) continue;
      const isV = c.type.indexOf('video/') === 0;
      const isI = c.type.indexOf('image/') === 0;
      if (isV || isI) { topVideoOrImageClip = c; break; }
    }

    let layerXform = topVideoOrImageClip && topVideoOrImageClip.__transform
      ? topVideoOrImageClip.__transform
      : null;

    if (topVideoOrImageClip && hasAnyKeyframes(topVideoOrImageClip)) {
      layerXform = sampleAll(topVideoOrImageClip, time, layerXform || {});
    }

    const key = layerXform && !isIdentity(layerXform)
      ? JSON.stringify(layerXform)
      : '';
    if (key !== currentLayerTransformKey) {
      currentLayerTransformKey = key;
      preview.setLayerTransform(
        layerXform && !isIdentity(layerXform) ? layerXform : null
      );
      if (typeof preview.redraw === 'function') {
        try { preview.redraw(); } catch (_) {}
      }
    }
  }

  // 4) PIXEL EFFECTS
  const pixelEffects = [];
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (!st) continue;
    if (st.kind === 'adjustment' || st.kind === 'colorWheel' || st.kind === 'chroma') {
      pixelEffects.push(effects[i]);
    }
  }
  if (!pixelEffects.length) return;

  let ctx = null;
  try { ctx = canvas.getContext('2d', { willReadFrequently: true }); }
  catch (_) { ctx = canvas.getContext('2d'); }
  if (!ctx) return;
  if (canvas.width <= 0 || canvas.height <= 0) return;

  let imgData;
  try { imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
  catch (_) { return; }

  const W = canvas.width;
  const H = canvas.height;
  const data = imgData.data;

  for (let i = 0; i < pixelEffects.length; i++) {
    const st = pixelEffects[i].clip.effectState;
    try {
      if (st.kind === 'adjustment') applyAdjustment(data, W, H, st.adjustments);
      else if (st.kind === 'colorWheel') applyColorWheel(data, W, H, st.colorWheel);
      else if (st.kind === 'chroma') applyChroma(data, W, H, st.chroma);
    } catch (_) {}
  }

  try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  CSS FILTER BUILDER
// ═══════════════════════════════════════════════════════════════
function buildCssFilter(f) {
  if (!f) return '';
  const p = [];
  if (f.brightness != null && f.brightness !== 100) p.push('brightness(' + f.brightness + '%)');
  if (f.contrast != null && f.contrast !== 100) p.push('contrast(' + f.contrast + '%)');
  if (f.saturation != null && f.saturation !== 100) p.push('saturate(' + f.saturation + '%)');
  if (f.hue) p.push('hue-rotate(' + f.hue + 'deg)');
  if (f.grayscale) p.push('grayscale(' + f.grayscale + '%)');
  if (f.sepia) p.push('sepia(' + f.sepia + '%)');
  if (f.invert) p.push('invert(' + f.invert + '%)');
  if (f.blur) p.push('blur(' + f.blur + 'px)');
  if (f.opacity != null && f.opacity !== 100) p.push('opacity(' + f.opacity + '%)');
  return p.join(' ');
}

// ═══════════════════════════════════════════════════════════════
//  MOTION
// ═══════════════════════════════════════════════════════════════
function computeMotion(m, time) {
  if (!m || !m.type) return '';
  const speed = m.speed || 1;
  const I = (m.intensity != null ? m.intensity : 100) / 100;
  const t = time * speed;
  switch (m.type) {
    case 'shake': {
      const dx = Math.sin(t * 37) * 6 * I;
      const dy = Math.cos(t * 41) * 6 * I;
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
    }
    case 'bounce': {
      const s = 1 + Math.abs(Math.sin(t * 4)) * 0.12 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'pulse': {
      const s = 1 + Math.sin(t * 3) * 0.08 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'zoomPulse': {
      const s = 1 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.35 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'rotate': {
      const a = Math.sin(t * 2) * 6 * I;
      return 'rotate(' + a.toFixed(2) + 'deg)';
    }
    case 'glitch': {
      const dx = (Math.random() - 0.5) * 14 * I;
      const dy = (Math.random() - 0.5) * 8 * I;
      const s = 1 + (Math.random() - 0.5) * 0.03 * I;
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + s.toFixed(3) + ')';
    }
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
//  🆕 COLOR CHANNEL HELPERS (HSL-based)
// ═══════════════════════════════════════════════════════════════
const COLOR_CHANNELS = [
  { key: 'reds',      center: 0,   range: 30 },
  { key: 'oranges',   center: 30,  range: 30 },
  { key: 'yellows',   center: 60,  range: 30 },
  { key: 'greens',    center: 120, range: 90 },
  { key: 'cyans',     center: 180, range: 30 },
  { key: 'blues',     center: 225, range: 60 },
  { key: 'purples',   center: 270, range: 30 },
  { key: 'magentas',  center: 315, range: 60 },
  { key: 'skinTones', center: 20,  range: 25 }
];

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function getChannelWeight(hue, center, range) {
  let d = Math.abs(hue - center);
  if (d > 180) d = 360 - d;
  if (d >= range) return 0;
  return 1 - d / range;
}

// ═══════════════════════════════════════════════════════════════
//  ADJUSTMENT
// ═══════════════════════════════════════════════════════════════
function applyAdjustment(data, w, h, s) {
  if (!s) return;
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

  const bA = (s.brightness || 0) / 100, cA = (s.contrast || 0) / 100;
  const eA = Math.pow(2, (s.exposure || 0) / 100);
  const wA = (s.whites || 0) / 100, blA = (s.blacks || 0) / 100;
  const shA = (s.shadows || 0) / 100, hiA = (s.highlights || 0) / 100;
  const clA = (s.clarity || 0) / 100, saA = (s.saturation || 0) / 100;
  const viA = (s.vibrance || 0) / 100, teA = (s.temperature || 0) / 100;
  const tiA = (s.tint || 0) / 100, noA = (s.noise || 0) / 100;
  const shpA = (s.sharpen || 0) / 100, vgA = (s.vignette || 0) / 100;

  // Color channels
  const colorVals = {};
  let hasColorChannels = false;
  for (const ch of COLOR_CHANNELS) {
    const v = (s[ch.key] || 0) / 100;
    colorVals[ch.key] = v;
    if (Math.abs(v) > 0.01) hasColorChannels = true;
  }

  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const idx = i / 4, px = idx % w, py = (idx - px) / w;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (bA) { const a = bA * 110; r += a; g += a; b += a; }
    if (eA !== 1) { r *= eA; g *= eA; b *= eA; }
    if (cA) { const f = 1 + cA; r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128; }
    if (wA) { const wt = Math.max(0, (lum - 128) / 127); const a = wA * wt * 110; r += a; g += a; b += a; }
    if (blA) { const wt = Math.max(0, (128 - lum) / 128); const a = -blA * wt * 110; r += a; g += a; b += a; }
    if (shA) { const wt = Math.max(0, (128 - lum) / 128); const a = shA * wt * 90; r += a; g += a; b += a; }
    if (hiA) { const wt = Math.max(0, (lum - 128) / 127); const a = hiA * wt * 90; r += a; g += a; b += a; }
    if (clA) { const wt = 1 - Math.abs(lum - 128) / 128; const f = 1 + clA * wt * 0.7; r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128; }
    if (saA) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; const f = 1 + saA; r = gray + (r - gray) * f; g = gray + (g - gray) * f; b = gray + (b - gray) * f; }
    if (viA) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const sat = (mx - mn) / 255; const boost = viA * (1 - sat) * 0.9; const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = gray + (r - gray) * (1 + boost); g = gray + (g - gray) * (1 + boost); b = gray + (b - gray) * (1 + boost); }
    if (teA) { r += teA * 35; b -= teA * 35; }
    if (tiA) { g -= tiA * 28; r += tiA * 12; b += tiA * 12; }
    r = clamp(r); g = clamp(g); b = clamp(b);

    // Per-color-channel HSL adjustment
    if (hasColorChannels) {
      const [hue, sat, lightness] = rgbToHsl(r, g, b);
      if (sat > 2) {
        let satMul = 1;
        let hueShift = 0;
        for (const ch of COLOR_CHANNELS) {
          const val = colorVals[ch.key];
          if (Math.abs(val) < 0.01) continue;
          const w = getChannelWeight(hue, ch.center, ch.range);
          if (w > 0.01) {
            satMul += val * w * 0.8;
            hueShift += val * w * 3;
          }
        }
        if (Math.abs(satMul - 1) > 0.01 || Math.abs(hueShift) > 0.5) {
          const rgb2 = hslToRgb(hue + hueShift, sat * satMul, lightness);
          r = rgb2[0]; g = rgb2[1]; b = rgb2[2];
        }
      }
    }

    if (shpA) { const f = 1 + shpA * 0.18; r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128; }
    if (noA) { const grain = (Math.random() - 0.5) * noA * 45; r += grain; g += grain; b += grain; }
    if (vgA) { const dx = px - cx, dy = py - cy; const d = Math.sqrt(dx * dx + dy * dy) / maxDist; const v = 1 - Math.max(0, d - 0.4) * vgA * 1.8; r *= v; g *= v; b *= v; }

    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
  }
}

// ═══════════════════════════════════════════════════════════════
//  COLOR WHEEL
// ═══════════════════════════════════════════════════════════════
function applyColorWheel(data, w, h, cw) {
  if (!cw) return;
  const tones = cw.tones || {};
  const hdr = (cw.hdrWhite != null ? cw.hdrWhite : 100) / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (hdr > 1) { const boost = (hdr - 1) * 100; r = Math.min(255, r + boost); g = Math.min(255, g + boost); b = Math.min(255, b + boost); }
    const br = (r + g + b) / 3 / 255;
    if (tones.shadows && tones.shadows.intensity > 0) { const wt = Math.max(0, 1 - br * 2); if (wt > 0) { const rgb = hslToRgb(tones.shadows.h, tones.shadows.s, 50); const bl = wt * (tones.shadows.intensity / 100) * 0.5; r += (rgb[0] - r) * bl; g += (rgb[1] - g) * bl; b += (rgb[2] - b) * bl; } }
    if (tones.midtones && tones.midtones.intensity > 0) { const wt = 1 - Math.abs(br - 0.5) * 2; if (wt > 0) { const rgb = hslToRgb(tones.midtones.h, tones.midtones.s, 50); const bl = wt * (tones.midtones.intensity / 100) * 0.5; r += (rgb[0] - r) * bl; g += (rgb[1] - g) * bl; b += (rgb[2] - b) * bl; } }
    if (tones.highlights && tones.highlights.intensity > 0) { const wt = Math.max(0, br * 2 - 1); if (wt > 0) { const rgb = hslToRgb(tones.highlights.h, tones.highlights.s, 50); const bl = wt * (tones.highlights.intensity / 100) * 0.5; r += (rgb[0] - r) * bl; g += (rgb[1] - g) * bl; b += (rgb[2] - b) * bl; } }
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
}

// ═══════════════════════════════════════════════════════════════
//  CHROMA KEY
// ═══════════════════════════════════════════════════════════════
function applyChroma(data, w, h, c) {
  if (!c || !c.keyColor) return;

  const kr = c.keyColor.r;
  const kg = c.keyColor.g;
  const kb = c.keyColor.b;

  const sim = (c.similarity != null ? c.similarity : 30) / 100;
  const sm = (c.smoothness != null ? c.smoothness : 20) / 100;
  const inten = (c.intensity != null ? c.intensity : 100) / 100;
  const sp = (c.spill != null ? c.spill : 50) / 100;

  const maxDist = Math.sqrt(3 * 255 * 255) || 1;
  const simEnd = sim;
  const softEnd = sim + sm;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - kr;
    const dg = g - kg;
    const db = b - kb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / maxDist;

    let removal = 0;
    if (dist <= simEnd) removal = 1;
    else if (sm > 0 && dist <= softEnd) removal = 1 - (dist - simEnd) / sm;
    removal *= inten;

    if (removal > 0) {
      const keep = 1 - removal;
      data[i]     = Math.round(r * keep);
      data[i + 1] = Math.round(g * keep);
      data[i + 2] = Math.round(b * keep);
      data[i + 3] = Math.round(data[i + 3] * keep);
    }

    if (sp > 0 && removal < 1 && dist < softEnd + 0.15) {
      const prox = 1 - Math.min(1, dist / (softEnd + 0.15));
      const bl = sp * prox * 0.8;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i]     = Math.round(data[i]     * (1 - bl) + gray * bl);
      data[i + 1] = Math.round(data[i + 1] * (1 - bl) + gray * bl);
      data[i + 2] = Math.round(data[i + 2] * (1 - bl) + gray * bl);
    }
  }
}