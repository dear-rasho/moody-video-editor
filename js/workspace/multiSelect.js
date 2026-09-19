// ================================================================
//  js/workspace/multiSelect.js
//  Multi-select + Group drag (HORIZONTAL + VERTICAL).
//
//  - ⏩/⏪ range selection
//  - Drag → all clips move together
//  - Horizontal: with overlap prevention
//  - Vertical: move ALL to target track (only if it fits)
//  - Zero-start clamp
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';

const CSS_ID = 'multi-select-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .clip.multi-selected {
      outline: 2px dashed #ffcc00 !important;
      outline-offset: -3px;
      box-shadow: inset 0 0 12px rgba(255, 204, 0, 0.35) !important;
    }
    .clip.multi-selected.selected {
      outline: 2px solid var(--accent) !important;
      box-shadow:
        inset 0 0 12px rgba(255, 204, 0, 0.4),
        0 0 0 1px var(--accent) !important;
    }
    .multi-select-badge {
      position: absolute;
      top: -22px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffcc00;
      color: #000;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 800;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    body.multi-dragging,
    body.multi-dragging * {
      cursor: grabbing !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    .clip.multi-clamped {
      box-shadow:
        inset 0 0 12px rgba(255, 204, 0, 0.4),
        0 0 0 2px #ff6b6b !important;
    }
    /* 🆕 Target track highlight during vertical drag */
    .track.multi-target-track {
      outline: 2px dashed #00FF87 !important;
      outline-offset: -2px !important;
      background: rgba(0, 255, 135, 0.08) !important;
    }
    .track.multi-target-blocked {
      outline: 2px dashed #ff6b6b !important;
      outline-offset: -2px !important;
      background: rgba(255, 107, 107, 0.08) !important;
    }
  `;
  document.head.appendChild(s);
}

let multiSelected = [];
let dragState = null;
let viewport = null;

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initMultiSelect() {
  injectStyles();
  viewport = document.querySelector('#timeline-viewport');
  if (!viewport) {
    console.warn('[multiSelect] viewport not found');
    return;
  }

  document.addEventListener('editor:clip-selected', onSingleSelect);
  document.addEventListener('editor:clip-deselected', clearMultiSelection);
  document.addEventListener('editor:timeline-changed', refreshVisualClasses);

  viewport.addEventListener('pointerdown', onPointerDownCapture, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && multiSelected.length > 0) {
      clearMultiSelection();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════
export function getMultiSelected() { return multiSelected.slice(); }
export function isMultiActive() { return multiSelected.length > 1; }

export function clearMultiSelection() {
  multiSelected = [];
  refreshVisualClasses();
}

export function selectForward() { return applyRange('forward'); }
export function selectBackward() { return applyRange('backward'); }

// ═══════════════════════════════════════════════════════════════
//  RANGE SELECT
// ═══════════════════════════════════════════════════════════════
function applyRange(direction) {
  const anchor = getAnchorClip();
  if (!anchor) { showToast('Pehle koi clip select karo'); return false; }

  const appState = window.__appState;
  if (!appState) return false;

  const found = findClipLocation(anchor.clip, appState);
  if (!found) return false;

  const track = found.track;
  const sorted = track
    .map((c, idx) => ({ clip: c, idx: idx }))
    .filter(x => x.clip)
    .sort((a, b) => (a.clip.startTime || 0) - (b.clip.startTime || 0));

  const anchorPos = sorted.findIndex(x => x.clip === anchor.clip);
  if (anchorPos < 0) return false;

  const range = (direction === 'forward')
    ? sorted.slice(anchorPos)
    : sorted.slice(0, anchorPos + 1);

  multiSelected = range.map(x => x.clip);
  refreshVisualClasses();

  document.dispatchEvent(new CustomEvent('editor:multi-select-changed', {
    detail: { count: multiSelected.length, direction }
  }));

  showToast('✋ ' + multiSelected.length + ' clips selected — drag karo');
  return true;
}

function getAnchorClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const trackLabel = el.dataset.track;
  const clipIdx = Number(el.dataset.clip);
  if (!trackLabel || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const group = trackLabel[0] === 'A' ? 'audio' : 'visual';
  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const track = appState.timeline[group]?.[trackIdx];
  const clip = track?.[clipIdx];
  if (!clip) return null;
  return { clip, el, trackLabel };
}

function findClipLocation(clip, appState) {
  const groups = ['visual', 'audio'];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const list = appState.timeline[group] || [];
    for (let t = 0; t < list.length; t++) {
      const track = list[t];
      if (!Array.isArray(track)) continue;
      if (track.indexOf(clip) >= 0) {
        return {
          group,
          track,
          trackIdx: t,
          trackLabel: (group === 'audio' ? 'A' : 'V') + (t + 1)
        };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  VISUAL REFRESH
// ═══════════════════════════════════════════════════════════════
function refreshVisualClasses() {
  document.querySelectorAll('.clip.multi-selected').forEach(el => el.classList.remove('multi-selected'));
  document.querySelectorAll('.multi-select-badge').forEach(el => el.remove());

  if (multiSelected.length === 0) return;

  const appState = window.__appState;
  if (appState) {
    multiSelected = multiSelected.filter(c => findClipLocation(c, appState));
  }
  if (multiSelected.length === 0) return;

  const allClips = document.querySelectorAll('.clip');
  for (let i = 0; i < allClips.length; i++) {
    const clip = getClipFromElement(allClips[i]);
    if (clip && multiSelected.indexOf(clip) >= 0) {
      allClips[i].classList.add('multi-selected');
    }
  }

  if (multiSelected.length > 1) {
    const anchor = multiSelected[0];
    for (let i = 0; i < allClips.length; i++) {
      if (getClipFromElement(allClips[i]) === anchor) {
        const badge = document.createElement('span');
        badge.className = 'multi-select-badge';
        badge.textContent = multiSelected.length + ' clips';
        allClips[i].appendChild(badge);
        break;
      }
    }
  }
}

function getClipFromElement(el) {
  const appState = window.__appState;
  if (!appState || !el) return null;
  const label = el.dataset.track;
  const idx = Number(el.dataset.clip);
  if (!label || !Number.isFinite(idx)) return null;
  const group = label[0] === 'A' ? 'audio' : 'visual';
  const trackIdx = Number(label.slice(1)) - 1;
  return appState.timeline[group]?.[trackIdx]?.[idx] || null;
}

function onSingleSelect() {
  setTimeout(() => {
    const el = document.querySelector('.clip.selected');
    if (!el) { clearMultiSelection(); return; }
    const clip = getClipFromElement(el);
    if (!clip || multiSelected.indexOf(clip) < 0) clearMultiSelection();
  }, 0);
}

// ═══════════════════════════════════════════════════════════════
//  POINTER DOWN — start drag
// ═══════════════════════════════════════════════════════════════
function onPointerDownCapture(e) {
  if (multiSelected.length < 2) return;
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

  if (e.target.closest && (
       e.target.closest('.trim-handle') ||
       e.target.closest('.kf-marker') ||
       e.target.closest('.transition-marker') ||
       e.target.closest('.track-label') ||
       e.target.closest('.layer-toggle'))) return;

  const clipEl = e.target.closest && e.target.closest('.clip');
  if (!clipEl) return;

  const clickedClip = getClipFromElement(clipEl);
  if (!clickedClip || multiSelected.indexOf(clickedClip) < 0) return;

  e.stopImmediatePropagation();
  e.preventDefault();

  const appState = window.__appState;
  const loc = findClipLocation(clickedClip, appState);
  if (!loc) return;

  const pps = getPixelsPerSecond();

  const items = multiSelected.map(clip => {
    const l = findClipLocation(clip, appState);
    return {
      clip,
      startTime: Number.isFinite(clip.startTime) ? clip.startTime : 0,
      duration: Number.isFinite(clip.duration) ? clip.duration : 0,
      newStart: null,
      el: l ? findClipEl(clip) : null
    };
  });

  // Compute horizontal limits against SOURCE track
  const limits = computeHorizontalLimits(items, loc.track, loc.trackIdx, loc.group);
  const minStart = Math.min.apply(null, items.map(it => it.startTime));
  if (-minStart > limits.minDelta) limits.minDelta = -minStart;

  dragState = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    pps,
    items,
    limits,
    finalDelta: 0,
    sourceGroup: loc.group,
    sourceTrackIdx: loc.trackIdx,
    sourceTrack: loc.track,
    targetTrackIdx: loc.trackIdx,
    targetFits: true,
    moved: false
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.body.classList.add('multi-dragging');
}

// ═══════════════════════════════════════════════════════════════
//  HORIZONTAL LIMITS (against a specific track)
// ═══════════════════════════════════════════════════════════════
function computeHorizontalLimits(items, track, trackIdx, group) {
  let minDelta = -Infinity;
  let maxDelta = Infinity;
  const groupSet = new Set(items.map(it => it.clip));

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const startTime = it.startTime;
    const dur = it.duration;
    const endTime = startTime + dur;

    for (let k = 0; k < track.length; k++) {
      const other = track[k];
      if (groupSet.has(other)) continue;

      const oStart = Number.isFinite(other.startTime) ? other.startTime : 0;
      const oDur = Number.isFinite(other.duration) ? other.duration : 0;
      const oEnd = oStart + oDur;

      if (oStart >= endTime) {
        const limit = oStart - endTime;
        if (limit < maxDelta) maxDelta = limit;
      } else if (oEnd <= startTime) {
        const limit = oEnd - startTime;
        if (limit > minDelta) minDelta = limit;
      }
    }
  }
  return { minDelta, maxDelta };
}

// ═══════════════════════════════════════════════════════════════
//  TARGET TRACK DETECTION
// ═══════════════════════════════════════════════════════════════
function findTargetTrack(clientY, group) {
  const container = group === 'visual'
    ? document.querySelector('#visual-tracks')
    : document.querySelector('#audio-tracks');
  if (!container) return -1;

  const tracks = container.querySelectorAll('.track');
  for (let i = 0; i < tracks.length; i++) {
    const rect = tracks[i].getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return Number(tracks[i].dataset.trackIndex);
    }
  }
  return -1;
}

function checkFitsOnTrack(items, targetTrack, deltaSec) {
  const groupSet = new Set(items.map(it => it.clip));

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const ns = it.startTime + deltaSec;
    const ne = ns + it.duration;

    for (let k = 0; k < targetTrack.length; k++) {
      const other = targetTrack[k];
      if (groupSet.has(other)) continue;

      const oStart = Number.isFinite(other.startTime) ? other.startTime : 0;
      const oDur = Number.isFinite(other.duration) ? other.duration : 0;
      const oEnd = oStart + oDur;

      if (ns < oEnd && oStart < ne) return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  POINTER MOVE
// ═══════════════════════════════════════════════════════════════
function onPointerMove(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;

  if (!dragState.moved) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    dragState.moved = true;
  }

  if (e.cancelable) e.preventDefault();

  const appState = window.__appState;
  if (!appState) return;

  // ─── Detect target track ─────────────────────────────────
  let targetIdx = findTargetTrack(e.clientY, dragState.sourceGroup);
  if (targetIdx < 0) targetIdx = dragState.sourceTrackIdx;

  // Same group's tracks only
  const list = appState.timeline[dragState.sourceGroup];
  const targetTrack = list?.[targetIdx];

  // ─── Compute horizontal limits against TARGET track ──────
  let limits;
  if (targetIdx === dragState.sourceTrackIdx) {
    limits = dragState.limits;
  } else if (Array.isArray(targetTrack)) {
    limits = computeHorizontalLimits(dragState.items, targetTrack, targetIdx, dragState.sourceGroup);
  } else {
    limits = { minDelta: -Infinity, maxDelta: Infinity };
  }
  const minStart = Math.min.apply(null, dragState.items.map(it => it.startTime));
  if (-minStart > limits.minDelta) limits.minDelta = -minStart;

  // ─── Apply horizontal delta ──────────────────────────────
  let rawDelta = dx / dragState.pps;
  let clamped = rawDelta;
  if (clamped < limits.minDelta) clamped = limits.minDelta;
  if (clamped > limits.maxDelta) clamped = limits.maxDelta;
  dragState.finalDelta = clamped;

  // ─── Vertical fit check ──────────────────────────────────
  let fits = true;
  if (targetIdx !== dragState.sourceTrackIdx && Array.isArray(targetTrack)) {
    fits = checkFitsOnTrack(dragState.items, targetTrack, clamped);
  }
  if (!fits) {
    // Fallback to source track
    targetIdx = dragState.sourceTrackIdx;
    const srcTrack = dragState.sourceTrack;
    limits = computeHorizontalLimits(dragState.items, srcTrack, dragState.sourceTrackIdx, dragState.sourceGroup);
    if (-minStart > limits.minDelta) limits.minDelta = -minStart;
    rawDelta = dx / dragState.pps;
    clamped = rawDelta;
    if (clamped < limits.minDelta) clamped = limits.minDelta;
    if (clamped > limits.maxDelta) clamped = limits.maxDelta;
    dragState.finalDelta = clamped;
  }

  dragState.targetTrackIdx = targetIdx;
  dragState.targetFits = fits;

  // ─── Visuals ─────────────────────────────────────────────
  // Track highlights
  document.querySelectorAll('.track.multi-target-track, .track.multi-target-blocked')
    .forEach(n => n.classList.remove('multi-target-track', 'multi-target-blocked'));

  if (targetIdx !== dragState.sourceTrackIdx) {
    const trackEl = document.querySelector(
      '.track[data-group="' + dragState.sourceGroup + '"][data-track-index="' + targetIdx + '"]'
    );
    if (trackEl) {
      if (fits) trackEl.classList.add('multi-target-track');
      else trackEl.classList.add('multi-target-blocked');
    }
  }

  // Clip positions
  const clampedBad = Math.abs(clamped - rawDelta) > 0.001;
  for (let i = 0; i < dragState.items.length; i++) {
    const it = dragState.items[i];
    const ns = it.startTime + clamped;
    it.newStart = ns;
    if (it.el) {
      it.el.style.left = (ns * dragState.pps) + 'px';
      if (clampedBad) it.el.classList.add('multi-clamped');
      else it.el.classList.remove('multi-clamped');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  POINTER UP — commit
// ═══════════════════════════════════════════════════════════════
function onPointerUp(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  const s = dragState;
  dragState = null;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  document.body.classList.remove('multi-dragging');
  document.querySelectorAll('.track.multi-target-track, .track.multi-target-blocked')
    .forEach(n => n.classList.remove('multi-target-track', 'multi-target-blocked'));

  for (let i = 0; i < s.items.length; i++) {
    if (s.items[i].el) s.items[i].el.classList.remove('multi-clamped');
  }

  const appState = window.__appState;
  if (!appState) return;

  const deltaChanged = Math.abs(s.finalDelta) > 0.001;
  const trackChanged = s.targetTrackIdx !== s.sourceTrackIdx && s.targetFits;

  if (!s.moved || (!deltaChanged && !trackChanged)) {
    // Nothing actually moved — reset
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    return;
  }

  const list = appState.timeline[s.sourceGroup];
  const srcTrack = list[s.sourceTrackIdx];
  if (!Array.isArray(srcTrack)) return;

  const groupSet = new Set(s.items.map(it => it.clip));

  // Remove group clips from source track
  for (let i = srcTrack.length - 1; i >= 0; i--) {
    if (groupSet.has(srcTrack[i])) srcTrack.splice(i, 1);
  }

  // Update startTime + (optionally) move to target
  const targetTrackIdx = trackChanged ? s.targetTrackIdx : s.sourceTrackIdx;

  // Ensure target track exists
  while (list.length <= targetTrackIdx) list.push([]);
  const destTrack = list[targetTrackIdx];
  if (!Array.isArray(destTrack)) return;

  for (let i = 0; i < s.items.length; i++) {
    const it = s.items[i];
    it.clip.startTime = (it.newStart != null) ? it.newStart : (it.startTime + s.finalDelta);
    it.clip.__trimmed = true;
    destTrack.push(it.clip);
  }

  // Sort dest track by startTime
  destTrack.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  if (trackChanged && deltaChanged) {
    showToast('✋ ' + s.items.length + ' clips moved (V' + (targetTrackIdx + 1) + ' + time)');
  } else if (trackChanged) {
    showToast('✋ ' + s.items.length + ' clips → V' + (targetTrackIdx + 1));
  } else {
    showToast('✋ ' + s.items.length + ' clips moved by ' + s.finalDelta.toFixed(2) + 's');
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function findClipEl(clip) {
  const appState = window.__appState;
  if (!appState) return null;
  const groups = ['visual', 'audio'];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const list = appState.timeline[group] || [];
    for (let t = 0; t < list.length; t++) {
      const track = list[t];
      if (!Array.isArray(track)) continue;
      const idx = track.indexOf(clip);
      if (idx >= 0) {
        const label = (group === 'audio' ? 'A' : 'V') + (t + 1);
        return document.querySelector(
          '.clip[data-track="' + label + '"][data-clip="' + idx + '"]'
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
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:99999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0','transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 1600);
}