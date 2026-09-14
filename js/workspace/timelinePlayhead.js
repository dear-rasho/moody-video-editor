// ================================================================
//  js/workspace/timelinePlayhead.js
//  Playhead position driven by playbackEngine.getTime().
//  Click on ruler → seek to EXACT clicked time.
//
//  FIX: getContentWidth() now correctly subtracts LABEL_WIDTH
//       so the playhead matches ruler marker positions.
// ================================================================

export function initTimelinePlayhead({
  element,
  matrix,
  viewport,
  engine,
  timeDisplay,
  getRulerContainer = () => null
}) {
  const LABEL_WIDTH = 80;
  let contentStart = LABEL_WIDTH;
  let fps = 30;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) seconds = 0;
    seconds = Math.max(0, seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return (
      String(minutes).padStart(2, '0') + ':' +
      String(remainingSeconds).padStart(2, '0')
    );
  }

  function updateTimeDisplay(currentTime, duration) {
    if (!timeDisplay) return;
    timeDisplay.textContent = formatTime(currentTime) + ' / ' + formatTime(duration);
  }

  function alignToLayerContent() {
    contentStart = LABEL_WIDTH;
    element.style.left = contentStart + 'px';
  }

  // 🆕 FIXED: return ONLY content width (excluding label area)
  function getContentWidth() {
    // Try ruler first
    const ruler = getRulerContainer();
    if (ruler) {
      const totalRulerWidth = ruler.scrollWidth || ruler.offsetWidth || 0;
      if (totalRulerWidth > contentStart) {
        return totalRulerWidth - contentStart;
      }
    }
    // Fallback: use matrix scroll width
    return Math.max(0, matrix.scrollWidth - contentStart);
  }

  function setProgress(currentTime, duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    const safeTime = Math.max(0, Math.min(Number(currentTime) || 0, safeDuration));
    const progress = safeDuration > 0 ? safeTime / safeDuration : 0;

    // 🆕 FIXED: contentWidth now excludes label width
    const contentWidth = getContentWidth();
    const nextLeft = contentStart + (contentWidth * progress);
    element.style.left = Math.max(contentStart, nextLeft) + 'px';

    updateTimeDisplay(safeTime, safeDuration);
  }

  // ─── Click-to-seek (exact position) ────────────────────────
  function seekFromClick(event) {
    if (!engine) return;

    const duration = engine.getDuration();
    if (duration <= 0) return;

    // Ignore clicks on clip elements or interactive children
    if (event.target.closest &&
        (event.target.closest('.clip') ||
         event.target.closest('.trim-handle') ||
         event.target.closest('.kf-marker') ||
         event.target.closest('.transition-marker') ||
         event.target.closest('.track-label'))) {
      return;
    }

    const rect = matrix.getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    // If clicked in label area, ignore
    if (clickX < contentStart) return;

    const contentWidth = getContentWidth();
    if (contentWidth <= 0) return;

    const position = Math.max(0, Math.min(contentWidth, clickX - contentStart));
    const progress = position / contentWidth;

    let newTime = progress * duration;

    // Frame-snap
    const frameDur = 1 / fps;
    newTime = Math.round(newTime / frameDur) * frameDur;
    newTime = Math.max(0, Math.min(duration, newTime));

    engine.seek(newTime);
  }

  // Pointerdown for immediate feedback
  matrix.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    seekFromClick(e);
  });

  // ─── Resize observer ───────────────────────────────────────
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      alignToLayerContent();
      if (engine) setProgress(engine.getTime(), engine.getDuration());
    }).observe(matrix);
  }

  // ─── Zoom slider ──────────────────────────────────────────
  const zoomSlider = document.querySelector('#zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      // Defer to next frame so scaler updates first
      requestAnimationFrame(() => {
        if (engine) setProgress(engine.getTime(), engine.getDuration());
      });
    });
  }

  // ─── Playback tick ─────────────────────────────────────────
  document.addEventListener('playback:tick', function (e) {
    const d = e.detail || {};
    setProgress(d.time || 0, d.duration || 0);
  });

  // ─── Scale changes (zoom) ─────────────────────────────────
  document.addEventListener('timeline:scale-changed', function () {
    // Defer to allow DOM to settle
    requestAnimationFrame(() => {
      if (engine) setProgress(engine.getTime(), engine.getDuration());
    });
  });

  // ─── FPS detection ────────────────────────────────────────
  try {
    const settings = window.__exportSettings;
    if (settings && settings.fps) fps = settings.fps;
  } catch (_) {}

  alignToLayerContent();
  updateTimeDisplay(0, 0);

  // Initial sync
  if (engine) {
    requestAnimationFrame(() => {
      setProgress(engine.getTime(), engine.getDuration());
    });
  }

  return {
    alignToLayerContent,
    setProgress,
    formatTime
  };
}