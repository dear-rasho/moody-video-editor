// ================================================================
//  js/workspace/layerDrag.js
//  - Strict NO-OVERLAP within any track → RIPPLE INSERT
//  - Horizontal drag → snap to start/end/playhead
//  - Vertical drag → insert between layers OR ripple into target
//  - Track label drag → reorder (mirror linked audio)
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';

const DRAG_THRESHOLD_PX = 8;
const REVERT_THRESHOLD_PX = 12;
const CSS_ID = 'layer-drag-styles';

const SNAP_ENTER_PX = 14;
const SNAP_RELEASE_PX = 28;
const INSERT_ZONE_PX = 14;

let dragState = null;
let globalInited = false;

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

    .clip.snap-active {
      outline-color: #22c55e !important;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4) !important;
    }
    /* 🆕 Ripple mode — clip highlights when drop will shift others */
    .clip.ripple-active {
      outline-color: #f59e0b !important;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.45) !important;
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
    .trim-snap-guide.ripple-guide {
      background: #f59e0b;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.95);
    }

    .insert-indicator {
      position: absolute;
      left: 0;
      right: 0;
      height: 4px;
      background: #22c55e;
      box-shadow:
        0 0 12px rgba(34, 197, 94, 0.95),
        0 0 4px rgba(34, 197, 94, 1);
      z-index: 9999;
      pointer-events: none;
      display: none;
      animation: insert-pulse 1.2s ease-in-out infinite;
    }
    @keyframes insert-pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.65; }
    }
    .insert-indicator::before,
    .insert-indicator::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #22c55e;
      transform: translateY(-50%);
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.95);
    }
    .insert-indicator::before { left: 6px; }
    .insert-indicator::after  { right: 6px; }
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
//  🆕 RIPPLE INSERT — strictly no overlap
//
//  Inserts clip at newStart within track. If overlapping clips
//  exist, they (and everything after) shift forward by the
//  needed amount. Linked clips in other tracks shift too.
// ═══════════════════════════════════════════════════════════════
function rippleInsertTrack(list, trackIdx, clip, newStart, group) {
  const appState = window.__appState;
  if (!appState) return;

  if (!Array.isArray(list)) return;
  while (list.length <= trackIdx) list.push([]);

  const track = list[trackIdx];
  if (!Array.isArray(track)) return;

  const dur = Number.isFinite(clip.duration) ? clip.duration : 3;
  const start = Math.max(0, Number.isFinite(newStart) ? newStart : 0);
  const end = start + dur;

  // ═══════════════════════════════════════════════════════════
  //  🆕 FIX: Remove clip from EVERY track in this list first
  //  (was only removing from target → caused duplication)
  // ═══════════════════════════════════════════════════════════
  for (let t = 0; t < list.length; t++) {
    const tr = list[t];
    if (!Array.isArray(tr)) continue;
    const idx = tr.indexOf(clip);
    if (idx >= 0) {
      tr.splice(idx, 1);
      break;
    }
  }

  // Sort remaining by startTime
  track.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  // Split into before / after
  const after = [];
  for (let i = 0; i < track.length; i++) {
    const c = track[i];
    const s = Number.isFinite(c.startTime) ? c.startTime : 0;
    const d = Number.isFinite(c.duration) ? c.duration : 0;
    const e = s + d;
    if (e > start) after.push(c);
  }

  // Compute shift needed
  let shift = 0;
  if (after.length > 0) {
    const firstStart = Number.isFinite(after[0].startTime) ? after[0].startTime : 0;
    if (firstStart < end) {
      shift = end - firstStart;
    }
  }

  // Apply shift + record linked ids
  const shiftMap = new Map();
  if (shift > 0) {
    for (let i = 0; i < after.length; i++) {
      const c = after[i];
      c.startTime = (Number.isFinite(c.startTime) ? c.startTime : 0) + shift;
      if (c.__linkedId) shiftMap.set(c.__linkedId, shift);
    }
  }

  // Insert clip
  clip.startTime = start;
  track.push(clip);
  track.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  // Apply shift to linked clips (other group)
  if (shiftMap.size > 0) {
    const otherGroup = group === 'visual' ? 'audio' : 'visual';
    const otherList = appState.timeline[otherGroup] || [];
    for (let t = 0; t < otherList.length; t++) {
      const oTrack = otherList[t];
      if (!Array.isArray(oTrack)) continue;
      for (let i = 0; i < oTrack.length; i++) {
        const oc = oTrack[i];
        if (oc && oc.__linkedId && shiftMap.has(oc.__linkedId)) {
          oc.startTime = (Number.isFinite(oc.startTime) ? oc.startTime : 0) +
                         shiftMap.get(oc.__linkedId);
        }
      }
    }
  }

  // Align the moved clip's own linked partner to its new position
  if (clip.__linkedId) {
    const otherGroup = group === 'visual' ? 'audio' : 'visual';
    const otherList = appState.timeline[otherGroup] || [];
    for (let t = 0; t < otherList.length; t++) {
      const oTrack = otherList[t];
      if (!Array.isArray(oTrack)) continue;
      for (let i = 0; i < oTrack.length; i++) {
        const oc = oTrack[i];
        if (oc && oc.__linkedId === clip.__linkedId) {
          oc.startTime = start;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  SNAP HELPERS
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
      targets.push({ time: s,     type: 'start', clip: clip });
      targets.push({ time: s + d, type: 'end',   clip: clip });
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

// ═══════════════════════════════════════════════════════════════
//  INSERT INDICATOR
// ═══════════════════════════════════════════════════════════════
function detectInsertZone(clientX, clientY, group) {
  const container = group === 'visual'
    ? document.querySelector('#visual-tracks')
    : document.querySelector('#audio-tracks');
  if (!container) return null;

  const tracks = container.querySelectorAll('.track');
  if (!tracks.length) return null;

  for (let i = 0; i < tracks.length; i++) {
    const trackEl = tracks[i];
    const rect = trackEl.getBoundingClientRect();
    const trackIdx = Number(trackEl.dataset.trackIndex);

    if (Math.abs(clientY - rect.top) <= INSERT_ZONE_PX) {
      return { group: group, insertIndex: trackIdx + 1, y: rect.top, container: container };
    }
  }

  const lastTrack = tracks[tracks.length - 1];
  const lastRect = lastTrack.getBoundingClientRect();
  const lastIdx = Number(lastTrack.dataset.trackIndex);
  if (Math.abs(clientY - lastRect.bottom) <= INSERT_ZONE_PX) {
    return { group: group, insertIndex: lastIdx, y: lastRect.bottom, container: container };
  }

  return null;
}

function showInsertIndicator(zone) {
  if (!zone || !zone.container) return;
  const container = zone.container;

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  let line = container.querySelector('.insert-indicator');
  if (!line) {
    line = document.createElement('div');
    line.className = 'insert-indicator';
    container.appendChild(line);
  }

  const containerRect = container.getBoundingClientRect();
  line.style.top = (zone.y - containerRect.top) + 'px';
  line.style.display = 'block';
}

function clearInsertIndicator() {
  document.querySelectorAll('.insert-indicator').forEach(n => {
    n.style.display = 'none';
  });
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
    snapTargets: getDragSnapTargets(clip),
    activeSnap: null,
    clipDuration: Number.isFinite(clip.duration) ? clip.duration : 3,
    insertZone: null
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

  // Simple click
  if (!state.mode) {
    state.clipEl.classList.remove('layer-drag-active');
    document.body.classList.remove('layer-drag-active');
    const vp = document.querySelector('#timeline-viewport');
    if (vp) { vp.style.overflowX = ''; vp.style.touchAction = ''; }
    clearDropHighlight();
    clearInsertIndicator();
    selectClip(state.clipEl);
    return;
  }

  // Insert between layers
  if (state.mode === 'v' && state.insertZone) {
    exitDragMode(state);
    clearInsertIndicator();
    commitInsertBetween(state, state.insertZone);
    return;
  }

  exitDragMode(state);
  clearInsertIndicator();

  // 🆕 Horizontal commit → RIPPLE INSERT (strict no overlap)
  if (state.mode === 'h') {
    const dxPx = Math.abs(e.clientX - state.startClientX);
    if (dxPx < REVERT_THRESHOLD_PX || state.pendingStartTime == null) {
      state.clipEl.style.left = (state.startStartTime * state.pps) + 'px';
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      reselectByUrl(state.clip.url);
      return;
    }

    const appState = window.__appState;
    const list = appState ? appState.timeline[state.group] : null;
    if (!list) return;

    rippleInsertTrack(list, state.startTrackIdx, state.clip, state.pendingStartTime, state.group);
    state.clip.__trimmed = true;

    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    reselectByUrl(state.clip.url);
    return;
  }

  // 🆕 Vertical commit → RIPPLE INSERT in target track
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  const targetTrackEl = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
  if (!targetTrackEl) {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const targetGroup = targetTrackEl.dataset.group;
  if (targetGroup !== state.group) {
    showToast('Cannot mix visual & audio tracks');
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const appState = window.__appState;
  const list = appState ? appState.timeline[state.group] : null;
  if (!list) return;

  const targetIdx = Number(targetTrackEl.dataset.trackIndex);
  if (!Number.isFinite(targetIdx)) return;

  const clipStart = Number.isFinite(state.clip.startTime) ? state.clip.startTime : 0;

  // Ripple insert into target track (removes from source implicitly)
  rippleInsertTrack(list, targetIdx, state.clip, clipStart, state.group);
  state.clip.__trimmed = true;

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  reselectByUrl(state.clip.url);

  const label = (state.group === 'visual' ? 'V' : 'A') + (targetIdx + 1);
  showToast('Moved to ' + label + ' (no-overlap enforced)');
}

// ═══════════════════════════════════════════════════════════════
//  INSERT BETWEEN LAYERS (RIPPLE at track level)
// ═══════════════════════════════════════════════════════════════
function commitInsertBetween(state, zone) {
  const appState = window.__appState;
  if (!appState) return;

  const group = state.group;
  const list = appState.timeline[group];
  if (!Array.isArray(list)) return;

  const sourceTrackIdx = state.startTrackIdx;
  const sourceClipIdx = state.startClipIdx;
  const sourceTrack = list[sourceTrackIdx];
  if (!Array.isArray(sourceTrack)) return;

  const clip = sourceTrack[sourceClipIdx];
  if (!clip) return;

  let linkedClip = null;
  let linkedTrackIdx = -1;
  if (clip.__linkedId) {
    const otherGroup = group === 'visual' ? 'audio' : 'visual';
    const otherList = appState.timeline[otherGroup];
    if (Array.isArray(otherList)) {
      for (let t = 0; t < otherList.length; t++) {
        const track = otherList[t];
        if (!Array.isArray(track)) continue;
        for (let c = 0; c < track.length; c++) {
          if (track[c] && track[c].__linkedId === clip.__linkedId) {
            linkedClip = track[c];
            linkedTrackIdx = t;
            break;
          }
        }
        if (linkedClip) break;
      }
    }
  }
  sourceTrack.splice(sourceClipIdx, 1);

  let targetIdx = Math.max(0, Math.min(zone.insertIndex, list.length));
  list.splice(targetIdx, 0, [clip]);

  // 🆕 Move linked clip (remove from old, add to new)
  if (linkedClip) {
    const otherGroup = group === 'visual' ? 'audio' : 'visual';
    const otherList = appState.timeline[otherGroup];
    if (Array.isArray(otherList)) {
      // Find and remove linked clip from wherever it is
      for (let t = 0; t < otherList.length; t++) {
        const oTrack = otherList[t];
        if (!Array.isArray(oTrack)) continue;
        const idx = oTrack.indexOf(linkedClip);
        if (idx >= 0) {
          oTrack.splice(idx, 1);
          break;
        }
      }
      // Insert into the corresponding track index
      while (otherList.length < targetIdx) otherList.push([]);
      otherList.splice(targetIdx, 0, [linkedClip]);
    }
  }
  state.clip.__trimmed = true;
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  const layerLabel = (group === 'visual' ? 'V' : 'A') + (targetIdx + 1);
  showToast('Inserted as new layer ' + layerLabel);

  setTimeout(() => reselectByUrl(state.clip.url), 60);
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

function exitDragMode(state) {
  document.body.classList.remove('layer-drag-active');
  if (state && state.clipEl) {
    state.clipEl.classList.remove('layer-drag-active');
    state.clipEl.classList.remove('snap-active');
    state.clipEl.classList.remove('ripple-active');
    state.clipEl.style.transition = '';
    state.clipEl.style.transform = '';
    state.clipEl.style.opacity = '';
    state.clipEl.style.zIndex = '';
  }
  const g = document.querySelector('.layer-drag-snap-guide');
  if (g) {
    g.style.display = 'none';
    g.classList.remove('ripple-guide');
  }

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

// ═══════════════════════════════════════════════════════════════
//  🆕 HORIZONTAL DRAG — with overlap detection
// ═══════════════════════════════════════════════════════════════
function applyHorizontalDrag(clientX) {
  const s = dragState;
  if (!s) return;

  const dxPx = clientX - s.startClientX;
  let newStart = Math.max(0, s.startStartTime + dxPx / s.pps);

  const enterSec   = SNAP_ENTER_PX   / Math.max(1, s.pps);
  const releaseSec = SNAP_RELEASE_PX / Math.max(1, s.pps);
  const clipEnd = newStart + s.clipDuration;

  let snappedTo = null;
  let snapDelta = 0;

  if (s.snapTargets && s.snapTargets.length) {
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
    if (!snappedTo) {
      let best = null, bestDist = enterSec, bestEdge = null, bestDelta = 0;
      for (let i = 0; i < s.snapTargets.length; i++) {
        const t = s.snapTargets[i];
        const dStart = Math.abs(t.time - newStart);
        if (dStart < bestDist) {
          bestDist = dStart; best = t; bestEdge = 'start';
          bestDelta = t.time - newStart;
        }
        const dEnd = Math.abs(t.time - clipEnd);
        if (dEnd < bestDist) {
          bestDist = dEnd; best = t; bestEdge = 'end';
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

  if (snappedTo) newStart = Math.max(0, newStart + snapDelta);

  s.pendingStartTime = newStart;
  s.clipEl.style.transition = 'none';
  s.clipEl.style.left = (newStart * s.pps) + 'px';

  // Content width expand
  const contentEl = s.clipEl.parentElement;
  if (contentEl) {
    const clipW = s.clipEl.offsetWidth || 0;
    const needWidth = Math.max(
      contentEl.scrollWidth,
      (newStart * s.pps) + clipW + 80
    );
    contentEl.style.minWidth = needWidth + 'px';
  }

  // 🆕 Detect if drop will cause ripple (overlap check)
  let willRipple = false;
  const appState = window.__appState;
  if (appState) {
    const srcList = appState.timeline[s.group] || [];
    const srcTrack = srcList[s.startTrackIdx];
    if (Array.isArray(srcTrack)) {
      const newEnd = newStart + s.clipDuration;
      for (let i = 0; i < srcTrack.length; i++) {
        const c = srcTrack[i];
        if (c === s.clip) continue;
        const cs = Number.isFinite(c.startTime) ? c.startTime : 0;
        const cd = Number.isFinite(c.duration) ? c.duration : 0;
        const ce = cs + cd;
        if (newStart < ce && cs < newEnd) { willRipple = true; break; }
      }
    }
  }

  const guide = ensureSnapGuide();

  // 🆕 Priority: ripple (orange) > snap (green) > none
  if (willRipple) {
    s.clipEl.classList.remove('snap-active');
    s.clipEl.classList.add('ripple-active');
    if (guide) {
      const guideX = 80 + newStart * s.pps;
      guide.style.left = guideX + 'px';
      guide.style.display = 'block';
      guide.classList.add('ripple-guide');
    }
  } else if (snappedTo) {
    s.clipEl.classList.remove('ripple-active');
    s.clipEl.classList.add('snap-active');
    if (guide) {
      const guideX = 80 + snappedTo.time * s.pps;
      guide.style.left = guideX + 'px';
      guide.style.display = 'block';
      guide.classList.remove('ripple-guide');
    }
  } else {
    s.clipEl.classList.remove('snap-active');
    s.clipEl.classList.remove('ripple-active');
    if (guide) {
      guide.style.display = 'none';
      guide.classList.remove('ripple-guide');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  VERTICAL DRAG
// ═══════════════════════════════════════════════════════════════
function applyVerticalDrag(clientX, clientY) {
  const s = dragState;
  if (!s) return;
  const dy = clientY - s.startClientY;
  s.clipEl.style.transition = 'none';
  s.clipEl.style.transform = 'translateY(' + dy + 'px)';
  s.clipEl.style.opacity = '0.6';
  clearDropHighlight();

  const insertZone = detectInsertZone(clientX, clientY, s.group);
  if (insertZone) {
    s.insertZone = insertZone;
    showInsertIndicator(insertZone);
    return;
  }
  s.insertZone = null;
  clearInsertIndicator();

  const elUnder = document.elementFromPoint(clientX, clientY);
  const targetTrack = elUnder && elUnder.closest ? elUnder.closest('.track') : null;
  if (!targetTrack) return;
  if (targetTrack.dataset.group !== s.group) {
    targetTrack.classList.add('layer-drop-target-blocked');
    return;
  }

  // 🆕 Always show green (ripple will handle overlap) — unless same track
  const targetIdx = Number(targetTrack.dataset.trackIndex);
  if (targetIdx === s.startTrackIdx) {
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
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 1600);
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
  clearInsertIndicator();
}