// ================================================================
//  js/workspace/textRenderer.js
//  Runtime renderer for ALL text clips on the timeline.
//  Shows only the top text clip that contains the current playhead.
// ================================================================

import { appState } from '../app.js';
import { applyAnimation } from '../features/animations.js';

let overlayEl = null;
let lastRenderedId = null;
let lastAnimationKey = null;

const CSS_ID = 'text-renderer-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tx-overlay {
      position: absolute;
      z-index: 45;
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

function ensureOverlay() {
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return null;
  if (!overlayEl || !wrap.contains(overlayEl)) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'tx-overlay';
    wrap.appendChild(overlayEl);
  }
  return overlayEl;
}

function hideOverlay() {
  if (overlayEl) overlayEl.style.display = 'none';
}

function showOverlay() {
  if (overlayEl) overlayEl.style.display = '';
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

// ─── Find topmost text clip at time ───────────────────────────
export function getTopTextClipAt(time) {
  const tracks = appState.timeline.visual || [];
  let best = null;
  let bestIdx = -1;
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__textId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        if (t > bestIdx) { best = clip; bestIdx = t; }
      }
    }
  }
  return best;
}

// ─── Render at a given timeline time ──────────────────────────
export function renderAtTime(time) {
  injectStyles();
  const clip = getTopTextClipAt(time);

  if (!clip) {
    lastRenderedId = null;
    lastAnimationKey = null;
    hideOverlay();
    return;
  }

  const el = ensureOverlay();
  if (!el) return;

  const ts = clip.textState || {};
  const animKey = ts.animation || 'none';
  const isNewClip = clip.__textId !== lastRenderedId;

  // Full restyle if clip changed OR animation needs restart
  applyTextStyle(el, ts);

  if (isNewClip || animKey !== lastAnimationKey) {
    // Restart animation on new clip
    const dur = ts.animationDuration != null ? ts.animationDuration : 0.6;
    applyAnimation(el, animKey, dur);
    lastAnimationKey = animKey;
  }

  showOverlay();
  lastRenderedId = clip.__textId;
}

// ─── Force re-render (state changed while paused) ─────────────
export function forceRerender() {
  const eng = window.__playbackEngine;
  const t = eng ? eng.getTime() : 0;
  lastRenderedId = null;
  lastAnimationKey = null;
  renderAtTime(t);
}

// ─── Called by the editor panel after in-panel changes ────────
export function refreshCurrent() {
  const eng = window.__playbackEngine;
  const t = eng ? eng.getTime() : 0;
  const clip = getTopTextClipAt(t);
  if (!clip) { hideOverlay(); return; }
  const el = ensureOverlay();
  if (!el) return;
  applyTextStyle(el, clip.textState || {});
  showOverlay();
}

// ─── Remove overlay entirely ──────────────────────────────────
export function removeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  lastRenderedId = null;
  lastAnimationKey = null;
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

  // Initial paint
  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}