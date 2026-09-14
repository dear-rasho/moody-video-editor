// ================================================================
//  js/workspace/layerDrag.js
//  - Drag CLIP → move single clip with strict no-overlap auto-track
//    + mirrored linked audio (video V1→V2 moves audio A1→A2)
//  - Drag TRACK LABEL → ripple reorder + mirror linked audio
//  - FIX: click no longer resets clip to timeline start
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';

const DRAG_THRESHOLD_PX = 8;
const REVERT_THRESHOLD_PX = 12;
const CSS_ID = 'layer-drag-styles';

// 🆕 Snap constants (drag-drop)
const SNAP_ENTER_PX = 14;
const SNAP_RELEASE_PX = 28;

let dragState = null;
let globalInited = false;

// ═══════════════════════════════════════════════════════════════
//  🆕 SNAP HELPERS (drag-drop)
// ═══════════════════════════════════════════════════════════════
function getDragSnapTargets(excludeClip) {
  const targets = [];
  const appState = window.__appState;
  if (!appState) return targets;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || clip === excludeClip) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      targets.push({ time: s, type: 'start', clip: clip });
      targets.push({ time: s + d, type: 'end', clip: clip });
    }
  }
  const eng = window.__playbackEngine;
  if (eng && typeof eng.getTime === 'function') {
    const ph = eng.getTime();
    if (Number.isFinite(ph)) targets.push({ time: ph, type: 'playhead', clip: null });
  }
  return targets;
}

function ensureSnapGuide() {
  let guide = document.querySelector('.layer-drag-snap-guide');
  if (!guide) {
    const matrix = document.querySelector('#timeline-matrix');
    if (!matrix) return null;
    guide = document.createElement('div');
    guide.className = 'trim-snap-guide layer-drag-snap-guide';
    guide.style.display = 'none';
    matrix.appendChild(guide);
  }
  return guide;
}

export function initLayerDrag() {
  if (globalInited) return;
  globalInited = true;

  injectStyles();
  const viewport = document.querySelector('#timeline-viewport');
  if (!viewport) return;

  document.addEventListener('dragstart', blockNativeDrag, true);
  killDraggable(viewport);

  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => killDraggable(viewport));
    obs.observe(viewport, { childList: true, subtree: true });
  }

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.closest && e.target.closest('.clip')) e.preventDefault();
  });

  window.addEventListener('blur', forceCleanup);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) forceCleanup();
  });
}

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
      outline: none !important;
    }
    .clip:focus { outline: none !important; }
    .clip.layer-drag-active {
      z-index: 100 !important;
      box-shadow: 0 0 0 3px var(--accent), 0 8px 24px rgba(0,0,0,0.7) !important;
      opacity: 0.92 !important;
      pointer-events: none !important;
      cursor: grabbing !important;
    }
    .clip.layer-drag-active .trim-handle { display: none !important; }
    .clip.layer-drag-active .kf-marker-layer { display: none !important; }

    .track.layer-drop-target {
      outline: 2px dashed #4f9dff !important;
      outline-offset: -2px !important;
      background: rgba(79,157,255,0.08) !important;
    }
    .track.layer-drop-target-blocked {
      outline: 2px dashed #ff5454 !important;
      outline-offset: -2px !important;
      background: rgba(255,84,84,0.08) !important;
    }
    .track.track-drag-active {
      box-shadow: 0 0 0 3px #4f9dff, 0 8px 24px rgba(0,0,0,0.7) !important;
      background: rgba(79,157,255,0.15) !important;
      opacity: 0.85 !important;
      z-index: 99 !important;
    }
    .track.track-drag-active .track-label {
      background: #4f9dff !important;
      color: #000 !important;
    }
    .track-label {
      cursor: grab;
      -webkit-user-drag: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      touch-action: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .track-label:active { cursor: grabbing; }
    .track-label .layer-toggle { cursor: pointer; }

    body.layer-drag-active, body.layer-drag-active * {
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: grabbing !important;
    }

    /* 🆕 Snap visual (fallback if trimHandles not loaded) */
    .clip.snap-active {
      outline-color: #22c55e !important;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4) !important;
    }
    .trim-snap-guide {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.9);
      pointer-events: none;
      z-index: 99998;
    }
  `;
  document.head.appendChild(s);
}

function blockNativeDrag(e) {
  if (e.target && e.target.closest && e.target.closest('#timeline-viewport')) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function killDraggable(viewport) {
  const nodes = viewport.querySelectorAll('.clip, .track, .track-label');
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].draggable) nodes[i].draggable = false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  POINTER DOWN
// ═══════════════════════════════════════════════════════════════
function onPointerDown(e) {
  if (dragState) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest && e.target.closest('.trim-handle')) return;
  if (e.target.closest && e.target.closest('.kf-marker')) return;
  if (e.target.closest && e.target.closest('.transition-marker')) return;
  if (e.target.closest && e.target.closest('.layer-toggle')) return;

  // ─── Track label drag ────────────────────────────────────
  const labelEl = e.target.closest && e.target.closest('.track-label');
  if (labelEl) {
    const trackEl = labelEl.closest('.track');
    if (!trackEl) return;
    const group = trackEl.dataset.group;
    const trackIdx = Number(trackEl.dataset.trackIndex);
    if (!Number.isFinite(trackIdx)) return;

    dragState = {
      mode: 'track',
      group: group,
      trackEl: trackEl,
      fromTrackIdx: trackIdx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pointerId: e.pointerId
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    e.preventDefault();
    return;
  }

  // ─── Clip drag ───────────────────────────────────────────
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
    mode: null,
    clip: clip,
    clipEl: clipEl,
    trackEl: trackEl,
    group: group,
    startTrackIdx: trackIdx,
    startClipIdx: clipIdx,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startStartTime: Number.isFinite(clip.startTime) ? clip.startTime : 0,
    pps: getPixelsPerSecond(),
    pointerId: e.pointerId,
    pendingStartTime: null,
    // 🆕 Snap state
    snapTargets: getDragSnapTargets(clip),
    activeSnap: null,
    clipDuration: Number.isFinite(clip.duration) ? clip.duration : 3
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

// ═══════════════════════════════════════════════════════════════
//  POINTER MOVE
// ═══════════════════════════════════════════════════════════════
function onPointerMove(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  if (dragState.mode === 'track') {
    if (e.cancelable) e.preventDefault();
    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
    clearDropHighlight();
    if (targetTrack && targetTrack !== dragState.trackEl) {
      if (targetTrack.dataset.group === dragState.group) {
        targetTrack.classList.add('layer-drop-target');
      }
    }
    return;
  }

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

  if (dragState.mode === 'h') applyHorizontalDrag(e.clientX);
  else applyVerticalDrag(e.clientX, e.clientY);
}

// ═══════════════════════════════════════════════════════════════
//  POINTER UP
// ═══════════════════════════════════════════════════════════════
function onPointerUp(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;
  const state = dragState;
  dragState = null;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  // ─── Track label drag ────────────────────────────────────
  if (state.mode === 'track') {
    clearDropHighlight();
    const dx = e.clientX - state.startClientX;
    const dy = e.clientY - state.startClientY;
    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
    if (!targetTrack) return;
    if (targetTrack.dataset.group !== state.group) {
      showToast('Cannot move visual ↔ audio track');
      return;
    }
    const toTrackIdx = Number(targetTrack.dataset.trackIndex);
    if (!Number.isFinite(toTrackIdx)) return;
    if (toTrackIdx === state.fromTrackIdx) return;

    document.dispatchEvent(new CustomEvent('editor:reorder-track', {
      detail: { group: state.group, from: state.fromTrackIdx, to: toTrackIdx }
    }));
    return;
  }

  // ─── CLICK (no drag) ─────────────────────────────────────
  if (!state.mode) {
    // 🆕 Do NOT clear styles or re-render on a plain click
    // — just restore any drag-active classes and select
    state.clipEl.classList.remove('layer-drag-active');
    document.body.classList.remove('layer-drag-active');
    const vp = document.querySelector('#timeline-viewport');
    if (vp) { vp.style.overflowX = ''; vp.style.touchAction = ''; }
    clearDropHighlight();
    selectClip(state.clipEl);
    return;
  }

  exitDragMode(state);

  // ─── Horizontal drag commit ──────────────────────────────
  if (state.mode === 'h') {
    const dxPx = Math.abs(e.clientX - state.startClientX);
    if (dxPx < REVERT_THRESHOLD_PX || state.pendingStartTime == null) {
      // Too small → revert (visual only, no state change)
      state.clipEl.style.left = (state.startStartTime * state.pps) + 'px';
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      reselectByUrl(state.clip.url);
      return;
    }
    // 🆕 Clear snap visual before commit
    state.clipEl.classList.remove('snap-active');
    const g = document.querySelector('.layer-drag-snap-guide');
    if (g) g.style.display = 'none';

    // Commit
    state.clip.startTime = state.pendingStartTime;
    propagateToLinked(state.clip);
    state.clip.__trimmed = true;
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    reselectByUrl(state.clip.url);
    return;
  }
  // ─── Vertical drag commit ────────────────────────────────
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
  if (targetTrack) {
    commitVerticalMove(state, targetTrack);
  } else {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  }
}

// ═══════════════════════════════════════════════════════════════
//  OVERLAP HELPERS
// ═══════════════════════════════════════════════════════════════
function clipRange(clip) {
  const start = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const dur = Number.isFinite(clip.duration) ? clip.duration : 3;
  return { start: start, end: start + dur };
}

function trackHasOverlap(track, start, end, excludeClip) {
  if (!Array.isArray(track)) return false;
  for (let i = 0; i < track.length; i++) {
    const clip = track[i];
    if (clip === excludeClip) continue;
    const r = clipRange(clip);
    if (start < r.end && r.start < end) return true;
  }
  return false;
}

function findNearestFreeTrackIndex(list, targetIdx, start, end, excludeClip, skipIdx) {
  if (!Array.isArray(list)) return 0;

  if (targetIdx >= 0 && targetIdx < list.length &&
      targetIdx !== skipIdx &&
      !trackHasOverlap(list[targetIdx], start, end, excludeClip)) {
    return targetIdx;
  }

  for (let i = targetIdx + 1; i < list.length; i++) {
    if (i === skipIdx) continue;
    if (!trackHasOverlap(list[i], start, end, excludeClip)) return i;
  }

  for (let i = targetIdx - 1; i >= 0; i--) {
    if (i === skipIdx) continue;
    if (!trackHasOverlap(list[i], start, end, excludeClip)) return i;
  }

  list.push([]);
  return list.length - 1;
}

// ═══════════════════════════════════════════════════════════════
//  MIRROR LINKED CLIP TO SAME TRACK INDEX
// ═══════════════════════════════════════════════════════════════
function mirrorLinkedToTrackIndex(clip, targetIdx) {
  const appState = window.__appState;
  if (!appState || !clip || !clip.__linkedId) return false;

  const linkedId = clip.__linkedId;
  const isVisualSource = !!(clip.type && (
    clip.type.indexOf('video/') === 0 ||
    clip.type.indexOf('image/') === 0 ||
    clip.__textId ||
    clip.__stickerId
  ));
  const otherGroup = isVisualSource ? 'audio' : 'visual';
  const otherList = appState.timeline[otherGroup];
  if (!Array.isArray(otherList)) return false;

  let linkedClip = null;
  let linkedFromIdx = -1;
  for (let t = 0; t < otherList.length; t++) {
    const track = otherList[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].__linkedId === linkedId) {
        linkedClip = track[c];
        linkedFromIdx = t;
        break;
      }
    }
    if (linkedClip) break;
  }

  if (!linkedClip || linkedFromIdx < 0) return false;
  if (linkedFromIdx === targetIdx) return false;

  const oldTrack = otherList[linkedFromIdx];
  const idxInOld = oldTrack.indexOf(linkedClip);
  if (idxInOld >= 0) oldTrack.splice(idxInOld, 1);

  while (otherList.length <= targetIdx) otherList.push([]);

  const targetTrack = otherList[targetIdx];
  const t = Number.isFinite(linkedClip.startTime) ? linkedClip.startTime : 0;
  let insertIdx = targetTrack.length;
  for (let i = 0; i < targetTrack.length; i++) {
    const ci = targetTrack[i];
    const ct = ci && Number.isFinite(ci.startTime) ? ci.startTime : 0;
    if (t < ct) { insertIdx = i; break; }
  }
  targetTrack.splice(insertIdx, 0, linkedClip);

  return true;
}

// ═══════════════════════════════════════════════════════════════
//  CLIP DRAG COMMIT — OVERLAP-AWARE + LINKED MIRROR
// ═══════════════════════════════════════════════════════════════
function commitVerticalMove(state, targetTrackEl) {
  const appState = window.__appState;
  if (!appState) return;

  const targetGroup = targetTrackEl.dataset.group;
  if (targetGroup !== state.group) {
    showToast('Cannot mix visual & audio tracks');
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const list = appState.timeline[state.group];
  const srcTrack = list[state.startTrackIdx];
  if (!Array.isArray(srcTrack)) return;

  const idxInSrc = srcTrack.indexOf(state.clip);
  if (idxInSrc < 0) { document.dispatchEvent(new CustomEvent('editor:timeline-changed')); return; }

  const clipStart = Number.isFinite(state.clip.startTime) ? state.clip.startTime : 0;
  const clipDur = Number.isFinite(state.clip.duration) ? state.clip.duration : 3;
  const clipEnd = clipStart + clipDur;

  const intendedTargetIdx = Number(targetTrackEl.dataset.trackIndex);
  if (!Number.isFinite(intendedTargetIdx)) return;

  srcTrack.splice(idxInSrc, 1);

  const freeIdx = findNearestFreeTrackIndex(
    list,
    intendedTargetIdx,
    clipStart,
    clipEnd,
    state.clip,
    state.startTrackIdx
  );

  if (freeIdx === state.startTrackIdx) {
    let insertIdx = srcTrack.length;
    for (let i = 0; i < srcTrack.length; i++) {
      const ci = srcTrack[i];
      const ct = ci && Number.isFinite(ci.startTime) ? ci.startTime : 0;
      if (clipStart < ct) { insertIdx = i; break; }
    }
    srcTrack.splice(insertIdx, 0, state.clip);
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  while (list.length <= freeIdx) list.push([]);
  const dstTrack = list[freeIdx];

  let insertIdx = dstTrack.length;
  for (let i = 0; i < dstTrack.length; i++) {
    const ci = dstTrack[i];
    const ct = ci && Number.isFinite(ci.startTime) ? ci.startTime : 0;
    if (clipStart < ct) { insertIdx = i; break; }
  }
  dstTrack.splice(insertIdx, 0, state.clip);

  // Mirror linked clip
  let mirrored = false;
  if (state.clip.__linkedId) {
    mirrored = mirrorLinkedToTrackIndex(state.clip, freeIdx);
  }

  state.clip.__trimmed = true;
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  reselectByUrl(state.clip.url);

  const finalLabel = (state.group === 'visual' ? 'V' : 'A') + (freeIdx + 1);
  if (freeIdx === intendedTargetIdx) {
    showToast('Moved to ' + finalLabel + (mirrored ? ' (linked mirrored)' : ''));
  } else {
    showToast('Moved to ' + finalLabel + (mirrored ? ' (linked mirrored)' : ' (avoided overlap)'));
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function propagateToLinked(clip) {
  const appState = window.__appState;
  if (!appState || !clip.__linkedId) return;

  const linkedId = clip.__linkedId;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );

  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const other = track[c];
      if (other === clip) continue;
      if (other && other.__linkedId === linkedId) {
        other.startTime = clip.startTime;
      }
    }
  }
}

function enterDragMode() {
  if (!dragState) return;
  document.body.classList.add('layer-drag-active');
  dragState.clipEl.classList.add('layer-drag-active');
  selectClip(dragState.clipEl);
  const vp = document.querySelector('#timeline-viewport');
  if (vp) { vp.style.overflowX = 'hidden'; vp.style.touchAction = 'none'; }
}
// drag mode
function exitDragMode(state) {
  document.body.classList.remove('layer-drag-active');
  if (state && state.clipEl) {
    state.clipEl.classList.remove('layer-drag-active');
    state.clipEl.classList.remove('snap-active');
    state.clipEl.style.transition = '';
    state.clipEl.style.transform = '';
    state.clipEl.style.opacity = '';
    state.clipEl.style.zIndex = '';
  }
  // 🆕 Hide snap guide
  const g = document.querySelector('.layer-drag-snap-guide');
  if (g) g.style.display = 'none';

  clearDropHighlight();
  const vp = document.querySelector('#timeline-viewport');
  if (vp) { vp.style.overflowX = ''; vp.style.touchAction = ''; }
}

function clearDropHighlight() {
  document.querySelectorAll('.track.layer-drop-target, .track.layer-drop-target-blocked')
    .forEach(n => {
      n.classList.remove('layer-drop-target');
      n.classList.remove('layer-drop-target-blocked');
    });
}

function applyHorizontalDrag(clientX) {
  const s = dragState;
  if (!s) return;

  const dxPx = clientX - s.startClientX;
  let newStart = Math.max(0, s.startStartTime + dxPx / s.pps);

  // ─── 🆕 SNAP: Start edge + End edge ───
  const enterSec   = SNAP_ENTER_PX   / Math.max(1, s.pps);
  const releaseSec = SNAP_RELEASE_PX / Math.max(1, s.pps);
  const clipEnd = newStart + s.clipDuration;

  let snappedTo = null;
  let snapDelta = 0;

  if (s.snapTargets && s.snapTargets.length) {
    // Release check (hysteresis)
    if (s.activeSnap) {
      const checkVal = s.activeSnap.edge === 'start' ? newStart : clipEnd;
      const dist = Math.abs(checkVal - s.activeSnap.time);
      if (dist <= releaseSec) {
        snappedTo = s.activeSnap;
        snapDelta = s.activeSnap.time - checkVal;
      } else {
        s.activeSnap = null;
      }
    }

    // Find new snap
    if (!snappedTo) {
      let best = null;
      let bestDist = enterSec;
      let bestEdge = null;
      let bestDelta = 0;

      for (let i = 0; i < s.snapTargets.length; i++) {
        const t = s.snapTargets[i];
        const dStart = Math.abs(t.time - newStart);
        if (dStart < bestDist) {
          bestDist = dStart;
          best = t;
          bestEdge = 'start';
          bestDelta = t.time - newStart;
        }
        const dEnd = Math.abs(t.time - clipEnd);
        if (dEnd < bestDist) {
          bestDist = dEnd;
          best = t;
          bestEdge = 'end';
          bestDelta = t.time - clipEnd;
        }
      }

      if (best) {
        snappedTo = { time: best.time, type: best.type, clip: best.clip, edge: bestEdge };
        snapDelta = bestDelta;
        s.activeSnap = snappedTo;
      }
    }
  }

  if (snappedTo) {
    newStart = Math.max(0, newStart + snapDelta);
  }

  s.pendingStartTime = newStart;
  s.clipEl.style.transition = 'none';
  s.clipEl.style.left = (newStart * s.pps) + 'px';

  // ─── 🆕 Content width expand (clip "gaib" na ho) ───
  const contentEl = s.clipEl.parentElement;
  if (contentEl) {
    const clipW = s.clipEl.offsetWidth || 0;
    const needWidth = Math.max(
      contentEl.scrollWidth,
      (newStart * s.pps) + clipW + 80
    );
    contentEl.style.minWidth = needWidth + 'px';
  }

  // ─── 🆕 Visual feedback ───
  const guide = ensureSnapGuide();
  if (snappedTo) {
    s.clipEl.classList.add('snap-active');
    if (guide) {
      const guideX = 80 + snappedTo.time * s.pps; // LABEL_WIDTH = 80
      guide.style.left = guideX + 'px';
      guide.style.display = 'block';
    }
  } else {
    s.clipEl.classList.remove('snap-active');
    if (guide) guide.style.display = 'none';
  }
}

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
  if (targetTrack.dataset.group !== s.group) {
    targetTrack.classList.add('layer-drop-target-blocked');
    return;
  }

  const appState = window.__appState;
  const list = appState ? appState.timeline[s.group] : null;
  const idx = Number(targetTrack.dataset.trackIndex);
  const track = list && list[idx];

  const clipStart = s.clip.startTime;
  const clipEnd = clipStart + (s.clip.duration || 3);

  if (trackHasOverlap(track, clipStart, clipEnd, s.clip)) {
    targetTrack.classList.add('layer-drop-target-blocked');
  } else {
    targetTrack.classList.add('layer-drop-target');
  }
}

function selectClip(clipEl) {
  if (!clipEl) return;
  try {
    clipEl.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, button: 0
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
        return document.querySelector('.clip[data-track="V' + (t + 1) + '"][data-clip="' + c + '"]');
      }
    }
  }
  const aTracks = appState.timeline.audio || [];
  for (let t = 0; t < aTracks.length; t++) {
    const track = aTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].url === url) {
        return document.querySelector('.clip[data-track="A' + (t + 1) + '"][data-clip="' + c + '"]');
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
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:8px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0','transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 1400);
}

function forceCleanup() {
  if (!dragState) return;
  const state = dragState;
  dragState = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  if (state.mode && state.mode !== 'track') exitDragMode(state);
  clearDropHighlight();
}