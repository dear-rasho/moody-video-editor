// ================================================================
//  js/workspace/timelinePlayhead.js
//  Playhead position is driven by the playbackEngine's time.
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

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) seconds = 0;
    seconds = Math.max(0, seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function updateTimeDisplay(currentTime, duration) {
    if (!timeDisplay) return;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }

  function alignToLayerContent() {
    contentStart = LABEL_WIDTH;
    element.style.left = `${contentStart}px`;
  }

  function getContentWidth() {
    const ruler = getRulerContainer();
    if (ruler) return ruler.scrollWidth || (matrix.scrollWidth - contentStart);
    return Math.max(0, matrix.scrollWidth - contentStart);
  }

  function setProgress(currentTime, duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    const safeTime = Math.max(0, Math.min(Number(currentTime) || 0, safeDuration));
    const progress = safeDuration > 0 ? safeTime / safeDuration : 0;
    const contentWidth = getContentWidth();
    const nextLeft = contentStart + (contentWidth * progress);
    element.style.left = `${Math.max(contentStart, nextLeft)}px`;
    updateTimeDisplay(safeTime, safeDuration);
  }

  function seekFromClick(event) {
    if (!engine) return;
    const duration = engine.getDuration();
    if (!duration) return;
    const rect = matrix.getBoundingClientRect();
    const clickX = event.clientX - rect.left + (viewport ? viewport.scrollLeft : 0);
    if (clickX < contentStart) return;
    const contentWidth = getContentWidth();
    if (contentWidth <= 0) return;
    const position = Math.max(0, Math.min(contentWidth, clickX - contentStart));
    const progress = position / contentWidth;
    const newTime = progress * duration;
    engine.seek(newTime);
  }

  matrix.addEventListener('click', seekFromClick);

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      alignToLayerContent();
      if (engine) setProgress(engine.getTime(), engine.getDuration());
    }).observe(matrix);
  }

  const zoomSlider = document.querySelector('#zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      if (engine) setProgress(engine.getTime(), engine.getDuration());
    });
  }

  document.addEventListener('playback:tick', function (e) {
    const d = e.detail || {};
    setProgress(d.time || 0, d.duration || 0);
  });

  alignToLayerContent();
  updateTimeDisplay(0, 0);

  return {
    alignToLayerContent,
    setProgress,
    formatTime
  };
}