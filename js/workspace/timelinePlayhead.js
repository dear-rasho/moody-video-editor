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
  let lastUserScrollTime = 0;
  const USER_SCROLL_GRACE_MS = 1800;

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
  //  🆕 USER SCROLL TRACKER
  //  Detects when user manually scrolls / pans timeline.
  //  During that grace period, auto-scroll won't fight them.
  // ═══════════════════════════════════════════════════════════
  function markUserScroll() {
    lastUserScrollTime = Date.now();
  }
  if (viewport) {
    viewport.addEventListener('wheel', markUserScroll, { passive: true });
    viewport.addEventListener('touchstart', markUserScroll, { passive: true });
    viewport.addEventListener('touchmove', markUserScroll, { passive: true });
    viewport.addEventListener('pointerdown', markUserScroll, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════
  //  🆕 AUTO-SCROLL — keep playhead visible in viewport
  //
  //  • During playback → playhead pinned at ~30% of content area
  //  • When paused     → only recenter if playhead went off-screen
  //  • User scrolls    → respected (no fight for 1.8s)
  // ═══════════════════════════════════════════════════════════
  function keepPlayheadVisible(playheadX) {
    if (!viewport) return;
    const vw = viewport.clientWidth;
    if (vw <= 0) return;

    const contentStart = LABEL_WIDTH;
    const contentWidth = Math.max(0, vw - LABEL_WIDTH);
    if (contentWidth <= 0) return;

    const isPlaying = !!(engine && typeof engine.isPlaying === 'function' && engine.isPlaying());
    const userScrolledRecently = (Date.now() - lastUserScrollTime) < USER_SCROLL_GRACE_MS;

    // Respect user's recent scroll while paused
    if (userScrolledRecently && !isPlaying) return;

    const currentScroll = viewport.scrollLeft;
    const visualX = playheadX - currentScroll;

    const safeMin = contentStart + 16;
    const safeMax = vw - 16;
    const isVisible = visualX >= safeMin && visualX <= safeMax;

    // Paused + playhead visible → no scroll needed
    if (!isPlaying && isVisible) return;

    // Target: playhead at 30% of content area
    const targetVisualX = contentStart + contentWidth * 0.30;
    const targetScroll = playheadX - targetVisualX;
    const maxScroll = Math.max(0, viewport.scrollWidth - vw);
    const clamped = Math.max(0, Math.min(maxScroll, targetScroll));

    if (Math.abs(currentScroll - clamped) > 1) {
      viewport.scrollLeft = clamped;
    }
  }

  function setProgress(currentTime, duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    const safeTime = Math.max(0, Math.min(Number(currentTime) || 0, safeDuration));

    const pps = getPixelsPerSecond();
    const nextLeft = LABEL_WIDTH + safeTime * pps;

    element.style.left = Math.max(LABEL_WIDTH, nextLeft) + 'px';

    updateTimeDisplay(safeTime, safeDuration);

    // 🆕 Keep playhead visible during playback / seeks
    keepPlayheadVisible(nextLeft);
  }

  // ─── Click-to-seek (exact position) ────────────────────────
  function seekFromClick(event) {
    if (!engine) return;

    const duration = engine.getDuration();
    if (duration <= 0) return;

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

    if (clickX < LABEL_WIDTH) return;

    const pps = getPixelsPerSecond();
    if (pps <= 0) return;

    let newTime = (clickX - LABEL_WIDTH) / pps;
    newTime = Math.max(0, Math.min(duration, newTime));

    const frameDur = 1 / fps;
    newTime = Math.round(newTime / frameDur) * frameDur;
    newTime = Math.max(0, Math.min(duration, newTime));

    if (typeof engine.pause === 'function') {
      try { engine.pause(); } catch (_) {}
    }
    engine.seek(newTime);
  }

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

  // ─── Zoom change → re-sync playhead ────────────────────────
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