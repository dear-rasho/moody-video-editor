// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas — contain-fit + transform.
//  Supports video AND image as top display layer.
// ================================================================

import { isTransitionActive, getTransitionProgress, renderTransitionBlend } from './transitionEngine.js';

export function initPreviewCanvas({ canvas, video, empty }) {
  if (!canvas || !video) {
    return {
      setMedia() {}, clear() {}, setVisible() {}, redraw() {},
      getContext() { return null; }, setLayerTransform() {}
    };
  }

  let ctx = null;
  function getCtx() {
    if (ctx) return ctx;
    try { ctx = canvas.getContext('2d', { willReadFrequently: true }); }
    catch (_) { ctx = canvas.getContext('2d'); }
    return ctx;
  }

  function isBlocked() { return window.__previewBlockAutoDraw === true; }

  let layerTransform = null;
  function setLayerTransform(t) { layerTransform = t; }

  // 🆕 Currently loaded image (for image-only clips)
  let currentImage = null;
  let currentImageUrl = null;

  // 🆕 Prev frame buffer for transitions
  const prevFrameBuffer = document.createElement('canvas');
  let prevFrameValid = false;

  function syncCanvasSize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      prevFrameBuffer.width = w;
      prevFrameBuffer.height = h;
    }
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function captureToBuffer() {
    const bc = prevFrameBuffer.getContext('2d');
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, prevFrameBuffer.width, prevFrameBuffer.height);
    try { bc.drawImage(canvas, 0, 0); } catch (_) {}
    prevFrameValid = true;
  }

  function applyCtxTransform(c, W, H, t) {
    if (!t) return;
    const anchorX = t.anchorX != null ? t.anchorX : 50;
    const anchorY = t.anchorY != null ? t.anchorY : 50;
    const posX = t.x != null ? t.x : 50;
    const posY = t.y != null ? t.y : 50;
    const originX = W * (anchorX / 100);
    const originY = H * (anchorY / 100);
    const offsetX = (posX - 50) / 100 * W;
    const offsetY = (posY - 50) / 100 * H;
    c.translate(originX + offsetX, originY + offsetY);
    if (t.rotation) c.rotate(t.rotation * Math.PI / 180);
    const sc = (t.scale != null ? t.scale : 100) / 100;
    if (sc !== 1) c.scale(sc, sc);
    c.translate(-originX, -originY);
  }

  function containRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let w, h;
    if (srcAR > dstAR) { w = dstW; h = dstW / srcAR; }
    else { h = dstH; w = dstH * srcAR; }
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
  }
  // 🆕 Contain-fit draw (no black fill — for compositing)
function drawClipContainFit(ctx, source, W, H, xform) {
  if (!source) return;
  const sw = source.naturalWidth || source.videoWidth || source.width;
  const sh = source.naturalHeight || source.videoHeight || source.height;
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

// 🆕 Chroma on raw pixel data (reduces alpha)
function applyChromaOnData(data, w, h, c) {
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

  window.__previewContainRect = containRect;

  window.__previewDrawVideo = function (drawCtx, videoEl, canvasEl) {
    if (!drawCtx || !videoEl || !canvasEl) return;
    drawCtx.fillStyle = '#000';
    drawCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh || videoEl.readyState < 2) return;
    try {
      const r = containRect(vw, vh, canvasEl.width, canvasEl.height);
      drawCtx.drawImage(videoEl, r.x, r.y, r.w, r.h);
    } catch (_) {}
  };

  // ─── Get current top display clip ─────────────────────────
  function getCurrentClip() {
    const appState = window.__appState;
    if (!appState) return null;
    const eng = window.__playbackEngine;
    const time = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
    const tracks = appState.timeline.visual || [];
    const hidden = appState.timeline.hiddenVisualTracks || new Set();
    for (let t = tracks.length - 1; t >= 0; t--) {
      if (hidden.has(t)) continue;
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip || !clip.type) continue;
        const isV = clip.type.indexOf('video/') === 0;
        const isI = clip.type.indexOf('image/') === 0;
        if (!isV && !isI) continue;
        const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
        const d = Number.isFinite(clip.duration) ? clip.duration : 0;
        if (time >= s && time < s + d) return clip;
      }
    }
    return null;
  }

  function getTime() {
    const eng = window.__playbackEngine;
    return eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
  }

  // ─── Load image if needed ─────────────────────────────────
  function ensureImage(clip) {
    if (!clip || clip.type.indexOf('image/') !== 0) {
      currentImage = null;
      currentImageUrl = null;
      return;
    }
    if (currentImageUrl === clip.url && currentImage) return;
    currentImageUrl = clip.url;
    currentImage = new Image();
    currentImage.onload = () => {
      if (!isBlocked()) drawVideoFrame();
    };
    currentImage.src = clip.url;
  }

  // ─── Draw current display frame into ctx ─────────────────
  function drawCurrentInto(c, W, H, clip) {
    c.save();
    if (layerTransform) applyCtxTransform(c, W, H, layerTransform);

    let srcW = 0, srcH = 0;
    let isImage = false;

    if (clip && clip.type.indexOf('image/') === 0 && currentImage) {
      srcW = currentImage.naturalWidth || currentImage.width;
      srcH = currentImage.naturalHeight || currentImage.height;
      isImage = true;
    } else if (video && video.videoWidth) {
      srcW = video.videoWidth;
      srcH = video.videoHeight;
    }

    if (!srcW || !srcH) { c.restore(); return; }

    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (layerTransform) {
      const t = layerTransform;
      const cropL = (t.cropL || 0) / 100;
      const cropR = (t.cropR || 0) / 100;
      const cropT = (t.cropT || 0) / 100;
      const cropB = (t.cropB || 0) / 100;
      if (cropL || cropR || cropT || cropB) {
        sx = srcW * cropL;
        sy = srcH * cropT;
        sw = srcW * (1 - cropL - cropR);
        sh = srcH * (1 - cropT - cropB);
      }
    }
    if (sw <= 0 || sh <= 0) { c.restore(); return; }

    const r = containRect(sw, sh, W, H);

    try {
      if (isImage) {
        c.drawImage(currentImage, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
      } else {
        if (video.readyState < 2) { c.restore(); return; }
        c.drawImage(video, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
      }
    } catch (_) {}
    c.restore();
  }

  // ─── Draw video frame (main renderer) ─────────────────────
function drawVideoFrame() {
  const appState = window.__appState;
  if (!appState) {
    syncCanvasSize();
    const c = getCtx();
    if (c) { c.fillStyle = '#000'; c.fillRect(0, 0, canvas.width, canvas.height); }
    return;
  }

  const time = getTime();
  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();

  syncCanvasSize();
  const c = getCtx();
  if (!c) return;
  const W = canvas.width;
  const H = canvas.height;

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);

  // 🆕 Get all active display clips bottom → top
  const displayClips = [];
  for (let t = 0; t < tracks.length; t++) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let k = 0; k < track.length; k++) {
      const clip = track[k];
      if (!clip || !clip.type) continue;
      const isV = clip.type.indexOf('video/') === 0;
      const isI = clip.type.indexOf('image/') === 0;
      if (!isV && !isI) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        displayClips.push({ clip, trackIndex: t });
        break;
      }
    }
  }
  displayClips.sort((a, b) => a.trackIndex - b.trackIndex);

  if (!displayClips.length) {
    captureToBuffer();
    return;
  }

  // 🆕 Find chroma for TOP clip
  let topChroma = null;
  {
    const topTrack = displayClips[displayClips.length - 1].trackIndex;
    // Hierarchy effects above top
    for (let t = topTrack + 1; t < tracks.length; t++) {
      if (hidden.has(t)) continue;
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (const eff of track) {
        if (eff && eff.__effectId && eff.effectState &&
            eff.effectState.kind === 'chroma' && eff.effectState.chroma) {
          const s = Number.isFinite(eff.startTime) ? eff.startTime : 0;
          const d = Number.isFinite(eff.duration) ? eff.duration : 0;
          if (time >= s && time < s + d) topChroma = eff.effectState.chroma;
        }
      }
    }
    // Clip-attached grading
    const topClip = displayClips[displayClips.length - 1].clip;
    if (topClip.__grading && topClip.__grading.chroma) {
      topChroma = topClip.__grading.chroma;
    }
  }

  // 🆕 Draw lower clips (all except top) OPAQUE
  for (let i = 0; i < displayClips.length - 1; i++) {
    const dc = displayClips[i];
    const clip = dc.clip;
    let src = null;

    if (clip.type.indexOf('image/') === 0) {
      ensureImage(clip);
      if (currentImageUrl === clip.url && currentImage) {
        src = currentImage;
      }
    }
    // Lower video clips: only if this is the top-most video (usually not in lower)
    if (!src && clip.type.indexOf('video/') === 0) {
      if (video && video.readyState >= 2) {
        // Only if this is the CURRENT loaded video
        const curUrl = video.currentSrc || video.src || '';
        if (curUrl === clip.url) src = video;
      }
    }
    if (!src) continue;

    const xf = clip.__transform;
    c.save();
    if (xf) applyCtxTransform(c, W, H, xf);
    drawClipContainFit(c, src, W, H, xf);
    c.restore();
  }

  // 🆕 Draw top clip WITH chroma if needed
  {
    const topClip = displayClips[displayClips.length - 1].clip;
    let topSrc = null;

    if (topClip.type.indexOf('image/') === 0) {
      ensureImage(topClip);
      if (currentImageUrl === topClip.url && currentImage) {
        topSrc = currentImage;
      }
    } else if (topClip.type.indexOf('video/') === 0) {
      if (video && video.readyState >= 2) topSrc = video;
    }

    if (topSrc) {
      const xf = topClip.__transform;
      const transitioning = isTransitionActive(topClip, time);

      function drawTopFrame(cx, cw, ch) {
        cx.save();
        if (xf) applyCtxTransform(cx, cw, ch, xf);
        drawClipContainFit(cx, topSrc, cw, ch, xf);
        cx.restore();
      }

      if (topChroma) {
        // 🆕 Temp canvas approach — chroma reduces alpha → lower layers show
        const tc = document.createElement('canvas');
        tc.width = W;
        tc.height = H;
        const tctx = tc.getContext('2d', { willReadFrequently: true });

        // Draw top clip on temp with chroma
        tctx.save();
        if (xf) applyCtxTransform(tctx, W, H, xf);
        drawClipContainFit(tctx, topSrc, W, H, xf);
        tctx.restore();

        try {
          const id = tctx.getImageData(0, 0, W, H);
          applyChromaOnData(id.data, W, H, topChroma);
          tctx.putImageData(id, 0, 0);
        } catch (_) {}

        // Composite onto main canvas (source-over → alpha respected)
        c.drawImage(tc, 0, 0);
      } else if (transitioning && prevFrameValid) {
        const progress = getTransitionProgress(topClip, time);
        const type = topClip.__transitionIn.key;
        renderTransitionBlend(c, W, H, prevFrameBuffer,
          (cx, cw, ch) => drawTopFrame(cx, cw, ch), progress, type);
      } else {
        drawTopFrame(c, W, H);
      }
    }
  }

  captureToBuffer();
}

  let rafId = null;
  function startLoop() {
    if (isBlocked()) return;
    if (rafId) return;
    const loop = () => {
      drawVideoFrame();
      if (!video.paused && !video.ended) rafId = requestAnimationFrame(loop);
      else rafId = null;
    };
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function hideVideo() {
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('left', '0', 'important');
    video.style.setProperty('top', '0', 'important');
    video.style.setProperty('width', '1px', 'important');
    video.style.setProperty('height', '1px', 'important');
    video.style.setProperty('opacity', '0', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('pointer-events', 'none', 'important');
    video.style.setProperty('z-index', '-1', 'important');
  }
  hideVideo();

  function guardedDraw() { if (!isBlocked()) drawVideoFrame(); }

  video.addEventListener('loadedmetadata', guardedDraw);
  video.addEventListener('loadeddata', guardedDraw);
  video.addEventListener('seeked', guardedDraw);
  video.addEventListener('play',    () => { if (!isBlocked()) startLoop(); });
  video.addEventListener('playing', () => { if (!isBlocked()) startLoop(); });
  video.addEventListener('pause',   () => { if (isBlocked()) return; drawVideoFrame(); stopLoop(); });
  video.addEventListener('ended',   () => { if (isBlocked()) return; drawVideoFrame(); stopLoop(); });

  document.addEventListener('ratio:changed', () => { syncCanvasSize(); drawVideoFrame(); });
  document.addEventListener('keyframe:changed', () => { if (!isBlocked()) drawVideoFrame(); });
  document.addEventListener('transform:changed', () => { if (!isBlocked()) drawVideoFrame(); });
  document.addEventListener('transition:changed', () => { if (!isBlocked()) drawVideoFrame(); });
  document.addEventListener('editor:timeline-changed', () => { if (!isBlocked()) drawVideoFrame(); });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
      if (!isBlocked()) drawVideoFrame();
    }).observe(canvas.parentElement || canvas);
  }

  function setMedia(item) {
    if (!item) return;
    const type = item.type || '';
    if (empty) empty.hidden = true;

    if (type.startsWith('video/')) {
      video.src = item.url;
      video.load();
      hideVideo();
      canvas.hidden = false;
      return;
    }
    if (type.startsWith('audio/')) return;
    if (type.startsWith('image/')) {
      currentImageUrl = item.url;
      currentImage = new Image();
      currentImage.onload = () => {
        if (!isBlocked()) drawVideoFrame();
        canvas.hidden = false;
        if (empty) empty.hidden = true;
      };
      currentImage.src = item.url;
      return;
    }
  }

  function clear() {
    stopLoop();
    video.pause();
    video.removeAttribute('src');
    video.load();
    hideVideo();
    prevFrameValid = false;
    currentImage = null;
    currentImageUrl = null;
    const c = getCtx();
    if (c) c.clearRect(0, 0, canvas.width, canvas.height);
    if (empty) empty.hidden = false;
    canvas.hidden = false;
    canvas.style.visibility = '';
    canvas.style.opacity = '';
  }

  function setVisible(visible) {
    if (visible) {
      canvas.style.visibility = '';
      canvas.style.opacity = '';
    } else {
      canvas.style.visibility = 'hidden';
      canvas.style.opacity = '0';
    }
  }

  function redraw() { drawVideoFrame(); }

  syncCanvasSize();
  hideVideo();

  return {
    setMedia, clear, setVisible, redraw,
    getContext: getCtx,
    setLayerTransform
  };
}