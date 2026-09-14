// ================================================================
//  js/workspace/transitionMarkers.js
//  Renders transition markers between adjacent clips.
//  Click → select (red). Drag → adjust duration.
// ================================================================

import { getPixelsPerSecond } from './timelineScaler.js';

const CSS_ID = 'transition-marker-styles';
let selectedTransitionClip = null;

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .transition-marker-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 25;
    }
    .transition-marker {
      position: absolute;
      top: 50%;
      width: 30px;
      height: 22px;
      background: #6d28d9;
      border: 1.5px solid #fff;
      border-radius: 5px;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 6px rgba(109,40,217,0.7);
      pointer-events: auto;
      cursor: pointer;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
      user-select: none;
      -webkit-user-select: none;
      transition: background 0.12s ease, box-shadow 0.12s ease;
    }
    .transition-marker:hover {
      background: #7c3aed;
    }
    .transition-marker.selected {
      background: #ff3b3b;
      box-shadow: 0 0 0 2px #ff3b3b, 0 0 14px rgba(255,59,59,0.9);
    }
    .transition-marker-duration {
      position: absolute;
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 9px;
      font-weight: 700;
      color: #fff;
      background: rgba(0,0,0,0.8);
      padding: 1px 5px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initTransitionMarkers() {
  injectStyles();
  document.addEventListener('editor:timeline-changed', scheduleRender);
  document.addEventListener('transition:changed', scheduleRender);
  document.addEventListener('timeline:scale-changed', scheduleRender);
  scheduleRender();
}

export function getSelectedTransition() {
  return selectedTransitionClip;
}

export function clearTransitionSelection() {
  selectedTransitionClip = null;
  document.querySelectorAll('.transition-marker.selected').forEach(n => n.classList.remove('selected'));
  document.dispatchEvent(new CustomEvent('transition:selected', { detail: null }));
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    renderMarkers();
  });
}

function renderMarkers() {
  document.querySelectorAll('.transition-marker-layer').forEach(n => n.remove());

  const appState = window.__appState;
  if (!appState) return;

  const pps = getPixelsPerSecond();
  const tracks = appState.timeline.visual || [];

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;

    const junctions = [];
    for (const clip of track) {
      if (!clip.__transitionIn) continue;
      if (!clip.__transitionIn.key || clip.__transitionIn.key === 'none') continue;
      const startTime = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      let hasPreceding = false;
      for (const other of track) {
        if (other === clip) continue;
        const otherEnd = (Number.isFinite(other.startTime) ? other.startTime : 0) +
                         (Number.isFinite(other.duration) ? other.duration : 0);
        if (Math.abs(otherEnd - startTime) < 0.5) { hasPreceding = true; break; }
      }
      if (!hasPreceding) continue;
      junctions.push({ clip, time: startTime });
    }

    if (!junctions.length) continue;

    const trackEl = document.querySelector(
      '.track[data-group="visual"][data-track-index="' + t + '"]'
    );
    if (!trackEl) continue;
    const contentEl = trackEl.querySelector('.track-content');
    if (!contentEl) continue;

    const layer = document.createElement('div');
    layer.className = 'transition-marker-layer';

    for (const j of junctions) {
      const marker = createMarker(j.clip, j.time * pps);
      layer.appendChild(marker);
    }

    contentEl.appendChild(layer);
  }
}

// ═══════════════════════════════════════════════════════════════
//  MARKER ELEMENT
// ═══════════════════════════════════════════════════════════════
function createMarker(clip, xPx) {
  const m = document.createElement('div');
  m.className = 'transition-marker';
  m.textContent = '⇄';
  m.style.left = xPx + 'px';

  const dur = Number(clip.__transitionIn.duration) || 0.5;
  const durEl = document.createElement('span');
  durEl.className = 'transition-marker-duration';
  durEl.textContent = dur.toFixed(2) + 's';
  m.appendChild(durEl);

  if (selectedTransitionClip === clip) m.classList.add('selected');

  m.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onMarkerPointerDown(e, clip, m);
  });

  return m;
}

// ═══════════════════════════════════════════════════════════════
//  DRAG HANDLER (duration adjust)
// ═══════════════════════════════════════════════════════════════
let dragState = null;

function onMarkerPointerDown(e, clip, markerEl) {
  // Select
  selectTransition(clip, markerEl);

  dragState = {
    clip,
    markerEl,
    startX: e.clientX,
    startDuration: Number(clip.__transitionIn.duration) || 0.5,
    pointerId: e.pointerId
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;
  if (e.cancelable) e.preventDefault();

  const pps = getPixelsPerSecond();
  const dx = e.clientX - dragState.startX;
  const dSec = dx / Math.max(1, pps);

  let newDur = dragState.startDuration + dSec * 2;
  newDur = Math.max(0.1, Math.min(3, newDur));
  newDur = Math.round(newDur * 20) / 20;

  dragState.clip.__transitionIn.duration = newDur;

  // Update tooltip text live
  const durEl = dragState.markerEl.querySelector('.transition-marker-duration');
  if (durEl) durEl.textContent = newDur.toFixed(2) + 's';
}

function onPointerUp(e) {
  if (!dragState) return;
  if (e.pointerId !== dragState.pointerId) return;

  dragState = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transition:changed'));
}

function selectTransition(clip, markerEl) {
  if (selectedTransitionClip === clip) {
    // Toggle off
    clearTransitionSelection();
    return;
  }

  selectedTransitionClip = clip;

  document.querySelectorAll('.transition-marker.selected').forEach(n => n.classList.remove('selected'));
  if (markerEl) markerEl.classList.add('selected');

  document.dispatchEvent(new CustomEvent('transition:selected', {
    detail: { clip }
  }));
}