// ================================================================
//  js/workspace/textRenderer.js
//  Renders ALL active text clips simultaneously (multi-layer).
//  Respects hidden tracks.
// ================================================================

import { applyAnimation } from '../features/animations.js';

const overlays = new Map(); // textId -> { el, lastAnimKey }
let wrapEl = null;

const CSS_ID = 'text-renderer-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tx-overlay {
      position: absolute;
      pointer-events: none;
      white-space: pre-wrap;
      word-break: break-word;
      max-width: 94%;
      line-height: 1.15;
      user-select: none;
      -webkit-user-select: none;
      will-change: transform, opacity;
    }
  `;
  document.head.appendChild(s);
}

function ensureWrap() {
  if (wrapEl && document.body.contains(wrapEl)) return wrapEl;
  wrapEl = document.querySelector('#preview-canvas-wrap');
  return wrapEl;
}

// ─── Public: apply a textState to an overlay element ──────────
export function applyTextStyle(el, ts) {
  if (!el || !ts) return;

  el.textContent = ts.content || '';
  el.style.fontFamily = `"${ts.fontFamily || 'Arial'}", sans-serif`;
  el.style.fontSize = (ts.fontSize || 36) + 'px';
  el.style.fontWeight = ts.fontWeight || 'normal';
  el.style.fontStyle = ts.fontStyle || 'normal';
  el.style.textAlign = ts.alignment || 'center';
  el.style.opacity = String(Math.max(0, Math.min(100, ts.opacity != null ? ts.opacity : 100)) / 100);

  el.style.left = (ts.positionX != null ? ts.positionX : 50) + '%';
  el.style.top  = (ts.positionY != null ? ts.positionY : 50) + '%';

  let tx = '-50%';
  let originX = '50%';
  if (ts.alignment === 'left')   { tx = '0%';    originX = '0%';   }
  if (ts.alignment === 'right')  { tx = '-100%'; originX = '100%'; }

  const scalePct = ts.scale != null ? ts.scale : 100;
  const rot = ts.rotation || 0;

  el.style.transformOrigin = `${originX} 50%`;
  el.style.transform =
    `translate(${tx}, -50%) scale(${scalePct / 100}) rotate(${rot}deg)`;

  el.style.setProperty('--tx-scale', scalePct / 100);
  el.style.setProperty('--tx-rot', rot + 'deg');

  if (ts.gradientEnabled) {
    el.style.background = `linear-gradient(${ts.gradientAngle || 90}deg, ${ts.gradientColor1 || '#ff0066'}, ${ts.gradientColor2 || '#0066ff'})`;
    el.style.webkitBackgroundClip = 'text';
    el.style.backgroundClip = 'text';
    el.style.color = 'transparent';
    el.style.webkitTextFillColor = 'transparent';
  } else {
    el.style.background = 'none';
    el.style.webkitBackgroundClip = '';
    el.style.backgroundClip = '';
    el.style.color = ts.color || '#ffffff';
    el.style.webkitTextFillColor = '';
  }

  el.style.webkitTextStroke = (ts.strokeWidth || 0) > 0
    ? `${ts.strokeWidth}px ${ts.strokeColor || '#000000'}`
    : '';

  el.style.textShadow = ts.shadowEnabled
    ? `${ts.shadowOffsetX || 0}px ${ts.shadowOffsetY || 0}px ${ts.shadowBlur || 0}px ${ts.shadowColor || '#000000'}`
    : '';
}

// ─── Get ALL active text clips at time (respects hidden) ─────
export function getActiveTextClipsAt(time) {
  const appState = window.__appState;
  if (!appState) return [];

  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();
  const result = [];

  for (let t = 0; t < tracks.length; t++) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;

    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__textId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        result.push({ clip, trackIndex: t });
        break;
      }
    }
  }
  return result;
}

// Kept for compatibility
export function getTopTextClipAt(time) {
  const active = getActiveTextClipsAt(time);
  if (!active.length) return null;
  return active[active.length - 1].clip;
}

// ─── Render all active text clips at a given timeline time ────
export function renderAtTime(time) {
  injectStyles();
  const wrap = ensureWrap();
  if (!wrap) return;

  const active = getActiveTextClipsAt(time);
  const seen = new Set();

  for (let i = 0; i < active.length; i++) {
    const { clip, trackIndex } = active[i];
    const id = clip.__textId;
    seen.add(id);

    let entry = overlays.get(id);
    if (!entry || !document.body.contains(entry.el)) {
      const el = document.createElement('div');
      el.className = 'tx-overlay';
      el.dataset.textId = id;
      wrap.appendChild(el);
      entry = { el, lastAnimKey: null };
      overlays.set(id, entry);
    }

    const ts = clip.textState || {};
    applyTextStyle(entry.el, ts);
    entry.el.style.zIndex = String(40 + trackIndex);
    entry.el.style.display = '';

    const animKey = ts.animation || 'none';
    const isNew = entry.lastAnimKey === null;
    if (isNew || animKey !== entry.lastAnimKey) {
      const dur = ts.animationDuration != null ? ts.animationDuration : 0.6;
      applyAnimation(entry.el, animKey, dur);
      entry.lastAnimKey = animKey;
    }
  }

  // Remove overlays for clips no longer active
  overlays.forEach(function (entry, id) {
    if (!seen.has(id)) {
      try { entry.el.remove(); } catch (_) {}
      overlays.delete(id);
    }
  });
}

// ─── Force re-render (clears animation state so it replays) ───
export function forceRerender() {
  overlays.forEach(function (entry) {
    entry.lastAnimKey = null;
  });
  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}

// ─── Called by editor panel after in-panel changes ────────────
export function refreshCurrent() {
  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}

// ─── Remove overlays ──────────────────────────────────────────
export function removeOverlay() {
  overlays.forEach(function (entry) {
    try { entry.el.remove(); } catch (_) {}
  });
  overlays.clear();
}

// ─── Init ─────────────────────────────────────────────────────
export function initTextRenderer() {
  injectStyles();

  document.addEventListener('playback:tick', function (e) {
    const t = (e.detail && e.detail.time) || 0;
    renderAtTime(t);
  });

  document.addEventListener('editor:timeline-changed', function () {
    forceRerender();
  });

  document.addEventListener('effects:refresh', function () {
    forceRerender();
  });

  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}