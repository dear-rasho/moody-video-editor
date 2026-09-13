// ================================================================
//  js/workspace/exportRenderer.js
//  Renders decoded frames WITH all active layers:
//    - CSS filters (brightness, contrast, sat, hue, etc.)
//    - Motion transforms (shake, bounce, pulse, glitch)
//    - Pixel effects (adjustments, colorWheel, chroma)
//    - Text overlays
//    - Sticker overlays
// ================================================================

export function renderFrameToCanvas(ctx, W, H, source, sourceTime, timelineTime) {
  const appState = window.__appState;

  if (!appState) {
    drawCoverFit(ctx, source, W, H);
    return;
  }

  const visualTracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();

  // ─── 1) Collect active layers at timelineTime ─────────────
  const active = [];
  for (let t = 0; t < visualTracks.length; t++) {
    if (hidden.has(t)) continue;
    const track = visualTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (timelineTime >= s && timelineTime < s + d) {
        active.push({ clip, trackIndex: t });
        break;
      }
    }
  }

  // ─── 2) CSS filter string from effect/filter layers ───────
  let cssFilter = '';
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (!st) continue;
    if ((st.kind === 'filter' || st.kind === 'effect') && st.filters) {
      const part = buildCssFilter(st.filters);
      if (part) cssFilter = cssFilter ? cssFilter + ' ' + part : part;
    }
  }

  // ─── 3) Motion transform ──────────────────────────────────
  let motion = null;
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (st && st.motion) {
      motion = computeMotionRaw(st.motion, timelineTime);
      if (motion) break;
    }
  }

  // ─── 4) Draw base video with filter + motion ──────────────
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (cssFilter) {
    try { ctx.filter = cssFilter; } catch (_) {}
  }

  if (motion) {
    const cx = W / 2, cy = H / 2;
    ctx.translate(cx + (motion.tx || 0), cy + (motion.ty || 0));
    if (motion.rot) ctx.rotate(motion.rot * Math.PI / 180);
    if (motion.scale && motion.scale !== 1) ctx.scale(motion.scale, motion.scale);
    ctx.translate(-cx, -cy);
  }

  drawCoverFit(ctx, source, W, H);
  ctx.restore();

  try { ctx.filter = 'none'; } catch (_) {}

  // ─── 5) Pixel effects (adjustments / colorWheel / chroma) ─
  const pixelEntries = [];
  for (let i = 0; i < active.length; i++) {
    const st = active[i].clip.effectState;
    if (!st) continue;
    if (st.kind === 'adjustment' || st.kind === 'colorWheel' || st.kind === 'chroma') {
      pixelEntries.push(active[i]);
    }
  }

  if (pixelEntries.length) {
    let imgData = null;
    try { imgData = ctx.getImageData(0, 0, W, H); } catch (_) {}
    if (imgData) {
      const data = imgData.data;
      for (let i = 0; i < pixelEntries.length; i++) {
        const st = pixelEntries[i].clip.effectState;
        try {
          if (st.kind === 'adjustment') applyAdjustment(data, W, H, st.adjustments);
          else if (st.kind === 'colorWheel') applyColorWheel(data, W, H, st.colorWheel);
          else if (st.kind === 'chroma') applyChroma(data, W, H, st.chroma);
        } catch (e) { console.warn('pixel effect error:', e); }
      }
      try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
    }
  }

  // ─── 6) Text overlays (topmost wins) ──────────────────────
  let topText = null;
  let topTextTrack = -1;
  for (let i = 0; i < active.length; i++) {
    const c = active[i].clip;
    if (c.__textId && active[i].trackIndex > topTextTrack) {
      topText = c;
      topTextTrack = active[i].trackIndex;
    }
  }
  if (topText && topText.textState) {
    try { drawTextOverlay(ctx, W, H, topText.textState); }
    catch (e) { console.warn('text overlay draw failed:', e); }
  }

  // ─── 7) Stickers ──────────────────────────────────────────
  for (let i = 0; i < active.length; i++) {
    const c = active[i].clip;
    if (c.__stickerId && c.stickerState) {
      try { drawStickerOverlay(ctx, W, H, c.stickerState); }
      catch (e) { console.warn('sticker draw failed:', e); }
    }
  }
}

// ─── Cover-fit draw ───────────────────────────────────────────
function drawCoverFit(ctx, source, W, H) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (!source) return;

  const sw = source.displayWidth || source.videoWidth || source.naturalWidth || source.width;
  const sh = source.displayHeight || source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;

  const srcAR = sw / sh;
  const dstAR = W / H;
  let sx, sy, cw, ch;
  if (srcAR > dstAR) { ch = sh; cw = sh * dstAR; sx = (sw - cw) / 2; sy = 0; }
  else { cw = sw; ch = sw / dstAR; sx = 0; sy = (sh - ch) / 2; }

  try { ctx.drawImage(source, sx, sy, cw, ch, 0, 0, W, H); } catch (_) {}
}

// ─── CSS filter string builder ────────────────────────────────
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

// ─── Motion raw values ────────────────────────────────────────
function computeMotionRaw(m, time) {
  if (!m || !m.type) return null;
  const speed = m.speed || 1;
  const I = (m.intensity != null ? m.intensity : 100) / 100;
  const t = time * speed;

  switch (m.type) {
    case 'shake':
      return { tx: Math.sin(t * 37) * 6 * I, ty: Math.cos(t * 41) * 6 * I, scale: 1, rot: 0 };
    case 'bounce':
      return { tx: 0, ty: 0, scale: 1 + Math.abs(Math.sin(t * 4)) * 0.12 * I, rot: 0 };
    case 'pulse':
      return { tx: 0, ty: 0, scale: 1 + Math.sin(t * 3) * 0.08 * I, rot: 0 };
    case 'zoomPulse':
      return { tx: 0, ty: 0, scale: 1 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.35 * I, rot: 0 };
    case 'rotate':
      return { tx: 0, ty: 0, scale: 1, rot: Math.sin(t * 2) * 6 * I };
    case 'glitch':
      return {
        tx: (Math.random() - 0.5) * 14 * I,
        ty: (Math.random() - 0.5) * 8 * I,
        scale: 1 + (Math.random() - 0.5) * 0.03 * I,
        rot: 0
      };
  }
  return null;
}

// ─── Text overlay draw ────────────────────────────────────────
function drawTextOverlay(ctx, W, H, ts) {
  const content = ts.content || '';
  if (!content) return;

  const scaleFactor = W / 400;
  const fontSize = (ts.fontSize || 36) * scaleFactor;

  ctx.save();

  const font = (ts.fontStyle || 'normal') + ' ' +
               (ts.fontWeight || 'normal') + ' ' +
               fontSize + 'px "' + (ts.fontFamily || 'Arial') + '", sans-serif';
  ctx.font = font;
  ctx.textAlign = ts.alignment || 'center';
  ctx.textBaseline = 'middle';

  const x = W * ((ts.positionX != null ? ts.positionX : 50) / 100);
  const y = H * ((ts.positionY != null ? ts.positionY : 50) / 100);

  ctx.translate(x, y);
  if (ts.rotation) ctx.rotate(ts.rotation * Math.PI / 180);
  const scale = (ts.scale != null ? ts.scale : 100) / 100;
  if (scale !== 1) ctx.scale(scale, scale);

  ctx.globalAlpha = (ts.opacity != null ? ts.opacity : 100) / 100;

  if (ts.shadowEnabled) {
    ctx.shadowColor = ts.shadowColor || '#000';
    ctx.shadowBlur = (ts.shadowBlur || 0) * scaleFactor;
    ctx.shadowOffsetX = (ts.shadowOffsetX || 0) * scaleFactor;
    ctx.shadowOffsetY = (ts.shadowOffsetY || 0) * scaleFactor;
  }

  if (ts.strokeWidth && ts.strokeWidth > 0) {
    ctx.strokeStyle = ts.strokeColor || '#000';
    ctx.lineWidth = ts.strokeWidth * scaleFactor * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    try { ctx.strokeText(content, 0, 0); } catch (_) {}
  }

  if (ts.gradientEnabled) {
    const angleRad = ((ts.gradientAngle || 90) * Math.PI) / 180;
    const halfW = (content.length * fontSize * 0.3);
    const gx = Math.cos(angleRad) * halfW;
    const gy = Math.sin(angleRad) * halfW;
    try {
      const grad = ctx.createLinearGradient(-gx, -gy, gx, gy);
      grad.addColorStop(0, ts.gradientColor1 || '#ff0066');
      grad.addColorStop(1, ts.gradientColor2 || '#0066ff');
      ctx.fillStyle = grad;
    } catch (_) {
      ctx.fillStyle = ts.color || '#fff';
    }
  } else {
    ctx.fillStyle = ts.color || '#fff';
  }

  try { ctx.fillText(content, 0, 0); } catch (_) {}

  ctx.restore();
}

// ─── Sticker overlay draw ─────────────────────────────────────
function drawStickerOverlay(ctx, W, H, s) {
  if (!s || !s.emoji) return;

  const scaleFactor = W / 400;
  const baseFontSize = 96 * scaleFactor;
  const fontSize = baseFontSize * ((s.scale != null ? s.scale : 100) / 100);

  ctx.save();
  const x = W * ((s.x != null ? s.x : 50) / 100);
  const y = H * ((s.y != null ? s.y : 50) / 100);

  ctx.translate(x, y);
  if (s.rotation) ctx.rotate(s.rotation * Math.PI / 180);

  ctx.font = fontSize + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.fillText(s.emoji, 0, 0); } catch (_) {}
  ctx.restore();
}

// ─── Adjustment pixel processor ───────────────────────────────
function applyAdjustment(data, w, h, s) {
  if (!s) return;
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

  const brightnessAmt  = (s.brightness  || 0) / 100;
  const contrastAmt    = (s.contrast    || 0) / 100;
  const exposureAmt    = Math.pow(2, (s.exposure || 0) / 100);
  const whitesAmt      = (s.whites      || 0) / 100;
  const blacksAmt      = (s.blacks      || 0) / 100;
  const shadowsAmt     = (s.shadows     || 0) / 100;
  const highlightsAmt  = (s.highlights  || 0) / 100;
  const clarityAmt     = (s.clarity     || 0) / 100;
  const saturationAmt  = (s.saturation  || 0) / 100;
  const vibranceAmt    = (s.vibrance    || 0) / 100;
  const temperatureAmt = (s.temperature || 0) / 100;
  const tintAmt        = (s.tint        || 0) / 100;
  const noiseAmt       = (s.noise       || 0) / 100;
  const sharpenAmt     = (s.sharpen     || 0) / 100;
  const vignetteAmt    = (s.vignette    || 0) / 100;

  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const idx = i / 4;
    const px = idx % w;
    const py = (idx - px) / w;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (brightnessAmt) { const a = brightnessAmt * 110; r += a; g += a; b += a; }
    if (exposureAmt !== 1) { r *= exposureAmt; g *= exposureAmt; b *= exposureAmt; }
    if (contrastAmt) {
      const f = 1 + contrastAmt;
      r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128;
    }
    if (whitesAmt) { const wt = Math.max(0, (lum - 128) / 127); const a = whitesAmt * wt * 110; r += a; g += a; b += a; }
    if (blacksAmt) { const wt = Math.max(0, (128 - lum) / 128); const a = -blacksAmt * wt * 110; r += a; g += a; b += a; }
    if (shadowsAmt) { const wt = Math.max(0, (128 - lum) / 128); const a = shadowsAmt * wt * 90; r += a; g += a; b += a; }
    if (highlightsAmt) { const wt = Math.max(0, (lum - 128) / 127); const a = highlightsAmt * wt * 90; r += a; g += a; b += a; }
    if (clarityAmt) {
      const wt = 1 - Math.abs(lum - 128) / 128;
      const f = 1 + clarityAmt * wt * 0.7;
      r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128;
    }
    if (saturationAmt) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const f = 1 + saturationAmt;
      r = gray + (r - gray) * f; g = gray + (g - gray) * f; b = gray + (b - gray) * f;
    }
    if (vibranceAmt) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = (mx - mn) / 255;
      const boost = vibranceAmt * (1 - sat) * 0.9;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * (1 + boost);
      g = gray + (g - gray) * (1 + boost);
      b = gray + (b - gray) * (1 + boost);
    }
    if (temperatureAmt) { r += temperatureAmt * 35; b -= temperatureAmt * 35; }
    if (tintAmt) { g -= tintAmt * 28; r += tintAmt * 12; b += tintAmt * 12; }

    r = clamp(r); g = clamp(g); b = clamp(b);

    if (sharpenAmt) {
      const f = 1 + sharpenAmt * 0.18;
      r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128;
    }
    if (noiseAmt) {
      const grain = (Math.random() - 0.5) * noiseAmt * 45;
      r += grain; g += grain; b += grain;
    }
    if (vignetteAmt) {
      const dx = px - cx, dy = py - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const v = 1 - Math.max(0, d - 0.4) * vignetteAmt * 1.8;
      r *= v; g *= v; b *= v;
    }

    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
  }
}

// ─── Color Wheel pixel processor ──────────────────────────────
function applyColorWheel(data, w, h, cw) {
  if (!cw) return;
  const tones = cw.tones || {};
  const hdr = (cw.hdrWhite != null ? cw.hdrWhite : 100) / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    if (hdr > 1) {
      const boost = (hdr - 1) * 100;
      r = Math.min(255, r + boost);
      g = Math.min(255, g + boost);
      b = Math.min(255, b + boost);
    }

    const brightness = (r + g + b) / 3 / 255;

    if (tones.shadows && tones.shadows.intensity > 0) {
      const wt = Math.max(0, 1 - brightness * 2);
      if (wt > 0) {
        const rgb = hslToRgb(tones.shadows.h, tones.shadows.s, 50);
        const blend = wt * (tones.shadows.intensity / 100) * 0.5;
        r += (rgb[0] - r) * blend; g += (rgb[1] - g) * blend; b += (rgb[2] - b) * blend;
      }
    }
    if (tones.midtones && tones.midtones.intensity > 0) {
      const wt = 1 - Math.abs(brightness - 0.5) * 2;
      if (wt > 0) {
        const rgb = hslToRgb(tones.midtones.h, tones.midtones.s, 50);
        const blend = wt * (tones.midtones.intensity / 100) * 0.5;
        r += (rgb[0] - r) * blend; g += (rgb[1] - g) * blend; b += (rgb[2] - b) * blend;
      }
    }
    if (tones.highlights && tones.highlights.intensity > 0) {
      const wt = Math.max(0, brightness * 2 - 1);
      if (wt > 0) {
        const rgb = hslToRgb(tones.highlights.h, tones.highlights.s, 50);
        const blend = wt * (tones.highlights.intensity / 100) * 0.5;
        r += (rgb[0] - r) * blend; g += (rgb[1] - g) * blend; b += (rgb[2] - b) * blend;
      }
    }

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

// ─── Chroma Key pixel processor ───────────────────────────────
function applyChroma(data, w, h, c) {
  if (!c || !c.keyColor) return;
  const kr = c.keyColor.r, kg = c.keyColor.g, kb = c.keyColor.b;
  const similarity = (c.similarity != null ? c.similarity : 30) / 100;
  const smoothness = (c.smoothness != null ? c.smoothness : 20) / 100;
  const intensity  = (c.intensity  != null ? c.intensity  : 100) / 100;
  const spillAmt   = (c.spill      != null ? c.spill      : 50) / 100;
  const maxDist = Math.sqrt(3 * 255 * 255) || 1;
  const simEnd = similarity;
  const softEnd = similarity + smoothness;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / maxDist;

    let removal = 0;
    if (dist <= simEnd) removal = 1;
    else if (smoothness > 0 && dist <= softEnd) removal = 1 - (dist - simEnd) / smoothness;
    removal *= intensity;

    if (removal > 0) data[i + 3] = Math.round(data[i + 3] * (1 - removal));

    if (spillAmt > 0 && data[i + 3] > 0 && dist < softEnd + 0.15) {
      const prox = 1 - Math.min(1, dist / (softEnd + 0.15));
      const blend = spillAmt * prox * 0.8;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i]     = Math.round(r * (1 - blend) + gray * blend);
      data[i + 1] = Math.round(g * (1 - blend) + gray * blend);
      data[i + 2] = Math.round(b * (1 - blend) + gray * blend);
    }
  }
}