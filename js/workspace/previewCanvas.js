// ================================================================
//  js/workspace/previewCanvas.js
//  Preview canvas + hidden video element controller.
//  - Single cached 2D context with willReadFrequently: true
//    (prevents repeated warnings from chroma key / filters)
//  - Handles video, image, and clear()
//  - Exposes: setMedia(item), clear(), setVisible(bool)
// ================================================================

export function initPreviewCanvas({ canvas, video, empty }) {
  if (!canvas || !video) {
    return {
      setMedia() {},
      clear() {},
      setVisible() {}
    };
  }

  // ─── Single cached 2D context ──────────────────────────────
  // willReadFrequently = true  → browser optimizes repeated
  // getImageData calls (chroma key, filters, adjustments).
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

  // ─── Match canvas internal size to its CSS box ─────────────
  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // ─── Video events ──────────────────────────────────────────
  function drawVideoFrame() {
    if (!video.videoWidth || !video.videoHeight) return;
    syncCanvasSize();
    const c = getCtx();
    if (!c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  video.addEventListener('loadedmetadata', () => {
    drawVideoFrame();
  });
  video.addEventListener('seeked', () => {
    drawVideoFrame();
  });
  video.addEventListener('loadeddata', () => {
    drawVideoFrame();
  });

  // ─── Resize observer ───────────────────────────────────────
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      syncCanvasSize();
    }).observe(canvas);
  }

  // ─── Public API ────────────────────────────────────────────
  function setMedia(item) {
    if (!item) return;

    const type = item.type || '';
    empty.hidden = true;

    // ── Video ──
    if (type.startsWith('video/')) {
      video.src = item.url;
      video.load();
      video.classList.remove('is-hidden');
      canvas.hidden = false;
      // Draw first frame once metadata loads
      video.addEventListener('loadeddata', drawVideoFrame, { once: true });
      return;
    }

    // ── Audio ── (no preview canvas drawing)
    if (type.startsWith('audio/')) {
      return;
    }

    // ── Image ──
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
        video.classList.add('is-hidden');
        empty.hidden = true;
      };
      image.src = item.url;
      return;
    }
  }

  function clear() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    const c = getCtx();
    if (c) c.clearRect(0, 0, canvas.width, canvas.height);
    video.classList.add('is-hidden');
    empty.hidden = false;
    canvas.hidden = false;
  }

  function setVisible(visible) {
    if (visible) {
      canvas.style.opacity = '';
      canvas.style.visibility = '';
    } else {
      canvas.style.opacity = '0';
      canvas.style.visibility = 'hidden';
    }
  }
  syncCanvasSize();
  video.classList.add('is-hidden');

  return {
    setMedia,
    clear,
    setVisible,
    // exposed for chroma key / filters if needed
    getContext: getCtx
  };
}