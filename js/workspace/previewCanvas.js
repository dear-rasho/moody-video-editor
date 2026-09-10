// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas is the DISPLAY SURFACE.
//  Video element is ALWAYS hidden (opacity 0 + !important) so no
//  other module can accidentally reveal it.
//  Video stays in-viewport (never off-screen) so browsers keep
//  decoding frames for drawImage.
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

  // ─── Single cached 2D context ─────────────────────────────
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

  // ─── Match canvas internal size to CSS box ────────────────
  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // ─── Draw current video frame to canvas ───────────────────
  function drawVideoFrame() {
    if (!video.videoWidth || !video.videoHeight) return;
    if (video.readyState < 2) return;
    syncCanvasSize();
    const c = getCtx();
    if (!c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    try {
      c.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (_) { /* ignore */ }
  }

  // ─── Playback draw loop ───────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════
  //  VIDEO IS ALWAYS HIDDEN
  //  Use !important so nothing (chromakey / anything else) can
  //  accidentally reveal it.
  //  IMPORTANT: keep it in-viewport (never -9999px) so browsers
  //  don't deprioritize decoding — otherwise drawImage fails.
  // ═══════════════════════════════════════════════════════════
  function hideVideo() {
    video.classList.remove('is-hidden'); // avoid display:none
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

  // ─── Video events ─────────────────────────────────────────
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

  // ─── Resize observer ──────────────────────────────────────
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
      if (video.paused || video.ended) return;
      drawVideoFrame();
    }).observe(canvas);
  }

  // ─── Public: setMedia ─────────────────────────────────────
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
        syncCanvasSize();
        const c = getCtx();
        if (!c) return;
        c.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(
          canvas.width / image.width,
          canvas.height / image.height
        );
        const width  = image.width  * scale;
        const height = image.height * scale;
        c.drawImage(
          image,
          (canvas.width  - width)  / 2,
          (canvas.height - height) / 2,
          width,
          height
        );
        canvas.hidden = false;
        empty.hidden = true;
      };
      image.src = item.url;
      return;
    }
  }

  // ─── Public: clear ────────────────────────────────────────
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

  // ─── Public: setVisible (V1 toggle) ───────────────────────
  function setVisible(visible) {
    if (visible) {
      canvas.style.visibility = '';
      canvas.style.opacity = '';
    } else {
      canvas.style.visibility = 'hidden';
      canvas.style.opacity = '0';
    }
  }

  // ─── Public: redraw ───────────────────────────────────────
  function redraw() {
    drawVideoFrame();
  }

  // ─── Init ─────────────────────────────────────────────────
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