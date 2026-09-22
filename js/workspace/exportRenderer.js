// ================================================================
//  js/workspace/exportRenderer.js
//  Export frames — hierarchy-aware, multi-layer, stacked motion.
//
//  Features:
//   - All lower layers draw (videos + images)
//   - Chroma on top clip via temp canvas (alpha composite)
//   - Multiple motion effects COMBINED into one transform
//   - CSS filters from effect/filter layers
//   - Pixel effects: adjustment, colorWheel
//   - Text + sticker overlays
// ================================================================

import { hasAnyKeyframes, sampleAll } from './keyframeStore.js';
import { isTransitionActive, getTransitionProgress, renderTransitionBlend } from './transitionEngine.js';
import { drawOverlay } from './overlayRenderer.js';

// ═══════════════════════════════════════════════════════════════
//  IMAGE CACHE
// ═══════════════════════════════════════════════════════════════
const _imageCache = new Map();

export function preloadImage(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return; }
    const cached = _imageCache.get(url);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      resolve(cached);
      return;
    }
    const img = new Image();
    img.onload = () => {
      _imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn('[export] image load failed:', String(url).slice(0, 60));
      resolve(null);
    };
    _imageCache.set(url, img);
    img.src = url;
  });
}

export async function preloadAllImages() {
  const appState = window.__appState;
  if (!appState) return;
  const urls = new Set();
  const allTracks = []
    .concat(appState.timeline.visual || [])
    .concat(appState.timeline.audio || []);
  for (let i = 0; i < allTracks.length; i++) {
    const track = allTracks[i];
    if (!Array.isArray(track)) continue;
    for (let j = 0; j < track.length; j++) {
      const clip = track[j];
      if (clip && clip.type && clip.type.indexOf('image/') === 0 && clip.url) {
        urls.add(clip.url);
      }
    }
  }
  if (urls.size === 0) return;
  console.log('[export] preloading', urls.size, 'image(s)');
  await Promise.all([...urls].map(u => preloadImage(u)));
  console.log('[export] preload done');
}

function getImageSync(url) {
  const img = _imageCache.get(url);
  if (!img) return null;
  if (!img.complete || img.naturalWidth === 0) return null;
  return img;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════
export function renderFrameToCanvas(ctx, W, H, source, sourceTime, timelineTime, prevFrameCanvas) {
  const appState = window.__appState;
  if (!appState) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (source) drawVideoContainFit(ctx, source, W, H, null);
    return;
  }

  const active = getActiveVisualClipsAt(appState, timelineTime);

  // ═══════════════════════════════════════════════════════════
  //  Find top display clip (video/image)
  // ═══════════════════════════════════════════════════════════
  let topDisplayTrack = -1;
  let topDisplayClip = null;
  for (let i = active.length - 1; i >= 0; i--) {
    const c = active[i].clip;
    if (!c || !c.type) continue;
    const isV = c.type.indexOf('video/') === 0;
    const isI = c.type.indexOf('image/') === 0;
    if (isV || isI) {
      topDisplayTrack = active[i].trackIndex;
      topDisplayClip = c;
      break;
    }
  }

  // Effects above top display track
  const effects = [];
  if (topDisplayTrack >= 0) {
    for (let i = 0; i < active.length; i++) {
      const e = active[i];
      if (e.clip.__effectId && e.trackIndex > topDisplayTrack) effects.push(e);
    }
  }

  // CSS filter from effect/filter layers
  let cssFilter = '';
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (!st) continue;
    if ((st.kind === 'filter' || st.kind === 'effect') && st.filters) {
      const part = buildCssFilter(st.filters);
      if (part) cssFilter = cssFilter ? cssFilter + ' ' + part : part;
    }
  }

  // 🆕 COMBINE all motions (no break!)
  const motionList = [];
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (st && st.motion) {
      const m = computeMotionRaw(st.motion, timelineTime);
      if (m) motionList.push(m);
    }
  }
  const motion = combineMotions(motionList);

  // Top clip transform (+ keyframes)
  let layerXform = topDisplayClip && topDisplayClip.__transform
    ? topDisplayClip.__transform
    : null;
  if (topDisplayClip && hasAnyKeyframes(topDisplayClip)) {
    layerXform = sampleAll(topDisplayClip, timelineTime, layerXform || {});
  }

  // ═══════════════════════════════════════════════════════════
  //  Collect ALL active display clips (video/image)
  // ═══════════════════════════════════════════════════════════
  const allDisplayClips = [];
  for (let i = 0; i < active.length; i++) {
    const ac = active[i].clip;
    if (!ac || !ac.type) continue;
    const isV = ac.type.indexOf('video/') === 0;
    const isI = ac.type.indexOf('image/') === 0;
    if (isV || isI) allDisplayClips.push({ clip: ac, trackIndex: active[i].trackIndex });
  }
  allDisplayClips.sort((a, b) => a.trackIndex - b.trackIndex);

  // Chroma config for TOP clip
  let topChromaCfg = null;
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (st && st.kind === 'chroma' && st.chroma) topChromaCfg = st.chroma;
  }
  if (topDisplayClip && topDisplayClip.__grading && topDisplayClip.__grading.chroma) {
    topChromaCfg = topDisplayClip.__grading.chroma;
  }

  // Clear + black
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // ═══════════════════════════════════════════════════════════
  //  Draw LOWER layers (all except top)
  // ═══════════════════════════════════════════════════════════
  for (let i = 0; i < allDisplayClips.length - 1; i++) {
    const dc = allDisplayClips[i];
    const lc = dc.clip;
    let lsrc = null;

    if (lc.type.indexOf('image/') === 0) {
      lsrc = getImageSync(lc.url);
      if (!lsrc) {
        console.warn('[export] lower image not cached:', (lc.name || '').slice(0, 30));
        continue;
      }
    } else if (lc.type.indexOf('video/') === 0) {
      // Use decoded frame for lower videos
      if (source) lsrc = source;
      else continue;
    }

    if (!lsrc) continue;

    ctx.save();
    const lxf = lc.__transform || null;
    if (lxf) applyLayerTransform(ctx, W, H, lxf);
    drawVideoContainFit(ctx, lsrc, W, H, lxf);
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  Draw TOP layer (with chroma / transition / motion / filter)
  // ═══════════════════════════════════════════════════════════
  function drawCurrentFrame(c, w, h) {
    c.save();

    // CSS filter
    if (cssFilter) { try { c.filter = cssFilter; } catch (_) {} }

    // Combined motion
    if (motion) {
      const cx = w / 2, cy = h / 2;
      c.translate(cx + (motion.tx || 0), cy + (motion.ty || 0));
      if (motion.rot) c.rotate(motion.rot * Math.PI / 180);
      if (motion.scale && motion.scale !== 1) c.scale(motion.scale, motion.scale);
      c.translate(-cx, -cy);
    }

    // Layer transform
    if (layerXform) applyLayerTransform(c, w, h, layerXform);

    // Source
    let drawSource = null;
    if (topDisplayClip) {
      const t = topDisplayClip.type || '';
      if (t.indexOf('image/') === 0) {
        drawSource = getImageSync(topDisplayClip.url);
        if (!drawSource) console.warn('[export] TOP image not cached:', (topDisplayClip.name || '').slice(0, 30));
      } else if (t.indexOf('video/') === 0) {
        drawSource = source;
      }
    }

    // Chroma via temp canvas (preserves alpha)
    if (topChromaCfg && drawSource) {
      const tc = document.createElement('canvas');
      tc.width = w;
      tc.height = h;
      const tctx = tc.getContext('2d', { willReadFrequently: true });
      drawVideoContainFit(tctx, drawSource, w, h, layerXform);
      try {
        const id = tctx.getImageData(0, 0, w, h);
        applyChromaToData(id.data, w, h, topChromaCfg);
        tctx.putImageData(id, 0, 0);
      } catch (_) {}
      c.drawImage(tc, 0, 0);
    } else {
      drawVideoContainFit(c, drawSource, w, h, layerXform);
    }

    c.restore();
    try { c.filter = 'none'; } catch (_) {}
  }

  // Transition
  const transitioning = topDisplayClip && isTransitionActive(topDisplayClip, timelineTime);
  if (transitioning && prevFrameCanvas) {
    const progress = getTransitionProgress(topDisplayClip, timelineTime);
    const type = topDisplayClip.__transitionIn.key;
    renderTransitionBlend(ctx, W, H, prevFrameCanvas, drawCurrentFrame, progress, type);
  } else {
    drawCurrentFrame(ctx, W, H);
  }

  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;

  // ═══════════════════════════════════════════════════════════
  //  Pixel effects — adjustment / colorWheel
  //  (chroma already applied above per-clip)
  // ═══════════════════════════════════════════════════════════
  const pixelEffects = [];
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (!st) continue;
    if (st.kind === 'adjustment' || st.kind === 'colorWheel') {
      pixelEffects.push(effects[i]);
    }
  }

  // Clip-attached grading
  if (topDisplayClip && topDisplayClip.__grading) {
    const g = topDisplayClip.__grading;
    if (g.adjustments && Object.keys(g.adjustments).length > 0) {
      pixelEffects.push({
        clip: { effectState: { kind: 'adjustment', adjustments: g.adjustments } }
      });
    }
    if (g.colorWheel) {
      pixelEffects.push({
        clip: { effectState: { kind: 'colorWheel', colorWheel: g.colorWheel } }
      });
    }
  }

  if (pixelEffects.length) {
    let imgData = null;
    try { imgData = ctx.getImageData(0, 0, W, H); } catch (_) {}
    if (imgData) {
      const data = imgData.data;
      for (let i = 0; i < pixelEffects.length; i++) {
        const st = pixelEffects[i].clip.effectState;
        try {
          if (st.kind === 'adjustment') applyAdjustment(data, W, H, st.adjustments);
          else if (st.kind === 'colorWheel') applyColorWheel(data, W, H, st.colorWheel);
        } catch (_) {}
      }
      try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Text overlays
  // ═══════════════════════════════════════════════════════════
  const textClips = [];
  for (let i = 0; i < active.length; i++) {
    const c = active[i].clip;
    if (c.__textId && c.textState) textClips.push({ clip: c, trackIndex: active[i].trackIndex });
  }
  textClips.sort((a, b) => a.trackIndex - b.trackIndex);
  for (let i = 0; i < textClips.length; i++) {
    try { drawTextOverlay(ctx, W, H, textClips[i].clip.textState, timelineTime, textClips[i].clip); }
    catch (_) {}
  }
  // Stickers
  for (let i = 0; i < active.length; i++) {
    const c = active[i].clip;
    if (c.__stickerId && c.stickerState) {
      try { drawStickerOverlay(ctx, W, H, c.stickerState, c, timelineTime); } catch (_) {}
    }
  }

  // 🆕 Overlay effects — draw on top
  for (let i = 0; i < effects.length; i++) {
    const st = effects[i].clip.effectState;
    if (st && st.overlay && st.overlay.type) {
      try { drawOverlay(ctx, W, H, timelineTime, st.overlay); } catch (_) {}
    }
  }
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

function getActiveVisualClipsAt(appState, time) {
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
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        active.push({ clip, trackIndex: t });
        break;
      }
    }
  }
  active.sort((a, b) => a.trackIndex - b.trackIndex);
  return active;
}

function applyLayerTransform(c, W, H, t) {
  if (!t) return;
  const aX = t.anchorX != null ? t.anchorX : 50;
  const aY = t.anchorY != null ? t.anchorY : 50;
  const pX = t.x != null ? t.x : 50;
  const pY = t.y != null ? t.y : 50;
  const ox = W * (aX / 100), oy = H * (aY / 100);
  const offX = (pX - 50) / 100 * W;
  const offY = (pY - 50) / 100 * H;
  c.translate(ox + offX, oy + offY);
  if (t.rotation) c.rotate(t.rotation * Math.PI / 180);
  const sc = (t.scale != null ? t.scale : 100) / 100;
  if (sc !== 1) c.scale(sc, sc);
  c.translate(-ox, -oy);
}

function drawVideoContainFit(ctx, source, W, H, xform) {
  if (!source) return;
  const sw = source.displayWidth || source.videoWidth || source.naturalWidth || source.width;
  const sh = source.displayHeight || source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;

  let sx = 0, sy = 0, scw = sw, sch = sh;
  if (xform) {
    const cropL = (xform.cropL || 0) / 100;
    const cropR = (xform.cropR || 0) / 100;
    const cropT = (xform.cropT || 0) / 100;
    const cropB = (xform.cropB || 0) / 100;
    if (cropL || cropR || cropT || cropB) {
      sx = sw * cropL;
      sy = sh * cropT;
      scw = sw * (1 - cropL - cropR);
      sch = sh * (1 - cropT - cropB);
    }
  }
  if (scw <= 0 || sch <= 0) return;

  const srcAR = scw / sch;
  const dstAR = W / H;
  let dw, dh;
  if (srcAR > dstAR) { dw = W; dh = W / srcAR; }
  else { dh = H; dw = H * srcAR; }
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  try { ctx.drawImage(source, sx, sy, scw, sch, dx, dy, dw, dh); } catch (_) {}
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

// ═══════════════════════════════════════════════════════════════
//  🆕 MOTION — raw + combiner
// ═══════════════════════════════════════════════════════════════
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
    case 'flicker':
      return {
        tx: (Math.random() - 0.5) * 3 * I,
        ty: (Math.random() - 0.5) * 3 * I,
        scale: 1,
        rot: 0
      };
  }
  return null;
}

function combineMotions(list) {
  if (!list || !list.length) return null;
  if (list.length === 1) return list[0];

  let tx = 0;
  let ty = 0;
  let scale = 1;
  let rot = 0;

  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m) continue;
    tx += m.tx || 0;
    ty += m.ty || 0;
    if (m.scale != null && m.scale !== 1) scale *= m.scale;
    rot += m.rot || 0;
  }

  return { tx, ty, scale, rot };
}

// ═══════════════════════════════════════════════════════════════
//  TEXT OVERLAY
// ═══════════════════════════════════════════════════════════════
function drawTextOverlay(ctx, W, H, ts, timelineTime, clip) {
  const fullContent = ts.content || '';
  if (!fullContent) return;

  let sampledX = ts.positionX != null ? ts.positionX : 50;
  let sampledY = ts.positionY != null ? ts.positionY : 50;
  let sampledScale = ts.scale != null ? ts.scale : 100;
  let sampledRot = ts.rotation || 0;

  if (clip && hasAnyKeyframes(clip)) {
    const base = { x: sampledX, y: sampledY, scale: sampledScale, rotation: sampledRot };
    const sampled = sampleAll(clip, timelineTime, base);
    sampledX = sampled.x;
    sampledY = sampled.y;
    sampledScale = sampled.scale;
    sampledRot = sampled.rotation;
  }

  const anim = ts.animation || 'none';
  const animDur = ts.animationDuration != null ? ts.animationDuration : 0.6;
  const clipStart = clip && Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const elapsed = Math.max(0, timelineTime - clipStart);
  const animState = computeTextAnimState(anim, elapsed, animDur, fullContent);
  let content = fullContent;
  if (animState.visibleChars != null) {
    content = fullContent.slice(0, animState.visibleChars);
    if (!content) return;
  }
  if (animState.opacity <= 0.001) return;

  const scaleFactor = W / 400;
  const fontSize = (ts.fontSize || 36) * scaleFactor;

  ctx.save();
  ctx.font = (ts.fontStyle || 'normal') + ' ' + (ts.fontWeight || 'normal') + ' ' +
             fontSize + 'px "' + (ts.fontFamily || 'Arial') + '", sans-serif';
  ctx.textAlign = ts.alignment || 'center';
  ctx.textBaseline = 'middle';

  const x = W * (sampledX / 100);
  const y = H * (sampledY / 100);
  ctx.translate(x + (animState.tx || 0) * scaleFactor, y + (animState.ty || 0) * scaleFactor);
  const totalRot = sampledRot + (animState.rot || 0);
  if (totalRot) ctx.rotate(totalRot * Math.PI / 180);

  const userScale = sampledScale / 100;
  const animScale = animState.scale != null ? animState.scale : 1;
  const finalScale = userScale * animScale;
  if (finalScale !== 1) ctx.scale(finalScale, finalScale);

  const userOpacity = (ts.opacity != null ? ts.opacity : 100) / 100;
  ctx.globalAlpha = userOpacity * animState.opacity;

  if (animState.blur > 0) {
    try { ctx.filter = 'blur(' + (animState.blur * scaleFactor) + 'px)'; } catch (_) {}
  }

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
    const halfW = content.length * fontSize * 0.3;
    const gx = Math.cos(angleRad) * halfW;
    const gy = Math.sin(angleRad) * halfW;
    try {
      const grad = ctx.createLinearGradient(-gx, -gy, gx, gy);
      grad.addColorStop(0, ts.gradientColor1 || '#ff0066');
      grad.addColorStop(1, ts.gradientColor2 || '#0066ff');
      ctx.fillStyle = grad;
    } catch (_) { ctx.fillStyle = ts.color || '#fff'; }
  } else {
    ctx.fillStyle = ts.color || '#fff';
  }

  try { ctx.fillText(content, 0, 0); } catch (_) {}
  ctx.restore();
  try { ctx.filter = 'none'; } catch (_) {}
}

function computeTextAnimState(anim, elapsed, dur, fullText) {
  const state = { opacity: 1, tx: 0, ty: 0, scale: 1, rot: 0, blur: 0, visibleChars: null };
  if (!anim || anim === 'none') return state;
  const p = Math.max(0, Math.min(1, elapsed / Math.max(0.1, dur)));
  switch (anim) {
    case 'fadeIn': state.opacity = p; break;
    case 'fadeUp': state.opacity = p; state.ty = (1 - p) * 24; break;
    case 'fadeDown': state.opacity = p; state.ty = (1 - p) * -24; break;
    case 'slideLeft': state.opacity = p; state.tx = (1 - p) * -80; break;
    case 'slideRight': state.opacity = p; state.tx = (1 - p) * 80; break;
    case 'slideUp': state.opacity = p; state.ty = (1 - p) * 80; break;
    case 'slideDown': state.opacity = p; state.ty = (1 - p) * -80; break;
    case 'popIn': { const eo = easeOutBack(p); state.scale = Math.max(0.01, eo); state.opacity = Math.min(1, p * 2.5); break; }
    case 'bounceIn': { const eo = easeOutBounce(p); state.scale = Math.max(0.01, eo); state.opacity = Math.min(1, p * 2.5); break; }
    case 'zoomIn': state.opacity = p; state.scale = 0.3 + 0.7 * p; break;
    case 'zoomOut': state.opacity = p; state.scale = 2 - p; break;
    case 'flip3DX':
    case 'flip3DY': { state.scale = 0.01 + 0.99 * Math.abs(Math.cos((1 - p) * Math.PI / 2)); state.opacity = Math.min(1, p * 2); break; }
    case 'rotate3D': state.rot = p * 360; break;
    case 'pulse': state.scale = 1 + Math.sin(elapsed * 3) * 0.1; break;
    case 'shake': state.tx = Math.sin(elapsed * 40) * 6; break;
    case 'wave': state.ty = Math.sin(elapsed * 6) * 8; break;
    case 'bounceWave': state.ty = -Math.abs(Math.sin(elapsed * 4)) * 18; break;
    case 'flicker': {
      const vals = [1, 0.25, 1, 0.5, 1, 0.15, 1, 0.4, 1, 0.2, 1];
      const i = Math.min(vals.length - 1, Math.floor(p * vals.length));
      state.opacity = vals[i];
      break;
    }
    case 'cinematicBlur': { const e = Math.min(1, p / 0.6); state.blur = (1 - e) * 18; state.opacity = Math.min(1, p * 1.5); break; }
    case 'glitch': { state.tx = (Math.random() - 0.5) * 6; state.ty = (Math.random() - 0.5) * 4; break; }
    case 'typewriter': state.visibleChars = Math.floor(p * fullText.length); break;
    case 'decoder': state.visibleChars = Math.min(fullText.length, Math.floor(p * fullText.length * 1.3)); break;
    case 'scribble': state.opacity = 0.2 + 0.8 * p; break;
  }
  return state;
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// ═══════════════════════════════════════════════════════════════
//  STICKER OVERLAY
// ═══════════════════════════════════════════════════════════════
function drawStickerOverlay(ctx, W, H, s, clip, timelineTime) {
  if (!s || !s.emoji) return;

  let sx = s.x != null ? s.x : 50;
  let sy = s.y != null ? s.y : 50;
  let sScale = s.scale != null ? s.scale : 100;
  let sRot = s.rotation || 0;

  if (clip && hasAnyKeyframes(clip)) {
    const base = { x: sx, y: sy, scale: sScale, rotation: sRot };
    const sampled = sampleAll(clip, timelineTime, base);
    sx = sampled.x;
    sy = sampled.y;
    sScale = sampled.scale;
    sRot = sampled.rotation;
  }

  const scaleFactor = W / 400;
  const fontSize = 96 * scaleFactor * (sScale / 100);
  ctx.save();
  const x = W * (sx / 100);
  const y = H * (sy / 100);
  ctx.translate(x, y);
  if (sRot) ctx.rotate(sRot * Math.PI / 180);
  ctx.font = fontSize + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.fillText(s.emoji, 0, 0); } catch (_) {}
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  CHROMA ON PIXEL DATA
// ═══════════════════════════════════════════════════════════════
function applyChromaToData(data, w, h, c) {
  if (!c || !c.keyColor) return;
  const kr = c.keyColor.r, kg = c.keyColor.g, kb = c.keyColor.b;
  const sim = (c.similarity != null ? c.similarity : 30) / 100;
  const sm = (c.smoothness != null ? c.smoothness : 20) / 100;
  const inten = (c.intensity != null ? c.intensity : 100) / 100;
  const sp = (c.spill != null ? c.spill : 50) / 100;
  const maxDist = Math.sqrt(3 * 255 * 255) || 1;
  const simEnd = sim;
  const softEnd = sim + sm;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
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

// ═══════════════════════════════════════════════════════════════
//  ADJUSTMENT / COLOR WHEEL — pixel ops
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

function applyAdjustment(data, w, h, s) {
  if (!s) return;
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
  const c100 = v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-100, Math.min(100, n));
  };

  const bA = c100(s.brightness) / 100, cA = c100(s.contrast) / 100;
  const eA = Math.pow(2, c100(s.exposure) / 100);
  const wA = c100(s.whites) / 100, blA = c100(s.blacks) / 100;
  const shA = c100(s.shadows) / 100, hiA = c100(s.highlights) / 100;
  const clA = c100(s.clarity) / 100, saA = c100(s.saturation) / 100;
  const viA = c100(s.vibrance) / 100, teA = c100(s.temperature) / 100;
  const tiA = c100(s.tint) / 100, noA = c100(s.noise) / 100;
  const shpA = c100(s.sharpen) / 100, vgA = c100(s.vignette) / 100;

  const colorVals = {};
  let hasColorChannels = false;
  for (let ci = 0; ci < COLOR_CHANNELS.length; ci++) {
    const ch = COLOR_CHANNELS[ci];
    const raw = c100(s[ch.key]);
    const v = raw / 100;
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

    if (hasColorChannels) {
      const hsl = rgbToHsl(r, g, b);
      const hue = hsl[0], sat = hsl[1], lightness = hsl[2];
      if (sat > 1) {
        let satMul = 1;
        let hueShift = 0;
        let lightShift = 0;
        for (let ci = 0; ci < COLOR_CHANNELS.length; ci++) {
          const ch = COLOR_CHANNELS[ci];
          const val = colorVals[ch.key];
          if (Math.abs(val) < 0.005) continue;
          const w2 = getChannelWeight(hue, ch.center, ch.range);
          if (w2 > 0.01) {
            satMul += val * w2 * 2.5;
            hueShift += val * w2 * 18;
            lightShift += val * w2 * 8;
          }
        }
        satMul = Math.max(0.05, Math.min(4, satMul));
        hueShift = Math.max(-60, Math.min(60, hueShift));
        if (Math.abs(satMul - 1) > 0.005 || Math.abs(hueShift) > 0.3 || Math.abs(lightShift) > 0.3) {
          const rgb2 = hslToRgb(hue + hueShift, sat * satMul, lightness + lightShift);
          r = rgb2[0]; g = rgb2[1]; b = rgb2[2];
        }
      }
    }

    if (shpA) { const f = 1 + shpA * 0.18; r = (r - 128) * f + 128; g = (g - 128) * f + 128; b = (b - 128) * f + 128; }
    if (noA) { const grain = (Math.random() - 0.5) * noA * 45; r += grain; g += grain; b += grain; }
    if (vgA) { const dx = px - cx, dy = py - cy; const d = Math.sqrt(dx * dx + dy * dy) / maxDist; const v = 1 - Math.max(0, d - 0.4) * vgA * 1.8; r *= v; g *= v; b *= v; }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
}

function applyColorWheel(data, w, h, cw) {
  if (!cw) return;
  const tones = cw.tones || {};
  const hdr = (cw.hdrWhite != null ? cw.hdrWhite : 100) / 100;

  const useShadows    = tones.shadows    && tones.shadows.intensity > 0 && tones.shadows.s > 0;
  const useMidtones   = tones.midtones   && tones.midtones.intensity > 0 && tones.midtones.s > 0;
  const useHighlights = tones.highlights && tones.highlights.intensity > 0 && tones.highlights.s > 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    if (hdr > 1) {
      const boost = (hdr - 1) * 127;
      r = Math.min(255, r + boost);
      g = Math.min(255, g + boost);
      b = Math.min(255, b + boost);
    }

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    let weightSum = 0;
    let targetHueSum = 0;
    let targetSatSum = 0;

    if (useShadows) {
      const tw = Math.max(0, 1 - lum * 2);
      const w2 = tw * (tones.shadows.intensity / 100);
      if (w2 > 0) {
        targetHueSum += tones.shadows.h * w2;
        targetSatSum += tones.shadows.s * w2;
        weightSum += w2;
      }
    }
    if (useMidtones) {
      const tw = Math.max(0, 1 - Math.abs(lum - 0.5) * 2);
      const w2 = tw * (tones.midtones.intensity / 100);
      if (w2 > 0) {
        targetHueSum += tones.midtones.h * w2;
        targetSatSum += tones.midtones.s * w2;
        weightSum += w2;
      }
    }
    if (useHighlights) {
      const tw = Math.max(0, lum * 2 - 1);
      const w2 = tw * (tones.highlights.intensity / 100);
      if (w2 > 0) {
        targetHueSum += tones.highlights.h * w2;
        targetSatSum += tones.highlights.s * w2;
        weightSum += w2;
      }
    }

    if (weightSum > 0.001) {
      const avgHue = ((targetHueSum / weightSum) % 360 + 360) % 360;
      const avgSat = Math.min(100, targetSatSum / weightSum);
      const strength = Math.min(1, weightSum);

      const hsl = rgbToHsl(r, g, b);
      const ph = hsl[0];
      const ps = hsl[1];
      const pl = hsl[2];

      let hDiff = avgHue - ph;
      while (hDiff > 180) hDiff -= 360;
      while (hDiff < -180) hDiff += 360;
      const newHue = ph + hDiff * strength * 0.85;

      const satMul = 1 + (avgSat / 100) * strength * 0.9;
      const newSat = Math.min(100, ps * satMul);

      const rgb2 = hslToRgb(newHue, newSat, pl);
      r = rgb2[0];
      g = rgb2[1];
      b = rgb2[2];
    }

    data[i]     = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
}