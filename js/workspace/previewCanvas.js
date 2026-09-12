// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas.
//
//  When window.__previewBlockAutoDraw is true (playbackEngine active),
//  this module stops auto-drawing on video events. Engine drives the
//  canvas via preview.redraw().
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

  // 🆕 When true, no auto-draws happen (engine owns canvas)
  function isBlocked() {
    return window.__previewBlockAutoDraw === true;
  }

  // ─── Target ratio ─────────────────────────────────────────
  function getTargetRatio() {
    const r = window.__offlineEditorRatio;
    if (r && Number.isFinite(r.w) && Number.isFinite(r.h) && r.w > 0 && r.h > 0) {
      return { w: r.w, h: r.h };
    }
    return null;
  }

  // ─── Size canvas ──────────────────────────────────────────
  function syncCanvasSize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const wrapW = Math.max(1, wrapRect.width);
    const wrapH = Math.max(1, wrapRect.height);

    const ratio = getTargetRatio();

    let w, h, cssW, cssH;
    if (!ratio) {
      w = Math.round(wrapW);
      h = Math.round(wrapH);
      cssW = '100%';
      cssH = '100%';
    } else {
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

  // ─── Contain-fit ──────────────────────────────────────────
  function containRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let w, h;
    if (srcAR > dstAR) { w = dstW; h = dstW / srcAR; }
    else { h = dstH; w = dstH * srcAR; }
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
  }

  // ─── Cover-fit ────────────────────────────────────────────
  function coverSourceRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { sx: 0, sy: 0, sw: srcW, sh: srcH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let sw, sh, sx, sy;
    if (srcAR > dstAR) {
      sh = srcH; sw = srcH * dstAR; sx = (srcW - sw) / 2; sy = 0;
    } else {
      sw = srcW; sh = srcW / dstAR; sx = 0; sy = (srcH - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  window.__previewContainRect = containRect;

  // ─── Shared draw helper for feature modules ───────────────
  window.__previewDrawVideo = function (drawCtx, videoEl, canvasEl) {
    if (!drawCtx || !videoEl || !canvasEl) return;
    drawCtx.fillStyle = '#000';
    drawCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh || videoEl.readyState < 2) return;

    const ratio = getTargetRatio();
    try {
      if (!ratio) {
        const r = containRect(vw, vh, canvasEl.width, canvasEl.height);
        drawCtx.drawImage(videoEl, r.x, r.y, r.w, r.h);
      } else {
        const s = coverSourceRect(vw, vh, canvasEl.width, canvasEl.height);
        drawCtx.drawImage(
          videoEl,
          s.sx, s.sy, s.sw, s.sh,
          0, 0, canvasEl.width, canvasEl.height
        );
      }
    } catch (_) {}
  };

  // ─── Draw video frame ─────────────────────────────────────
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
        const r = containRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        c.drawImage(video, r.x, r.y, r.w, r.h);
      } else {
        const s = coverSourceRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        c.drawImage(video, s.sx, s.sy, s.sw, s.sh, 0, 0, canvas.width, canvas.height);
      }
    } catch (_) {}
  }

  // ─── Draw image ───────────────────────────────────────────
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

  // ─── Playback loop (only when NOT blocked) ────────────────
  let rafId = null;
  function startLoop() {
    if (isBlocked()) return;
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

  // ─── Event handlers (all guarded by isBlocked) ────────────
  function guardedDraw() {
    if (isBlocked()) return;
    drawVideoFrame();
  }

  video.addEventListener('loadedmetadata', guardedDraw);
  video.addEventListener('loadeddata', guardedDraw);
  video.addEventListener('seeked', guardedDraw);

  video.addEventListener('play',    () => { if (!isBlocked()) startLoop(); });
  video.addEventListener('playing', () => { if (!isBlocked()) startLoop(); });
  video.addEventListener('pause',   () => {
    if (isBlocked()) return;
    drawVideoFrame();
    stopLoop();
  });
  video.addEventListener('ended', () => {
    if (isBlocked()) return;
    drawVideoFrame();
    stopLoop();
  });

  // Ratio change → resize + redraw
  document.addEventListener('ratio:changed', () => {
    syncCanvasSize();
    if (!isBlocked()) drawVideoFrame();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
      if (!isBlocked()) drawVideoFrame();
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
      if (!isBlocked()) {
        video.addEventListener('loadeddata', drawVideoFrame, { once: true });
      }
      return;
    }

    if (type.startsWith('audio/')) return;

    if (type.startsWith('image/')) {
      const image = new Image();
      image.onload = () => {
        if (isBlocked()) return;
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