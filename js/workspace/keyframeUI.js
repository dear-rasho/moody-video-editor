// ================================================================
//  js/workspace/keyframeUI.js
//  Keyframe button + clickable markers + DRAGGABLE markers.
//  🆕 Markers can be dragged horizontally to change keyframe time.
//     Clamped within the clip's duration (start → end).
// ================================================================

import {
  ANIMATABLE_PROPS, getPropKeys, getKeyframes,
  setKeyframe, removeKeyframe, hasAnyKeyframeAt,
  getPropsWithKeyframeAt, removeAllKeyframesAtTime
} from './keyframeStore.js';

const CSS_ID = 'keyframe-ui-styles';

let btnEl = null;
let selectedKf = null;
let isDragging = false;   // 🆕 suppress redraw during drag

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    #keyframe-btn {
      position: relative;
      font-size: 18px;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    #keyframe-btn.has-kf {
      color: #4f9dff;
      border-color: #4f9dff;
      background: rgba(79,157,255,0.12);
    }
    #keyframe-btn.no-kf {
      color: #eaeaea;
    }
    #keyframe-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    #keyframe-btn .kf-sign {
      position: absolute;
      right: 4px;
      bottom: 2px;
      font-size: 10px;
      line-height: 1;
      font-weight: 700;
      pointer-events: none;
    }
    #keyframe-btn.has-kf .kf-sign { color: #4f9dff; }
    #keyframe-btn.no-kf  .kf-sign { color: #eaeaea; }

    .kf-marker-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 25;
    }

    .kf-marker {
      position: absolute;
      top: 2px;
      width: 12px;
      height: 12px;
      background: #4f9dff;
      border: 1.5px solid #fff;
      transform: translateX(-50%) rotate(45deg);
      box-shadow: 0 0 4px rgba(79,157,255,0.6);
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
      transition: background 0.12s ease, box-shadow 0.12s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    .kf-marker:hover {
      background: #7ab5ff;
    }
    .kf-marker:active {
      cursor: grabbing;
    }
    .kf-marker.active {
      background: #ffd166;
      border-color: #000;
    }
    .kf-marker.selected {
      background: #ff3b3b;
      border-color: #fff;
      box-shadow: 0 0 0 2px #ff3b3b, 0 0 12px rgba(255,59,59,0.9);
      transform: translateX(-50%) rotate(45deg) scale(1.15);
      z-index: 30;
    }

    /* 🆕 Dragging state */
    .kf-marker.dragging {
      background: #22c55e !important;
      border-color: #fff !important;
      box-shadow: 0 0 0 2px #22c55e, 0 0 16px rgba(34,197,94,0.9) !important;
      transform: translateX(-50%) rotate(45deg) scale(1.3) !important;
      z-index: 40 !important;
      cursor: grabbing !important;
      transition: none !important;
    }

    body.kf-dragging,
    body.kf-dragging * {
      cursor: grabbing !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }

    /* 🆕 Time tooltip during drag */
    .kf-drag-tooltip {
      position: fixed;
      transform: translate(-50%, -100%);
      background: #22c55e;
      color: #000;
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      z-index: 100002;
      pointer-events: none;
      font-family: inherit;
      letter-spacing: 0.02em;
    }
    .kf-drag-tooltip::after {
      content: '';
      position: absolute;
      left: 50%; top: 100%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #22c55e;
    }
  `;
  document.head.appendChild(s);
}

export function initKeyframeUI(buttonEl) {
  injectStyles();
  btnEl = buttonEl || document.querySelector('#keyframe-btn');
  if (!btnEl) return;

  btnEl.addEventListener('click', onButtonClick);

  document.addEventListener('playback:tick', refresh);
  document.addEventListener('playback:state', refresh);
  document.addEventListener('editor:timeline-changed', refresh);
  document.addEventListener('keyframe:changed', refresh);
  document.addEventListener('transform:changed', refresh);

  document.addEventListener('editor:clip-selected', refresh);

  document.addEventListener('playback:tick', scheduleMarkers);
  document.addEventListener('editor:timeline-changed', scheduleMarkers);
  document.addEventListener('keyframe:changed', scheduleMarkers);
  document.addEventListener('editor:clip-selected', scheduleMarkers);

  refresh();
  scheduleMarkers();
}

export function getSelectedKeyframe() {
  return selectedKf;
}

export function clearKeyframeSelection() {
  selectedKf = null;
  document.querySelectorAll('.kf-marker.selected').forEach(n => n.classList.remove('selected'));
  window.__selectedKeyframe = null;
  document.dispatchEvent(new CustomEvent('keyframe:selected', { detail: null }));
}

function getSelectedClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'V') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return { clip, trackIdx, clipIdx, el };
}

function getPlayheadTime() {
  const eng = window.__playbackEngine;
  return eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
}
// ═══════════════════════════════════════════════════════════════
//  🆕 CAPTURE PROPERTIES (from text/sticker/transform state)
//
//  Text clip → textState se positionX/Y, scale, rotation
//  Sticker clip → stickerState se x, y, scale, rotation
//  Normal clip → __transform
// ═══════════════════════════════════════════════════════════════
function captureProperties(clip) {
  const props = {};
  const base = clip.__transform || {};

  // 🆕 Text clip — pull from textState
  const textState = (clip.__textId && clip.textState) ? clip.textState : null;
  const stickerState = (clip.__stickerId && clip.stickerState) ? clip.stickerState : null;

  ANIMATABLE_PROPS.forEach(p => {
    let v = base[p];

    // Text clip: override from textState
    if (textState) {
      if (p === 'x' && textState.positionX != null) v = textState.positionX;
      else if (p === 'y' && textState.positionY != null) v = textState.positionY;
      else if (p === 'scale' && textState.scale != null) v = textState.scale;
      else if (p === 'rotation' && textState.rotation != null) v = textState.rotation;
    }

    // Sticker clip: override from stickerState
    if (stickerState) {
      if (p === 'x' && stickerState.x != null) v = stickerState.x;
      else if (p === 'y' && stickerState.y != null) v = stickerState.y;
      else if (p === 'scale' && stickerState.scale != null) v = stickerState.scale;
      else if (p === 'rotation' && stickerState.rotation != null) v = stickerState.rotation;
    }

    // Fallback defaults
    if (v == null) {
      if (p === 'x' || p === 'y' || p === 'anchorX' || p === 'anchorY') v = 50;
      else if (p === 'scale') v = 100;
      else v = 0;
    }
    props[p] = v;
  });

  return props;
}

function onButtonClick() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a visual layer first', false); return; }

  const t = getPlayheadTime();

  // 🆕 Collect all selected clips (multi or single)
  const multi = window.__multiSelect;
  const clips = [];
  if (multi && typeof multi.forEachSelectedClip === 'function') {
    multi.forEachSelectedClip(function (c) { clips.push(c); });
  }
  if (clips.length === 0) clips.push(sel.clip);
  if (clips.indexOf(sel.clip) < 0) clips.push(sel.clip);

  // Determine action based on FIRST clip (anchor)
  const anchor = sel.clip;
  const addMode = !hasAnyKeyframeAt(anchor, t);

  let addCount = 0;
  let removeCount = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (addMode) {
      const props = captureProperties(clip);
      ANIMATABLE_PROPS.forEach(function (p) {
        setKeyframe(clip, p, t, props[p]);
      });
      addCount++;
    } else {
      removeAllKeyframesAtTime(clip, t);
      removeCount++;
    }
  }

  if (addMode) {
    showToast('◆ ' + addCount + ' keyframe' + (addCount > 1 ? 's' : '') + ' added');
  } else {
    showToast('◆ ' + removeCount + ' keyframe' + (removeCount > 1 ? 's' : '') + ' removed');
    if (selectedKf && clips.indexOf(selectedKf.clip) >= 0 &&
        Math.abs(selectedKf.time - t) < 0.05) {
      clearKeyframeSelection();
    }
  }

  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  refresh();
  scheduleMarkers();
}

function refresh() {
  if (!btnEl) return;
  const sel = getSelectedClip();
  if (!sel) {
    btnEl.disabled = true;
    btnEl.classList.remove('has-kf', 'no-kf');
    setSign(btnEl, '');
    return;
  }
  btnEl.disabled = false;
  const t = getPlayheadTime();
  const has = hasAnyKeyframeAt(sel.clip, t);
  btnEl.classList.toggle('has-kf', has);
  btnEl.classList.toggle('no-kf', !has);
  setSign(btnEl, has ? '−' : '+');
}

function setSign(btn, sign) {
  let el = btn.querySelector('.kf-sign');
  if (!sign) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('span');
    el.className = 'kf-sign';
    btn.appendChild(el);
  }
  el.textContent = sign;
}

let rafMarkers = false;
function scheduleMarkers() {
  // 🆕 Skip redraw during drag to preserve marker element identity
  if (isDragging) return;
  if (rafMarkers) return;
  rafMarkers = true;
  requestAnimationFrame(() => {
    rafMarkers = false;
    drawMarkers();
  });
}

function drawMarkers() {
  document.querySelectorAll('.kf-marker-layer').forEach(n => n.remove());

  const sel = getSelectedClip();
  if (!sel) return;

  const clip = sel.clip;
  const keys = getPropKeys(clip);
  if (!keys.length) return;

  const clipEl = sel.el;
  if (!clipEl) return;

  const times = new Set();
  keys.forEach(prop => {
    getKeyframes(clip, prop).forEach(k => {
      times.add(Math.round(k.time * 100) / 100);
    });
  });
  if (!times.size) return;

  const startTime = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
  if (duration <= 0) return;

  const clipWidthPx = clipEl.offsetWidth || 0;
  if (clipWidthPx <= 0) return;

  const layer = document.createElement('div');
  layer.className = 'kf-marker-layer';

  const playhead = getPlayheadTime();
  const isSel = selectedKf && selectedKf.clip === clip;

  times.forEach(kt => {
    const relTime = kt - startTime;
    if (relTime < -0.01 || relTime > duration + 0.01) return;
    const pct = relTime / duration;
    const m = document.createElement('span');
    m.className = 'kf-marker';
    m.dataset.kfTime = String(kt);
    m.style.left = (pct * 100) + '%';

    if (Math.abs(playhead - kt) < 0.06) m.classList.add('active');
    if (isSel && Math.abs(selectedKf.time - kt) < 0.05) m.classList.add('selected');

    // 🆕 Drag support
    m.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      startKeyframeDrag(e, clip, kt, m, clipEl);
    });

    layer.appendChild(m);
  });

  clipEl.appendChild(layer);
}

// ═══════════════════════════════════════════════════════════════
//  🆕 KEYFRAME DRAG
// ═══════════════════════════════════════════════════════════════
function startKeyframeDrag(e, clip, kfTime, markerEl, clipEl) {
  if (!clip || !markerEl || !clipEl) return;

  const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const clipDur = Number.isFinite(clip.duration) ? clip.duration : 0;
  if (clipDur <= 0) return;

  const clipWidthPx = clipEl.offsetWidth || 0;
  if (clipWidthPx <= 0) return;

  // Find all props that have a keyframe at this time
  const props = getPropsWithKeyframeAt(clip, kfTime);
  if (!props.length) return;

  const startX = e.clientX;
  const startKfTime = kfTime;
  let currentTime = kfTime;
  let moved = false;
  let wasSelected = selectedKf && selectedKf.clip === clip &&
                    Math.abs(selectedKf.time - kfTime) < 0.05;

  // Ensure keyframes are sorted
  props.forEach(p => {
    const list = clip.__keyframes[p];
    if (Array.isArray(list)) list.sort((a, b) => a.time - b.time);
  });

  isDragging = true;
  markerEl.classList.add('dragging');
  document.body.classList.add('kf-dragging');

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'kf-drag-tooltip';
  tooltip.textContent = formatKfTime(startKfTime);
  document.body.appendChild(tooltip);

  function updateTooltip(clientX, clientY) {
    tooltip.style.left = clientX + 'px';
    tooltip.style.top = Math.max(20, clientY - 20) + 'px';
  }
  updateTooltip(e.clientX, e.clientY);

  function onMove(ev) {
    const dx = ev.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;

    // Convert pixel delta to time delta
    const dtSec = (dx / clipWidthPx) * clipDur;
    let newTime = startKfTime + dtSec;

    // 🆕 Clamp within clip duration
    const clipEnd = clipStart + clipDur;
    newTime = Math.max(clipStart, Math.min(clipEnd, newTime));

    // Snap to 0.05s (frame-ish)
    newTime = Math.round(newTime * 20) / 20;

    if (Math.abs(newTime - currentTime) < 0.001) {
      updateTooltip(ev.clientX, ev.clientY);
      return;
    }
    currentTime = newTime;

    // Update all props that share this keyframe time
    props.forEach(p => {
      const list = clip.__keyframes[p];
      if (!Array.isArray(list)) return;
      const kf = list.find(k => Math.abs(k.time - startKfTime) < 0.05);
      if (kf) kf.time = newTime;
      list.sort((a, b) => a.time - b.time);
    });

    // Update marker position visually
    const relTime = newTime - clipStart;
    const pct = relTime / clipDur;
    markerEl.style.left = (pct * 100) + '%';
    markerEl.dataset.kfTime = String(newTime);

    // Update tooltip
    tooltip.textContent = formatKfTime(newTime);
    updateTooltip(ev.clientX, ev.clientY);

    // 🆕 Live preview — fire transform:changed (safe, doesn't redraw markers)
    document.dispatchEvent(new CustomEvent('transform:changed'));
  }

  function onUp(ev) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    isDragging = false;
    markerEl.classList.remove('dragging');
    document.body.classList.remove('kf-dragging');
    tooltip.remove();

    if (!moved) {
      // Treat as click — select keyframe
      selectKeyframe(clip, startKfTime, markerEl);
      return;
    }

    // Update selection time if this keyframe was selected
    if (wasSelected) {
      selectedKf = { clip: clip, time: currentTime };
      window.__selectedKeyframe = selectedKf;
      document.dispatchEvent(new CustomEvent('keyframe:selected', {
        detail: { clip: clip, time: currentTime, props: props }
      }));
    }

    // Fire final commit events
    document.dispatchEvent(new CustomEvent('keyframe:changed'));
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

    showToast('◆ Keyframe → ' + currentTime.toFixed(2) + 's');
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function formatKfTime(sec) {
  if (!Number.isFinite(sec)) sec = 0;
  return sec.toFixed(2) + 's';
}

// ═══════════════════════════════════════════════════════════════
//  SELECT
// ═══════════════════════════════════════════════════════════════
function selectKeyframe(clip, time, markerEl) {
  if (selectedKf && selectedKf.clip === clip &&
      Math.abs(selectedKf.time - time) < 0.05) {
    clearKeyframeSelection();
    return;
  }

  selectedKf = { clip, time };
  window.__selectedKeyframe = selectedKf;

  document.querySelectorAll('.kf-marker.selected').forEach(n => n.classList.remove('selected'));
  if (markerEl) markerEl.classList.add('selected');

  const props = getPropsWithKeyframeAt(clip, time);
  document.dispatchEvent(new CustomEvent('keyframe:selected', {
    detail: { clip, time, props }
  }));
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:99999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}