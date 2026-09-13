// ================================================================
//  js/workspace/layerDrag.js
//  Free-form drag & drop for timeline clips (touch + mouse).
//
//  - Horizontal drag → change startTime (move layer in time)
//  - Vertical drag   → move clip between tracks (reorder layers)
//  - Tap (no drag)   → select clip
//  - Trim handles    → ignored (handled by trimHandles.js)
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';

const DRAG_THRESHOLD_PX = 8;
const LABEL_WIDTH_PX = 80;
const CSS_ID = 'layer-drag-styles';

let dragState = null;
let globalInited = false;

// ─── Public init ──────────────────────────────────────────────
export function initLayerDrag() {
  if (globalInited) return;
  globalInited = true;

  injectStyles();

  const viewport = document.querySelector('#timeline-viewport');
  if (!viewport) return;

  // Block native HTML5 drag inside timeline
  document.addEventListener('dragstart', blockNativeDrag, true);

  // Force-remove draggable attributes
  killDraggable(viewport);

  // Watch for new elements (re-renders)
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => killDraggable(viewport));
    obs.observe(viewport, { childList: true, subtree: true });
  }

  // Main pointer handler (covers touch + mouse + pen)
  viewport.addEventListener('pointerdown', onPointerDown);

  // Block long-press context menu on clips (mobile)
  viewport.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.closest && e.target.closest('.clip')) {
      e.preventDefault();
    }
  });

  // Safety cleanup
  window.addEventListener('blur', forceCleanup);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) forceCleanup();
  });
}

// ─── CSS ──────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .clip {
      touch-action: none !important;
      -webkit-user-drag: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -webkit-tap-highlight-color: transparent !important;
      cursor: grab;
    }
    .clip.layer-drag-active {
      z-index: 100 !important;
      box-shadow:
        0 0 0 3px var(--accent),
        0 8px 24px rgba(0,0,0,0.7) !important;
      opacity: 0.92 !important;
      pointer-events: none !important;
      cursor: grabbing !important;
    }
    .clip.layer-drag-active .trim-handle {
      display: none !important;
    }
    .track.layer-drop-target {
      outline: 2px dashed var(--accent) !important;
      outline-offset: -2px !important;
      background: rgba(255,255,255,0.04) !important;
    }
    .track.layer-drop-target .track-content {
      background: rgba(255,255,255,0.02);
    }
    body.layer-drag-active,
    body.layer-drag-active * {
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: grabbing !important;
    }
  `;
  document.head.appendChild(s);
}

// ─── Native drag blockers ─────────────────────────────────────
function blockNativeDrag(e) {
  if (e.target && e.target.closest && e.target.closest('#timeline-viewport')) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function killDraggable(viewport) {
  const nodes = viewport.querySelectorAll('.clip, .track');
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].draggable) nodes[i].draggable = false;
  }
}

// ─── Pointer down ─────────────────────────────────────────────
function onPointerDown(e) {
  if (dragState) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  if (e.target.closest && e.target.closest('.trim-handle')) return;

  const clipEl = e.target.closest && e.target.closest('.clip');
  if (!clipEl) return;

  const trackEl = clipEl.closest('.track');
  if (!trackEl) return;

  const appState = window.__appState;
  if (!appState) return;

  const trackLabel = clipEl.dataset.track;
  const clipIdx = Number(clipEl.dataset.clip);
  if (!trackLabel || !Number.isFinite(clipIdx)) return;

  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const group = trackLabel.charAt(0) === 'A' ? 'audio' : 'visual';
  if (!Number.isFinite(trackIdx) || trackIdx < 0) return;

  const list = appState.timeline[group];
  const track = list && list[trackIdx];
  const clip = track && track[clipIdx];
  if (!clip) return;

  dragState = {
    clip: clip,
    clipEl: clipEl,
    trackEl: trackEl,
    group: group,
    startTrackIdx: trackIdx,
    startClipIdx: clipIdx,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startTimelineX: getTimelineX(e.clientX),
    startStartTime: Number.isFinite(clip.startTime) ? clip.startTime : 0,
    pps: getPixelsPerSecond(),
    mode: null,
    pointerId: e.pointerId
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

// ─── Pointer move ─────────────────────────────────────────────
function onPointerMove(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (!dragState.mode) {
    if (absX < DRAG_THRESHOLD_PX && absY < DRAG_THRESHOLD_PX) return;
    dragState.mode = (absX >= absY) ? 'h' : 'v';
    enterDragMode();
  }

  if (e.cancelable) e.preventDefault();

  if (dragState.mode === 'h') {
    applyHorizontalDrag(e.clientX);
  } else {
    applyVerticalDrag(e.clientX, e.clientY);
  }
}

// ─── Pointer up ───────────────────────────────────────────────
function onPointerUp(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  const state = dragState;
  dragState = null;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  exitDragMode(state);

  // Tap → select only
  if (!state.mode) {
    selectClip(state.clipEl);
    return;
  }

  // Commit horizontal move
  if (state.mode === 'h') {
    state.clip.__trimmed = true;
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    reselectByUrl(state.clip.url);
    return;
  }

  // Commit vertical move
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;

  if (targetTrack) {
    commitVerticalMove(state, targetTrack);
  } else {
    // Dropped outside — just reset
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  }
}

// ─── Enter / exit drag mode ───────────────────────────────────
function enterDragMode() {
  if (!dragState) return;
  document.body.classList.add('layer-drag-active');
  dragState.clipEl.classList.add('layer-drag-active');

  // Select the dragged clip
  selectClip(dragState.clipEl);

  // Disable viewport scroll during drag
  const vp = document.querySelector('#timeline-viewport');
  if (vp) {
    vp.style.overflowX = 'hidden';
    vp.style.touchAction = 'none';
  }
}

function exitDragMode(state) {
  document.body.classList.remove('layer-drag-active');
  if (state && state.clipEl) {
    state.clipEl.classList.remove('layer-drag-active');
    state.clipEl.style.transition = '';
    state.clipEl.style.transform = '';
    state.clipEl.style.opacity = '';
    state.clipEl.style.zIndex = '';
    state.clipEl.style.left = '';
  }
  clearDropHighlight();
  const vp = document.querySelector('#timeline-viewport');
  if (vp) {
    vp.style.overflowX = '';
    vp.style.touchAction = '';
  }
}

function clearDropHighlight() {
  const els = document.querySelectorAll('.track.layer-drop-target');
  for (let i = 0; i < els.length; i++) els[i].classList.remove('layer-drop-target');
}

// ─── Horizontal drag ──────────────────────────────────────────
function applyHorizontalDrag(clientX) {
  const s = dragState;
  if (!s) return;

  const curTimelineX = getTimelineX(clientX);
  const dx = curTimelineX - s.startTimelineX;
  const dt = dx / s.pps;

  const newStart = Math.max(0, s.startStartTime + dt);
  s.clip.startTime = newStart;

  // Live visual update
  s.clipEl.style.transition = 'none';
  s.clipEl.style.left = (newStart * s.pps) + 'px';
}

// ─── Vertical drag ────────────────────────────────────────────
function applyVerticalDrag(clientX, clientY) {
  const s = dragState;
  if (!s) return;

  const dy = clientY - s.startClientY;
  s.clipEl.style.transition = 'none';
  s.clipEl.style.transform = 'translateY(' + dy + 'px)';
  s.clipEl.style.opacity = '0.6';

  clearDropHighlight();

  const elUnder = document.elementFromPoint(clientX, clientY);
  const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
  if (!targetTrack) return;

  const targetGroup = targetTrack.dataset.group;
  if (targetGroup !== s.group) return;

  targetTrack.classList.add('layer-drop-target');
}

// ─── Commit vertical move ─────────────────────────────────────
function commitVerticalMove(state, targetTrackEl) {
  const appState = window.__appState;
  if (!appState) return;

  const targetGroup = targetTrackEl.dataset.group;
  if (targetGroup !== state.group) {
    showToast('Cannot mix visual & audio tracks');
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const targetTrackIdx = Number(targetTrackEl.dataset.trackIndex);
  if (!Number.isFinite(targetTrackIdx)) return;

  // Same track → nothing to move
  if (targetTrackIdx === state.startTrackIdx) {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const list = appState.timeline[state.group];
  const srcTrack = list[state.startTrackIdx];
  const dstTrack = list[targetTrackIdx];
  if (!Array.isArray(srcTrack) || !Array.isArray(dstTrack)) return;

  // Remove from source track (by reference — safest)
  const idxInSrc = srcTrack.indexOf(state.clip);
  if (idxInSrc < 0) {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }
  srcTrack.splice(idxInSrc, 1);

  // Insert into destination — keep original startTime, but insert in sorted order
  const t = Number.isFinite(state.clip.startTime) ? state.clip.startTime : 0;
  let insertIdx = dstTrack.length;
  for (let i = 0; i < dstTrack.length; i++) {
    const ci = dstTrack[i];
    const ct = ci && Number.isFinite(ci.startTime) ? ci.startTime : 0;
    if (t < ct) { insertIdx = i; break; }
  }
  dstTrack.splice(insertIdx, 0, state.clip);

  state.clip.__trimmed = true;

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  reselectByUrl(state.clip.url);
  showToast('Moved to ' + (state.group === 'visual' ? 'V' : 'A') + (targetTrackIdx + 1));
}

// ─── Helpers ──────────────────────────────────────────────────
function getTimelineX(clientX) {
  const vp = document.querySelector('#timeline-viewport');
  if (!vp) return clientX;
  const rect = vp.getBoundingClientRect();
  return clientX - rect.left + vp.scrollLeft;
}

function selectClip(clipEl) {
  if (!clipEl) return;
  try {
    clipEl.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0
    }));
  } catch (_) {}
}

function reselectByUrl(url) {
  if (!url) return;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      const el = findClipElByUrl(url);
      if (el) selectClip(el);
    });
  });
}

function findClipElByUrl(url) {
  const appState = window.__appState;
  if (!appState || !url) return null;

  const vTracks = appState.timeline.visual || [];
  for (let t = 0; t < vTracks.length; t++) {
    const track = vTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].url === url) {
        return document.querySelector(
          '.clip[data-track="V' + (t + 1) + '"][data-clip="' + c + '"]'
        );
      }
    }
  }
  const aTracks = appState.timeline.audio || [];
  for (let t = 0; t < aTracks.length; t++) {
    const track = aTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].url === url) {
        return document.querySelector(
          '.clip[data-track="A' + (t + 1) + '"][data-clip="' + c + '"]'
        );
      }
    }
  }
  return null;
}

function showToast(msg) {
  if (!msg) return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed',
    'bottom:110px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)',
    'color:#fff',
    'padding:8px 18px',
    'border-radius:20px',
    'font-size:12px',
    'font-weight:600',
    'z-index:9999',
    'pointer-events:none',
    'font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0',
    'transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(function () { el.style.opacity = '1'; });
  setTimeout(function () {
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 200);
  }, 1100);
}

function forceCleanup() {
  if (!dragState) return;
  const state = dragState;
  dragState = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  exitDragMode(state);
}