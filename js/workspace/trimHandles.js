// ================================================================
//  js/workspace/trimHandles.js
//  Drag-to-trim handles on selected timeline clips.
//  Skips transition markers, kf markers.
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';
import { applyTrimToLinked } from './clipLink.js';

const MIN_DUR = 0.15;
const HANDLE_HIT_W = 20;

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
    }
    .trim-handle-left::after  { left:  ${HANDLE_HIT_W / 2 - 3}px; }
    .trim-handle-right::after { right: ${HANDLE_HIT_W / 2 - 3}px; }

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

    body.trim-dragging,
    body.trim-dragging * {
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: ew-resize !important;
    }
  `;
  stylesInjected = true;
}

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

  clipEl.classList.add('trimming');
  document.body.classList.add('trim-dragging');

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

  let rafPending = false;
  let pendingX = startX;

  function computeFrom(pointerX) {
    const dxPx = pointerX - startX;
    const dxSec = dxPx / ppsAtStart;

    if (side === 'left') {
      let newStart = startStart + dxSec;
      newStart = Math.max(0, newStart);
      const minStartBySource = startStart - startSourceIn;
      if (newStart < minStartBySource) newStart = minStartBySource;
      newStart = Math.min(startEnd - MIN_DUR, newStart);

      const delta = newStart - startStart;

      clipData.startTime = newStart;
      clipData.duration  = startEnd - newStart;
      clipData.sourceIn  = Math.max(0, startSourceIn + delta);

      return {
        label: 'In ' + fmtTime(newStart),
        clipLeftPx: newStart * ppsAtStart,
        clipWidthPx: Math.max(20, (startEnd - newStart) * ppsAtStart)
      };
    } else {
      let newDur = startDur + dxSec;
      newDur = Math.max(MIN_DUR, newDur);

      if (Number.isFinite(srcTotal)) {
        const maxDur = srcTotal - startSourceIn;
        if (newDur > maxDur) newDur = maxDur;
      }

      clipData.duration = newDur;

      return {
        label: 'Out ' + fmtTime(startSourceIn + newDur),
        clipLeftPx: startStart * ppsAtStart,
        clipWidthPx: Math.max(20, newDur * ppsAtStart)
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
    tooltip.textContent = r.label;

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
    document.body.classList.remove('trim-dragging');
    if (tooltip.parentNode) tooltip.remove();

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