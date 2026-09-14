// ================================================================
//  js/workspace/timelinePlayhead.js
//  Playhead position driven by playbackEngine.getTime().
//  Click on ruler → seek to EXACT clicked time.
//
//  🆕 FIX: Playhead ab SAME formula use karta hai jo ruler markers
//  use karte hain (via timelineScaler). Isse zoom kisi bhi level
//  pe playhead aur ruler always match karenge.
// ================================================================

import { getPixelsPerSecond, LABEL_WIDTH } from './timelineScaler.js';

export function initTimelinePlayhead({
  element,
  matrix,
  viewport,
  engine,
  timeDisplay,
  getRulerContainer = () => null
}) {
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

  // ═══════════════════════════════════════════════════════════
  //  🆕 CORE FIX: Playhead position ab ruler markers ke
  //     SAME formula se compute hoti hai:
  //
  //       ruler marker for time T  =  LABEL_WIDTH + T * pxPerSecond
  //       playhead position       =  LABEL_WIDTH + time * pxPerSecond
  //
  //     Pehle playhead DOM scrollWidth padhta tha — jo zoom
  //     change pe stale hota tha. Ab scaler se direct leta hai.
  // ═══════════════════════════════════════════════════════════
  function setProgress(currentTime, duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    const safeTime = Math.max(0, Math.min(Number(currentTime) || 0, safeDuration));

    const pps = getPixelsPerSecond();
    const nextLeft = LABEL_WIDTH + safeTime * pps;

    element.style.left = Math.max(LABEL_WIDTH, nextLeft) + 'px';

    updateTimeDisplay(safeTime, safeDuration);
  }

  // ─── Click-to-seek (exact position) ────────────────────────
  function seekFromClick(event) {
    if (!engine) return;

    const duration = engine.getDuration();
    if (duration <= 0) return;

    // Ignore clicks on interactive elements
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
    if (clickX < LABEL_WIDTH) return;

    // 🆕 SAME formula as ruler — exact pixel → time mapping
    const pps = getPixelsPerSecond();
    if (pps <= 0) return;

    let newTime = (clickX - LABEL_WIDTH) / pps;
    newTime = Math.max(0, Math.min(duration, newTime));

    // Frame-snap
    const frameDur = 1 / fps;
    newTime = Math.round(newTime / frameDur) * frameDur;
    newTime = Math.max(0, Math.min(duration, newTime));

    // 🆕 Force pause before seek (user gesture)
    if (typeof engine.pause === 'function') {
      try { engine.pause(); } catch (_) {}
    }
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
      if (engine) setProgress(engine.getTime(), engine.getDuration());
    }).observe(matrix);
  }

  // ─── Zoom slider ──────────────────────────────────────────
  const zoomSlider = document.querySelector('#zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
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

  // ═══════════════════════════════════════════════════════════
  //  🆕 FIX: Zoom change pe playhead ko force-update karo
  //     (double RAF — DOM settle hone ke baad chalta hai)
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('timeline:scale-changed', function () {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (engine) setProgress(engine.getTime(), engine.getDuration());
      });
    });
  });

  // ─── FPS detection ────────────────────────────────────────
  try {
    const settings = window.__exportSettings;
    if (settings && settings.fps) fps = settings.fps;
  } catch (_) {}

  updateTimeDisplay(0, 0);

  // Initial sync
  if (engine) {
    requestAnimationFrame(() => {
      setProgress(engine.getTime(), engine.getDuration());
    });
  }

  return {
    setProgress,
    formatTime
  };
}