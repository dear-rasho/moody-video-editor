// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas is the DISPLAY SURFACE.
//  Video element is ALWAYS hidden.
//  Video/image drawn with CONTAIN-fit (letterboxed).
//  Exposes window.__previewContainRect for other modules.
// ================================================================

export function initPreviewCanvas({ canvas, video, empty }) {
  if (!canvas || !video) {
    return {
      setMedia() {},
      clear() {},
      setVisible() {},
      redraw() {},
      getContext() { return null; }
    };
  }

  let ctx = null;
  function getCtx() {
    if (ctx) return ctx;
    try {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (_) {
      ctx = canvas.getContext('2d');
    }
    return ctx;
  }

  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // ─── Contain-fit rect (preserve src AR, center inside dst) ─
  function containRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
    const srcAR = srcW / srcH;
    const dstAR = dstW / dstH;
    let w, h;
    if (srcAR > dstAR) {
      w = dstW;
      h = dstW / srcAR;
    } else {
      h = dstH;
      w = dstH * srcAR;
    }
    const x = (dstW - w) / 2;
    const y = (dstH - h) / 2;
    return { x, y, w, h };
  }

  // expose for feature modules
  window.__previewContainRect = containRect;

  function drawVideoFrame() {
    if (!video.videoWidth || !video.videoHeight) return;
    if (video.readyState < 2) return;
    syncCanvasSize();
    const c = getCtx();
    if (!c) return;

    c.clearRect(0, 0, canvas.width, canvas.height);
    const r = containRect(
      video.videoWidth, video.videoHeight,
      canvas.width, canvas.height
    );
    try {
      c.drawImage(video, r.x, r.y, r.w, r.h);
    } catch (_) {}
  }

  function drawImageContained(image) {
    syncCanvasSize();
    const c = getCtx();
    if (!c) return;

    c.clearRect(0, 0, canvas.width, canvas.height);
    const r = containRect(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      canvas.width, canvas.height
    );
    c.drawImage(image, r.x, r.y, r.w, r.h);
  }

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

  function hideVideo() {
    video.classList.remove('is-hidden');
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('left', '0', 'important');
    video.style.setProperty('top', '0', 'important');
    video.style.setProperty('right', 'auto', 'important');
    video.style.setProperty('bottom', 'auto', 'important');
    video.style.setProperty('width', '1px', 'important');
    video.style.setProperty('height', '1px', 'important');
    video.style.setProperty('opacity', '0', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('pointer-events', 'none', 'important');
    video.style.setProperty('z-index', '-1', 'important');
  }
  hideVideo();

  video.addEventListener('loadedmetadata', drawVideoFrame);
  video.addEventListener('loadeddata', drawVideoFrame);
  video.addEventListener('seeked', drawVideoFrame);
  video.addEventListener('play', startLoop);
  video.addEventListener('playing', startLoop);
  video.addEventListener('pause', () => {
    drawVideoFrame();
    stopLoop();
  });
  video.addEventListener('ended', () => {
    drawVideoFrame();
    stopLoop();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
      if (video.paused || video.ended) return;
      drawVideoFrame();
    }).observe(canvas);
  }

  function setMedia(item) {
    if (!item) return;
    const type = item.type || '';
    empty.hidden = true;

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
        empty.hidden = true;
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
    empty.hidden = false;
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

  function redraw() {
    drawVideoFrame();
  }

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