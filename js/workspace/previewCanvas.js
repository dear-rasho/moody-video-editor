// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas — contain-fit + LIVE keyframe transform.
//  Supports video AND image as top display layer.
// ================================================================

import { isTransitionActive, getTransitionProgress, renderTransitionBlend } from './transitionEngine.js';
import { hasAnyKeyframes, sampleAll } from './keyframeStore.js';

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

  let currentImage = null;
  let currentImageUrl = null;

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

  // ═══════════════════════════════════════════════════════════════
  //  🆕 LIVE TRANSFORM SAMPLING — this is the core fix.
  //  Every frame, check if the current clip has keyframes. If yes,
  //  sample them at the current time. This makes the animation
  //  work during playback (previously transform was stale).
  // ═══════════════════════════════════════════════════════════════
  function resolveLiveTransform(clip) {
    if (!clip) return null;

    // Base transform stored on the clip
    const base = clip.__transform || {};

    // If clip has keyframes → sample at current time
    if (typeof hasAnyKeyframes === 'function' && hasAnyKeyframes(clip)) {
      const t = getTime();
      const baseCopy = Object.assign({}, base);
      try {
        const sampled = sampleAll(clip, t, baseCopy);
        return sampled;
      } catch (_) {}
    }

    // No keyframes → use base or the layerTransform set externally
    if (base && Object.keys(base).length > 0) return base;
    return layerTransform;
  }

  function drawCurrentInto(c, W, H, clip) {
    c.save();

    // 🆕 Resolve transform LIVE
    const liveTransform = resolveLiveTransform(clip);
    if (liveTransform) applyCtxTransform(c, W, H, liveTransform);

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
    if (liveTransform) {
      const t = liveTransform;
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

  function drawVideoFrame() {
    const clip = getCurrentClip();
    if (!clip) {
      syncCanvasSize();
      const c = getCtx();
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#000';
      c.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (clip.type.indexOf('image/') === 0) ensureImage(clip);

    syncCanvasSize();
    const c = getCtx();
    if (!c) return;
    const W = canvas.width;
    const H = canvas.height;

    const transitioning = isTransitionActive(clip, getTime());
    if (transitioning && prevFrameValid) {
      const progress = getTransitionProgress(clip, getTime());
      const type = clip.__transitionIn.key;
      renderTransitionBlend(c, W, H, prevFrameBuffer,
        (cx, cw, ch) => drawCurrentInto(cx, cw, ch, clip),
        progress, type);
      return;
    }

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    drawCurrentInto(c, W, H, clip);

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

  // 🆕 Also redraw on every playback tick — ensures keyframes animate
  document.addEventListener('playback:tick', () => {
    if (isBlocked()) return;
    drawVideoFrame();
  });

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