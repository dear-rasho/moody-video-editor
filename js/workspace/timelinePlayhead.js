export function initTimelinePlayhead({
  element,
  matrix,
  viewport,
  video,
  timeDisplay,
  getZoomFactor = () => 1,
  getRulerContainer = () => null
}) {
  const LABEL_WIDTH = 80;
  let contentStart = LABEL_WIDTH;
  let currentDuration = 0;
  let currentTime = 0;

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
    const zoom = getZoomFactor();
    const ruler = getRulerContainer();
    if (ruler) {
      return ruler.scrollWidth || matrix.scrollWidth - contentStart;
    }
    return Math.max(0, matrix.scrollWidth - contentStart);
  }

  function setProgress(currentTime, duration) {
    currentDuration = Number.isFinite(duration) ? duration : 0;
    currentTime = Number.isFinite(currentTime) ? currentTime : 0;
    const safeDuration = Math.max(0, currentDuration);
    const safeTime = Math.max(0, Math.min(currentTime, safeDuration));
    const progress = safeDuration > 0 ? safeTime / safeDuration : 0;
    const contentWidth = getContentWidth();
    const nextLeft = contentStart + (contentWidth * progress);
    element.style.left = `${Math.max(contentStart, nextLeft)}px`;
    updateTimeDisplay(safeTime, safeDuration);
  }

  function seekFromClick(event) {
    if (!video || !Number.isFinite(video.duration) || video.duration === 0) return;
    const rect = matrix.getBoundingClientRect();
    const clickX = event.clientX - rect.left + viewport.scrollLeft;
    if (clickX < contentStart) return;
    const contentWidth = getContentWidth();
    if (contentWidth <= 0) return;
    const position = Math.max(0, Math.min(contentWidth, clickX - contentStart));
    const progress = position / contentWidth;
    const newTime = progress * video.duration;
    video.pause();
    video.currentTime = newTime;
    setProgress(newTime, video.duration);
  }

  function updateRulerOnZoom() {
    // Zoom change par ruler update karne ke liye
    const contentWidth = getContentWidth();
    // Ruler markers ko reposition karne ke liye - timelineEngine handle karega
  }

  matrix.addEventListener('click', seekFromClick);

  // Resize observer
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      alignToLayerContent();
      if (video && Number.isFinite(video.duration)) {
        setProgress(video.currentTime, video.duration);
      }
    }).observe(matrix);
  }

  // Zoom slider ke liye observer
  const zoomSlider = document.querySelector('#zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      if (video && Number.isFinite(video.duration)) {
        setProgress(video.currentTime, video.duration);
      }
    });
  }

  alignToLayerContent();
  updateTimeDisplay(0, 0);

  return {
    alignToLayerContent,
    setProgress,
    formatTime,
    updateRulerOnZoom
  };
}