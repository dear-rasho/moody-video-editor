// ================================================================
//  js/workspace/effectRenderer.js
//  Preview effects — filters + motion + LAYER TRANSFORM (keyframed)
//  + pixel effects.
// ================================================================

import { isIdentity } from './transformApplier.js';
import { hasAnyKeyframes, sampleAll } from './keyframeStore.js';

const CSS_ID = 'effect-renderer-styles';
let rafPending = false;
let lastCssFilter = '';
let lastMotionKey = '';
let lastTransformKey = '';

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
  document.addEventListener('playback:tick', schedule);
  document.addEventListener('editor:timeline-changed', schedule);
  document.addEventListener('effects:refresh', schedule);
  document.addEventListener('ratio:changed', schedule);
  document.addEventListener('transform:changed', schedule);
  document.addEventListener('keyframe:changed', schedule);
  schedule();
}

function schedule() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    apply();
  });
}

export function getActiveEffectLayersAt(time) {
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
      if (!clip || !clip.__effectId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) active.push({ clip, trackIndex: t });
    }
  }
  active.sort((a, b) => a.trackIndex - b.trackIndex);
  return active;
}

function findTopVideoOrImageClipAt(time) {
  const appState = getState();
  if (!appState) return null;
  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.type) continue;
      const isVideo = clip.type.indexOf('video/') === 0;
      const isImage = clip.type.indexOf('image/') === 0;
      if (!isVideo && !isImage) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) return clip;
    }
  }
  return null;
}

function apply() {
  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) return;
  const eng = window.__playbackEngine;
  const time = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
  const active = getActiveEffectLayersAt(time);

  // 1) CSS FILTERS
  let cssFilter = '';
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (!st) continue;
    if ((st.kind === 'filter' || st.kind === 'effect') && st.filters) {
      const part = buildCssFilter(st.filters);
      if (part) cssFilter = cssFilter ? cssFilter + ' ' + part : part;
    }
  }
  if (cssFilter !== lastCssFilter) {
    if (cssFilter) canvas.style.setProperty('filter', cssFilter, 'important');
    else canvas.style.removeProperty('filter');
    lastCssFilter = cssFilter;
  }

  // 2) MOTION
  let motionTransform = '';
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (!st || !st.motion) continue;
    const m = computeMotion(st.motion, time);
    if (m) motionTransform = motionTransform ? motionTransform + ' ' + m : m;
  }
  if (motionTransform !== lastMotionKey) {
    if (motionTransform) canvas.style.setProperty('transform', motionTransform, 'important');
    else canvas.style.removeProperty('transform');
    lastMotionKey = motionTransform;
  }

  // 3) LAYER TRANSFORM (keyframe-aware) → previewCanvas
  const topClip = findTopVideoOrImageClipAt(time);
  let layerXform = topClip && topClip.__transform ? topClip.__transform : null;
  if (topClip && hasAnyKeyframes(topClip)) {
    layerXform = sampleAll(topClip, time, layerXform || {});
  }

  const xformKey = layerXform && !isIdentity(layerXform) ? JSON.stringify(layerXform) : '';
  if (xformKey !== lastTransformKey) {
    lastTransformKey = xformKey;
    const preview = window.__previewCanvasInstance;
    if (preview && typeof preview.setLayerTransform === 'function') {
      preview.setLayerTransform(layerXform && !isIdentity(layerXform) ? layerXform : null);
      if (typeof preview.redraw === 'function') {
        try { preview.redraw(); } catch (_) {}
      }
    }
  }

  // 4) PIXEL EFFECTS
  const pixelEntries = [];
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (!st) continue;
    if (st.kind === 'adjustment' || st.kind === 'colorWheel' || st.kind === 'chroma') {
      pixelEntries.push(active[i]);
    }
  }
  if (!pixelEntries.length) return;

  if (eng && typeof eng.redraw === 'function') {
    try { eng.redraw(); } catch (_) {}
  }

  let ctx = null;
  try { ctx = canvas.getContext('2d', { willReadFrequently: true }); }
  catch (_) { ctx = canvas.getContext('2d'); }
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return;

  let imgData;
  try { imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
  catch (_) { return; }

  const w = canvas.width, h = canvas.height;
  const data = imgData.data;

  for (let i = 0; i < pixelEntries.length; i++) {
    const st = pixelEntries[i].clip.effectState;
    try {
      if (st.kind === 'adjustment') applyAdjustment(data, w, h, st.adjustments);
      else if (st.kind === 'colorWheel') applyColorWheel(data, w, h, st.colorWheel);
      else if (st.kind === 'chroma') applyChroma(data, w, h, st.chroma);
    } catch (e) { console.warn('effect apply error:', e); }
  }

  try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
}

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
    case 'bounce': { const s = 1 + Math.abs(Math.sin(t * 4)) * 0.12 * I; return 'scale(' + s.toFixed(3) + ')'; }
    case 'pulse': { const s = 1 + Math.sin(t * 3) * 0.08 * I; return 'scale(' + s.toFixed(3) + ')'; }
    case 'zoomPulse': { const s = 1 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.35 * I; return 'scale(' + s.toFixed(3) + ')'; }
    case 'rotate': { const a = Math.sin(t * 2) * 6 * I; return 'rotate(' + a.toFixed(2) + 'deg)'; }
    case 'glitch': {
      const dx = (Math.random() - 0.5) * 14 * I;
      const dy = (Math.random() - 0.5) * 8 * I;
      const s = 1 + (Math.random() - 0.5) * 0.03 * I;
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + s.toFixed(3) + ')';
    }
  }
  return '';
}

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
    if (shpA) { const f = 1 + shpA * 0.18; r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128; }
    if (noA) { const grain = (Math.random() - 0.5) * noA * 45; r += grain; g += grain; b += grain; }
    if (vgA) { const dx = px - cx, dy = py - cy; const d = Math.sqrt(dx * dx + dy * dy) / maxDist; const v = 1 - Math.max(0, d - 0.4) * vgA * 1.8; r *= v; g *= v; b *= v; }
    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
  }
}

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

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function applyChroma(data, w, h, c) {
  if (!c || !c.keyColor) return;
  const kr = c.keyColor.r, kg = c.keyColor.g, kb = c.keyColor.b;
  const sim = (c.similarity != null ? c.similarity : 30) / 100;
  const sm = (c.smoothness != null ? c.smoothness : 20) / 100;
  const inten = (c.intensity != null ? c.intensity : 100) / 100;
  const sp = (c.spill != null ? c.spill : 50) / 100;
  const maxDist = Math.sqrt(3 * 255 * 255) || 1;
  const simEnd = sim, softEnd = sim + sm;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / maxDist;
    let removal = 0;
    if (dist <= simEnd) removal = 1;
    else if (sm > 0 && dist <= softEnd) removal = 1 - (dist - simEnd) / sm;
    removal *= inten;
    if (removal > 0) data[i + 3] = Math.round(data[i + 3] * (1 - removal));
    if (sp > 0 && data[i + 3] > 0 && dist < softEnd + 0.15) {
      const prox = 1 - Math.min(1, dist / (softEnd + 0.15));
      const bl = sp * prox * 0.8;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = Math.round(r * (1 - bl) + gray * bl);
      data[i + 1] = Math.round(g * (1 - bl) + gray * bl);
      data[i + 2] = Math.round(b * (1 - bl) + gray * bl);
    }
  }
}