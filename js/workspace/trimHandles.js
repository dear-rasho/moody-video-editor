// ================================================================
//  js/workspace/trimHandles.js
//  Drag-to-trim handles on selected timeline clips.
//  Skips transition markers, kf markers.
//
//  🆕 SNAP: While trimming, the edge snaps to nearby clip starts,
//  clip ends, and the playhead. Visual feedback (green color +
//  guide line) shows what it snapped to — works across ALL tracks.
//
//  🆕 HYSTERESIS: Enter snap = 14px, Release snap = 28px.
//  Prevents flickering at the snap boundary and makes extending
//  past a snap point feel smooth and predictable.
// ================================================================

import { getPixelsPerSecond, LABEL_WIDTH } from './timelineScaler.js';
import { applyTrimToLinked } from './clipLink.js';

const MIN_DUR = 0.15;
const HANDLE_HIT_W = 20;

// 🆕 Snap thresholds (hysteresis)
const SNAP_ENTER_PX = 14;   // Enter snap zone at 14px
const SNAP_RELEASE_PX = 28; // Must move 28px to break free

const CSS_ID = 'trim-handles-styles';
let stylesInjected = false;

export function injectTrimStyles() {
  if (stylesInjected && document.getElementById(CSS_ID)) return;
  let s = document.getElementById(CSS_ID);
  if (!s) {
    s = document.createElement('style');
    s.id = CSS_ID;
    document.head.appendChild(s);
  }
  s.textContent = `
    .clip { position: absolute !important; }

    .clip.selected {
      overflow: visible !important;
      z-index: 3 !important;
      outline: 2px solid var(--accent);
      outline-offset: -2px;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
    }

    .trim-handle {
      display: none;
      position: absolute;
      top: -6px;
      bottom: -6px;
      width: ${HANDLE_HIT_W}px;
      cursor: ew-resize;
      z-index: 30;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      pointer-events: auto;
    }
    .clip.selected .trim-handle { display: block; }

    .trim-handle-left  { left:  -${HANDLE_HIT_W / 2}px; }
    .trim-handle-right { right: -${HANDLE_HIT_W / 2}px; }

    .trim-handle::after {
      content: '';
      position: absolute;
      top: 4px; bottom: 4px;
      width: 6px;
      background: var(--accent);
      border-radius: 3px;
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.55),
        0 0 6px rgba(255, 255, 255, 0.35);
      transition: background 0.1s ease, box-shadow 0.1s ease;
    }
    .trim-handle-left::after  { left:  ${HANDLE_HIT_W / 2 - 3}px; }
    .trim-handle-right::after { right: ${HANDLE_HIT_W / 2 - 3}px; }

    /* 🆕 Snap active state — green highlight */
    .clip.snap-active {
      outline-color: #22c55e !important;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4) !important;
    }
    .clip.snap-active .trim-handle::after {
      background: #22c55e !important;
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.65),
        0 0 12px rgba(34, 197, 94, 0.95) !important;
    }

    .clip.trimming {
      outline-color: #ffd166 !important;
      box-shadow: 0 0 0 3px rgba(255, 209, 102, 0.35) !important;
    }
    .clip.trimming .trim-handle::after { background: #ffd166; }

    .trim-tooltip {
      position: fixed;
      transform: translate(-50%, -100%);
      background: var(--accent);
      color: #000;
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
      z-index: 100001;
      pointer-events: none;
      font-family: inherit;
      transition: background 0.1s ease, color 0.1s ease;
    }
    .trim-tooltip::after {
      content: '';
      position: absolute;
      left: 50%; top: 100%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: var(--accent);
    }
    .trim-tooltip.is-right { background: #ffd166; }
    .trim-tooltip.is-right::after { border-top-color: #ffd166; }

    /* 🆕 Snap tooltip — green */
    .trim-tooltip.snap-active {
      background: #22c55e !important;
      color: #fff !important;
    }
    .trim-tooltip.snap-active::after {
      border-top-color: #22c55e !important;
    }

    /* 🆕 Snap guide line — spans all tracks */
    .trim-snap-guide {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.9);
      pointer-events: none;
      z-index: 99998;
      display: none;
    }
    .trim-snap-guide.visible { display: block; }

    body.trim-dragging,
    body.trim-dragging * {
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: ew-resize !important;
    }
  `;
  stylesInjected = true;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 SNAP TARGETS — all clips (start+end) + playhead
// ═══════════════════════════════════════════════════════════════
function getSnapTargets(excludeClip) {
  const targets = [];
  const appState = window.__appState;
  if (!appState) return targets;

  const allTracks = []
    .concat(appState.timeline.visual || [])
    .concat(appState.timeline.audio  || []);

  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || clip === excludeClip) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration)  ? clip.duration  : 0;
      targets.push({ time: s,     type: 'start', clip: clip });
      targets.push({ time: s + d, type: 'end',   clip: clip });
    }
  }

  const eng = window.__playbackEngine;
  if (eng && typeof eng.getTime === 'function') {
    const ph = eng.getTime();
    if (Number.isFinite(ph)) {
      targets.push({ time: ph, type: 'playhead', clip: null });
    }
  }

  return targets;
}

function snapLabel(target) {
  if (!target) return '';
  if (target.type === 'playhead') return 'Snap: Playhead';
  const name = (target.clip && target.clip.name) ? target.clip.name : 'Layer';
  const shortName = name.length > 18 ? name.slice(0, 17) + '…' : name;
  return (target.type === 'start' ? 'Snap: Start of ' : 'Snap: End of ') + shortName;
}

// ═══════════════════════════════════════════════════════════════
//  ATTACH
// ═══════════════════════════════════════════════════════════════
export function attachTrimHandles(clipEl, clipData) {
  if (!clipEl || !clipData) return;
  injectTrimStyles();

  clipEl.querySelectorAll('.trim-handle').forEach(h => h.remove());

  const leftH = document.createElement('span');
  leftH.className = 'trim-handle trim-handle-left';
  leftH.setAttribute('aria-hidden', 'true');
  leftH.draggable = false;

  const rightH = document.createElement('span');
  rightH.className = 'trim-handle trim-handle-right';
  rightH.setAttribute('aria-hidden', 'true');
  rightH.draggable = false;

  clipEl.appendChild(leftH);
  clipEl.appendChild(rightH);

  leftH.addEventListener('pointerdown',  (e) => beginDrag(e, clipEl, clipData, 'left'));
  rightH.addEventListener('pointerdown', (e) => beginDrag(e, clipEl, clipData, 'right'));
}

// ═══════════════════════════════════════════════════════════════
//  DRAG
// ═══════════════════════════════════════════════════════════════
function beginDrag(e, clipEl, clipData, side) {
  e.stopPropagation();
  e.preventDefault();

  const trackEl = clipEl.closest('.track');
  const prevClipDrag  = clipEl.draggable;
  const prevTrackDrag = trackEl ? trackEl.draggable : false;
  clipEl.draggable = false;
  if (trackEl) trackEl.draggable = false;

  const blockDrag = function (ev) {
    if (ev.target === clipEl || clipEl.contains(ev.target)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };
  document.addEventListener('dragstart', blockDrag, true);

  const ppsAtStart    = getPixelsPerSecond();
  const startX        = e.clientX;
  const startStart    = Number.isFinite(clipData.startTime) ? clipData.startTime : 0;
  const startDur      = Number.isFinite(clipData.duration)  ? clipData.duration  : 3;
  const startSourceIn = Number.isFinite(clipData.sourceIn)  ? clipData.sourceIn  : 0;
  const startEnd      = startStart + startDur;
  const srcTotal      = Number.isFinite(clipData.__sourceTotalDuration)
                        ? clipData.__sourceTotalDuration
                        : Infinity;

  const snapTargets = getSnapTargets(clipData);

  // 🆕 Hysteresis thresholds (in seconds)
  const enterSec   = SNAP_ENTER_PX   / Math.max(1, ppsAtStart);
  const releaseSec = SNAP_RELEASE_PX / Math.max(1, ppsAtStart);

  // 🆕 Active snap state persists across frames within this drag
  let activeSnap = null;

  clipEl.classList.add('trimming');
  document.body.classList.add('trim-dragging');

  // Snap guide line (spans ALL tracks)
  const matrix = document.querySelector('#timeline-matrix');
  let guideEl = null;
  if (matrix) {
    guideEl = document.createElement('div');
    guideEl.className = 'trim-snap-guide';
    matrix.appendChild(guideEl);
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'trim-tooltip ' + (side === 'left' ? 'is-left' : 'is-right');
  document.body.appendChild(tooltip);

  (function initialLabel() {
    const rect = clipEl.getBoundingClientRect();
    tooltip.style.left = (side === 'left' ? rect.left : rect.right) + 'px';
    tooltip.style.top  = Math.max(20, rect.top - 8) + 'px';
    tooltip.textContent = side === 'left'
      ? 'In ' + fmtTime(startStart)
      : 'Out ' + fmtTime(startSourceIn + startDur);
  })();

  // ═══════════════════════════════════════════════════════════
  //  🆕 HYSTERESIS SNAP LOGIC
  //
  //  - Agar already snapped hai: chhodo sirf jab rawTime
  //    release zone (28px) se bahar jaaye
  //  - Agar snap nahi hai: pakdo sirf jab enter zone (14px)
  //    ke andar aaye
  //
  //  Isse clip snap point pe "sticky" rahega lekin jab user
  //  aage badhna chahe to clean break hoga (jhatka nahi).
  // ═══════════════════════════════════════════════════════════
  function trySnap(rawTime) {
    // Already snapped → check if we should release
    if (activeSnap) {
      const dist = Math.abs(rawTime - activeSnap.time);
      if (dist <= releaseSec) {
        return activeSnap; // Stay snapped
      }
      // Release — user moved past release zone
      activeSnap = null;
    }

    // Not snapped → try to enter a new snap
    let best = null;
    let bestDist = enterSec;
    for (let i = 0; i < snapTargets.length; i++) {
      const t = snapTargets[i];
      const d = Math.abs(t.time - rawTime);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }

    if (best) {
      activeSnap = best;
      return best;
    }

    return null;
  }

  let rafPending = false;
  let pendingX = startX;

  function computeFrom(pointerX) {
    const dxPx = pointerX - startX;
    const dxSec = dxPx / ppsAtStart;

    if (side === 'left') {
      let rawStart = startStart + dxSec;

      // 🆕 Hysteresis-aware snap
      let snappedTo = null;
      if (snapTargets.length) {
        snappedTo = trySnap(rawStart);
        if (snappedTo) {
          rawStart = snappedTo.time;
        }
      }

      // Apply clamps AFTER snap
      let newStart = Math.max(0, rawStart);
      const minStartBySource = startStart - startSourceIn;
      if (newStart < minStartBySource) newStart = minStartBySource;
      newStart = Math.min(startEnd - MIN_DUR, newStart);

      // If clamping moved us away from the snap, drop it
      if (snappedTo && Math.abs(newStart - snappedTo.time) > 0.001) {
        snappedTo = null;
        activeSnap = null;
      }

      const delta = newStart - startStart;

      clipData.startTime = newStart;
      clipData.duration  = startEnd - newStart;
      clipData.sourceIn  = Math.max(0, startSourceIn + delta);

      return {
        label: 'In ' + fmtTime(newStart),
        clipLeftPx: newStart * ppsAtStart,
        clipWidthPx: Math.max(20, (startEnd - newStart) * ppsAtStart),
        snappedTo: snappedTo,
        snapTime: snappedTo ? snappedTo.time : newStart
      };
    } else {
      let rawEnd = startStart + startDur + dxSec;

      // 🆕 Hysteresis-aware snap
      let snappedTo = null;
      if (snapTargets.length) {
        snappedTo = trySnap(rawEnd);
        if (snappedTo) {
          rawEnd = snappedTo.time;
        }
      }

      let newDur = rawEnd - startStart;
      newDur = Math.max(MIN_DUR, newDur);
      if (Number.isFinite(srcTotal)) {
        const maxDur = srcTotal - startSourceIn;
        if (newDur > maxDur) newDur = maxDur;
      }

      // If clamping broke the snap, drop it
      if (snappedTo) {
        const finalEnd = startStart + newDur;
        if (Math.abs(finalEnd - snappedTo.time) > 0.001) {
          snappedTo = null;
          activeSnap = null;
        }
      }

      clipData.duration = newDur;

      return {
        label: 'Out ' + fmtTime(startSourceIn + newDur),
        clipLeftPx: startStart * ppsAtStart,
        clipWidthPx: Math.max(20, newDur * ppsAtStart),
        snappedTo: snappedTo,
        snapTime: snappedTo ? snappedTo.time : (startStart + newDur)
      };
    }
  }

  function apply(pointerX) {
    const r = computeFrom(pointerX);
    clipEl.style.left  = r.clipLeftPx + 'px';
    clipEl.style.width = r.clipWidthPx + 'px';

    const rect = clipEl.getBoundingClientRect();
    const tooltipX = side === 'left' ? rect.left : rect.right;
    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top  = Math.max(20, rect.top - 8) + 'px';

    // Snap feedback
    const snapped = !!r.snappedTo;
    if (snapped) {
      clipEl.classList.add('snap-active');
      tooltip.classList.add('snap-active');
      tooltip.textContent = '🔗 ' + snapLabel(r.snappedTo);

      if (guideEl && matrix) {
        const guideX = LABEL_WIDTH + r.snapTime * ppsAtStart;
        guideEl.style.left = guideX + 'px';
        guideEl.classList.add('visible');
      }
    } else {
      clipEl.classList.remove('snap-active');
      tooltip.classList.remove('snap-active');
      tooltip.textContent = r.label;

      if (guideEl) guideEl.classList.remove('visible');
    }

    const contentEl = clipEl.parentElement;
    if (contentEl) {
      const needWidth = Math.max(
        contentEl.scrollWidth,
        r.clipLeftPx + r.clipWidthPx + 40
      );
      contentEl.style.minWidth = needWidth + 'px';
    }
  }

  function onMove(ev) {
    pendingX = ev.clientX;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      apply(pendingX);
    });
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    clipEl.draggable = prevClipDrag;
    if (trackEl) trackEl.draggable = prevTrackDrag;
    document.removeEventListener('dragstart', blockDrag, true);

    clipEl.classList.remove('trimming');
    clipEl.classList.remove('snap-active');
    document.body.classList.remove('trim-dragging');
    if (tooltip.parentNode) tooltip.remove();
    if (guideEl && guideEl.parentNode) guideEl.remove();

    clipData.__trimmed = true;

    applyTrimToLinked(clipData, {
      startTime: clipData.startTime,
      duration:  clipData.duration,
      sourceIn:  clipData.sourceIn
    });

    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  if (m > 0) {
    const ss = s < 10 ? '0' + s.toFixed(2) : s.toFixed(2);
    return m + ':' + ss;
  }
  return s.toFixed(2) + 's';
}