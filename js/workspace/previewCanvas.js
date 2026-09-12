// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas is the display surface.
//
//  When a ratio is set (window.__offlineEditorRatio), the canvas
//  is resized to that ratio and the video is COVER-FIT into it —
//  cropping overflow so nothing outside the ratio is shown.
//
//  When ratio is "original", the canvas fills the wrap and video
//  is drawn contain-fit (letterboxed).
// ================================================================

export function initPreviewCanvas({ canvas, video, empty }) {
  if (!canvas || !video) {
    return {
      setMedia() {}, clear() {}, setVisible() {}, redraw() {}, getContext() { return null; }
    };
  }

  let ctx = null;
  function getCtx() {
    if (ctx) return ctx;
    try { ctx = canvas.getContext('2d', { willReadFrequently: true }); }
    catch (_) { ctx = canvas.getContext('2d'); }
    return ctx;
  }

  // ─── Target ratio from ratio.js ────────────────────────────
  function getTargetRatio() {
    const r = window.__offlineEditorRatio;
    if (r && Number.isFinite(r.w) && Number.isFinite(r.h) && r.w > 0 && r.h > 0) {
      return { w: r.w, h: r.h };
    }
    return null;
  }

  // ─── Size canvas based on ratio ────────────────────────────
  function syncCanvasSize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const wrapW = Math.max(1, wrapRect.width);
    const wrapH = Math.max(1, wrapRect.height);

    const ratio = getTargetRatio();

    let w, h, cssW, cssH;
    if (!ratio) {
      // Fill the wrap entirely
      w = Math.round(wrapW);
      h = Math.round(wrapH);
      cssW = '100%';
      cssH = '100%';
    } else {
      // Fit the target ratio inside the wrap
      const targetAR = ratio.w / ratio.h;
      const wrapAR = wrapW / wrapH;
      if (targetAR > wrapAR) {
        cssW = wrapW;
        cssH = wrapW / targetAR;
      } else {
        cssH = wrapH;
        cssW = wrapH * targetAR;
      }
      w = Math.max(1, Math.round(cssW));
      h = Math.max(1, Math.round(cssH));
      cssW = w + 'px';
      cssH = h + 'px';
    }

    canvas.style.width = cssW;
    canvas.style.height = cssH;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // ─── Contain-fit (letterbox) ──────────────────────────────
  function containRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let w, h;
    if (srcAR > dstAR) { w = dstW; h = dstW / srcAR; }
    else { h = dstH; w = dstH * srcAR; }
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
  }

  // ─── Cover-fit (crop) ─────────────────────────────────────
  function coverSourceRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { sx: 0, sy: 0, sw: srcW, sh: srcH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let sw, sh, sx, sy;
    if (srcAR > dstAR) {
      // source wider → crop left/right
      sh = srcH;
      sw = srcH * dstAR;
      sx = (srcW - sw) / 2;
      sy = 0;
    } else {
      // source taller → crop top/bottom
      sw = srcW;
      sh = srcW / dstAR;
      sx = 0;
      sy = (srcH - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  // Expose for other modules
  window.__previewContainRect = containRect;

  // ─── Draw a video frame ───────────────────────────────────
  function drawVideoFrame() {
    if (!video.videoWidth || !video.videoHeight) return;
    if (video.readyState < 2) return;

    syncCanvasSize();
    const c = getCtx();
    if (!c) return;

    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);

    const ratio = getTargetRatio();

    try {
      if (!ratio) {
        // Contain-fit (letterbox)
        const r = containRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        c.drawImage(video, r.x, r.y, r.w, r.h);
      } else {
        // Cover-fit: crop source to match target ratio
        const s = coverSourceRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        c.drawImage(video, s.sx, s.sy, s.sw, s.sh, 0, 0, canvas.width, canvas.height);
      }
    } catch (_) {}
  }

  // ─── Draw a static image ──────────────────────────────────
  function drawImageContained(image) {
    syncCanvasSize();
    const c = getCtx();
    if (!c) return;

    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);

    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const ratio = getTargetRatio();

    try {
      if (!ratio) {
        const r = containRect(iw, ih, canvas.width, canvas.height);
        c.drawImage(image, r.x, r.y, r.w, r.h);
      } else {
        const s = coverSourceRect(iw, ih, canvas.width, canvas.height);
        c.drawImage(image, s.sx, s.sy, s.sw, s.sh, 0, 0, canvas.width, canvas.height);
      }
    } catch (_) {}
  }

  // ─── Playback loop ────────────────────────────────────────
  let rafId = null;
  function startLoop() {
    if (rafId) return;
    const loop = () => {
      drawVideoFrame();
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    };
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ─── Hide video element ───────────────────────────────────
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

  // ─── Events ───────────────────────────────────────────────
  video.addEventListener('loadedmetadata', drawVideoFrame);
  video.addEventListener('loadeddata', drawVideoFrame);
  video.addEventListener('seeked', drawVideoFrame);
  video.addEventListener('play', startLoop);
  video.addEventListener('playing', startLoop);
  video.addEventListener('pause', () => { drawVideoFrame(); stopLoop(); });
  video.addEventListener('ended', () => { drawVideoFrame(); stopLoop(); });

  // Ratio change → resize + redraw
  document.addEventListener('ratio:changed', () => {
    syncCanvasSize();
    drawVideoFrame();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
      drawVideoFrame();
    }).observe(canvas.parentElement || canvas);
  }

  // ─── Media setter ─────────────────────────────────────────
  function setMedia(item) {
    if (!item) return;
    const type = item.type || '';
    if (empty) empty.hidden = true;

    if (type.startsWith('video/')) {
      video.src = item.url;
      video.load();
      hideVideo();
      canvas.hidden = false;
      video.addEventListener('loadeddata', drawVideoFrame, { once: true });
      return;
    }

    if (type.startsWith('audio/')) return;

    if (type.startsWith('image/')) {
      const image = new Image();
      image.onload = () => {
        drawImageContained(image);
        canvas.hidden = false;
        if (empty) empty.hidden = true;
      };
      image.src = item.url;
      return;
    }
  }

  function clear() {
    stopLoop();
    video.pause();
    video.removeAttribute('src');
    video.load();
    hideVideo();
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
    setMedia,
    clear,
    setVisible,
    redraw,
    getContext: getCtx
  };
}