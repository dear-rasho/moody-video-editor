// ═══════════════════════════════════════════════════════════════
//  js/workspace/textRenderer.js
//  Text renderer with:
//   - Canvas-relative font sizing (auto-scales with ratio)
//   - Anchor points (anchorX / anchorY)
//   - Independent positionX / positionY
//   - Bounds clamping (text never disappears)
//   - Per-segment animation
// ═══════════════════════════════════════════════════════════════

import { applyAnimation } from '../features/animations.js';
import { hasAnyKeyframes, sample } from './keyframeStore.js';
import { loadGoogleFont } from '../codebase/fontLibrary.js';

// Font size reference — a font-size of 36 on a 400px canvas = 36px.
// On 1080px canvas = ~97px. Consistent across all ratios.
const REFERENCE_DIM = 400;

const overlays = new Map();
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
      user-select: none;
      -webkit-user-select: none;
      transform-origin: 0 0;
      overflow: visible;
      z-index: 20;
    }
    .tx-mid {
      transform-origin: 50% 50%;
      display: inline-block;
      white-space: pre;
      line-height: 1.15;
    }
    .tx-inner {
      display: inline-block;
      white-space: pre-wrap;
    }
    .tx-seg-line {
      display: inline-block;
      white-space: pre;
      line-height: 1.05;
      vertical-align: baseline;
      transform-origin: center center;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      margin: 0 0.08em;
    }
    .tx-seg-line.tx-seg-newline {
      display: block;
      margin: 0;
    }
  `;
  document.head.appendChild(s);
}

function ensureWrap() {
  if (wrapEl && document.body.contains(wrapEl)) return wrapEl;
  wrapEl = document.querySelector('#preview-canvas-wrap');
  return wrapEl;
}

// ═══════════════════════════════════════════════════════════════
//  CANVAS SCALE — reference to smaller dimension
// ═══════════════════════════════════════════════════════════════
function getCanvasScale() {
  if (!wrapEl) return 1;
  const w = wrapEl.clientWidth || REFERENCE_DIM;
  const h = wrapEl.clientHeight || REFERENCE_DIM;
  const minDim = Math.min(w, h);
  return minDim / REFERENCE_DIM;
}

// ═══════════════════════════════════════════════════════════════
//  SYNC / APPLY SEGMENT ELEMENTS
// ═══════════════════════════════════════════════════════════════
function syncSegmentElements(inner, segments) {
  const existing = inner.querySelectorAll('.tx-seg-line');
  let needsRebuild = (existing.length !== segments.length);

  if (!needsRebuild) {
    for (let i = 0; i < segments.length; i++) {
      if (!existing[i] || existing[i].textContent !== segments[i].text) {
        needsRebuild = true;
        break;
      }
    }
  }

  if (!needsRebuild) return;

  inner.textContent = '';
  for (let i = 0; i < segments.length; i++) {
    const line = document.createElement('div');
    line.className = 'tx-seg-line';
    line.dataset.segIndex = String(i);
    line.textContent = segments[i].text;
    inner.appendChild(line);
  }
}

function applySegmentStyles(inner, segments, cScale) {
  const lines = inner.querySelectorAll('.tx-seg-line');

  for (let i = 0; i < lines.length; i++) {
    const lineEl = lines[i];
    const seg = segments[i];
    if (!seg) continue;

    lineEl.style.fontFamily = '"' + (seg.fontFamily || 'Arial') + '", sans-serif';
    lineEl.style.fontSize = ((seg.fontSize || 36) * cScale) + 'px';
    lineEl.style.fontWeight = seg.fontWeight || 'normal';
    lineEl.style.fontStyle = seg.fontStyle || 'normal';

    if (seg.gradientEnabled) {
      const ga = seg.gradientAngle || 90;
      lineEl.style.backgroundImage = 'linear-gradient(' + ga + 'deg, ' +
        (seg.gradientColor1 || '#ff0066') + ', ' + (seg.gradientColor2 || '#0066ff') + ')';
      lineEl.style.webkitBackgroundClip = 'text';
      lineEl.style.backgroundClip = 'text';
      lineEl.style.color = 'transparent';
      lineEl.style.webkitTextFillColor = 'transparent';
    } else {
      lineEl.style.backgroundImage = 'none';
      lineEl.style.backgroundClip = '';
      lineEl.style.webkitBackgroundClip = '';
      lineEl.style.color = seg.color || '#ffffff';
      lineEl.style.webkitTextFillColor = seg.color || '#ffffff';
    }

    if (seg.shadowEnabled) {
      lineEl.style.textShadow = '2px 2px 8px rgba(0,0,0,0.85)';
    } else {
      lineEl.style.textShadow = '';
    }

    if (seg.strokeWidth > 0) {
      lineEl.style.webkitTextStroke = (seg.strokeWidth * cScale) + 'px ' +
        (seg.strokeColor || '#000');
    } else {
      lineEl.style.webkitTextStroke = '';
    }

    const rot = seg.rotation || 0;
    const sc = (seg.scale != null ? seg.scale : 100) / 100;
    if (rot || sc !== 1) {
      lineEl.style.transform = 'rotate(' + rot + 'deg) scale(' + sc + ')';
    } else {
      lineEl.style.transform = '';
    }

    if (seg.opacity != null && seg.opacity !== 100) {
      lineEl.style.opacity = String(seg.opacity / 100);
    } else {
      lineEl.style.opacity = '';
    }

    if (seg.animation && seg.animation !== 'none') {
      lineEl.dataset.anim = seg.animation;
    } else {
      delete lineEl.dataset.anim;
    }

    if (seg.newline) {
      lineEl.classList.add('tx-seg-newline');
    } else {
      lineEl.classList.remove('tx-seg-newline');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  APPLY TEXT STYLE (with canvas-relative sizing + anchor)
// ═══════════════════════════════════════════════════════════════
export function applyTextStyle(el, ts, skipContent) {
  if (!el || !ts) return;
  const outer = el;
  const mid = el.querySelector('.tx-mid');
  const inner = el.querySelector('.tx-inner');
  if (!mid || !inner) return;

  if (ts.fontFamily) loadGoogleFont(ts.fontFamily);
  if (ts.__segments) {
    ts.__segments.forEach(s => { if (s.fontFamily) loadGoogleFont(s.fontFamily); });
  }

  const cScale = getCanvasScale();

  if (!skipContent) {
    if (ts.__segments && ts.__segments.length > 0) {
      syncSegmentElements(inner, ts.__segments);
      applySegmentStyles(inner, ts.__segments, cScale);
    } else {
      inner.textContent = ts.content || '';
      inner.style.fontFamily = '"' + (ts.fontFamily || 'Arial') + '", sans-serif';
      inner.style.fontSize = ((ts.fontSize || 36) * cScale) + 'px';
      inner.style.fontWeight = ts.fontWeight || 'normal';
      inner.style.fontStyle = ts.fontStyle || 'normal';
      inner.style.textAlign = ts.alignment || 'center';
      inner.style.whiteSpace = 'pre';
      inner.style.lineHeight = '1.15';

      if (ts.gradientEnabled) {
        inner.style.background = 'linear-gradient(' + (ts.gradientAngle || 90) + 'deg, ' +
          (ts.gradientColor1 || '#ff0066') + ', ' + (ts.gradientColor2 || '#0066ff') + ')';
        inner.style.webkitBackgroundClip = 'text';
        inner.style.backgroundClip = 'text';
        inner.style.color = 'transparent';
        inner.style.webkitTextFillColor = 'transparent';
      } else {
        inner.style.background = 'none';
        inner.style.webkitBackgroundClip = '';
        inner.style.backgroundClip = '';
        inner.style.color = ts.color || '#ffffff';
        inner.style.webkitTextFillColor = '';
      }

      inner.style.webkitTextStroke = (ts.strokeWidth || 0) > 0
        ? (ts.strokeWidth * cScale) + 'px ' + (ts.strokeColor || '#000000')
        : '';

      inner.style.textShadow = ts.shadowEnabled
        ? (ts.shadowOffsetX || 0) * cScale + 'px ' +
          (ts.shadowOffsetY || 0) * cScale + 'px ' +
          (ts.shadowBlur || 0) * cScale + 'px ' +
          (ts.shadowColor || '#000000')
        : '';
    }
  }

  // 🆕 POSITION + ANCHOR
  const posX = ts.positionX != null ? ts.positionX : 50;
  const posY = ts.positionY != null ? ts.positionY : 50;
  const anchX = ts.anchorX != null ? ts.anchorX : 50;
  const anchY = ts.anchorY != null ? ts.anchorY : 50;

  outer.style.left = posX + '%';
  outer.style.top = posY + '%';

  // Anchor: 0=left/top edge, 50=center, 100=right/bottom edge
  outer.style.transform =
    'translate(' + (-anchX) + '%, ' + (-anchY) + '%)';

  outer.style.opacity = String(Math.max(0, Math.min(100, ts.opacity != null ? ts.opacity : 100)) / 100);

  // User scale + rotation on mid
  const userScale = (ts.scale != null ? ts.scale : 100) / 100;
  const rot = ts.rotation || 0;
  mid.style.transform = 'scale(' + userScale + ') rotate(' + rot + 'deg)';
  mid.style.transformOrigin = '50% 50%';
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-FIT + CLAMP — text never disappears
// ═══════════════════════════════════════════════════════════════
function autoFitTextToCanvas(entry, ts) {
  if (!wrapEl || !entry || !entry.mid || !entry.inner) return;

  const canvasW = wrapEl.clientWidth;
  const canvasH = wrapEl.clientHeight;
  if (!canvasW || !canvasH) return;

  const mid = entry.mid;
  const inner = entry.inner;
  const outer = entry.el;
  const rot = ts.rotation || 0;
  const userScale = (ts.scale != null ? ts.scale : 100) / 100;

  const segCount = ts.__segments ? ts.__segments.length : 0;
  const contentLen = (ts.content || '').length;
  const sig = segCount + ':' + contentLen + ':' +
              canvasW + 'x' + canvasH + ':' +
              (ts.fontSize || 0) + ':' + rot + ':' + userScale;

  let fitRatio = (typeof entry._fitRatio === 'number') ? entry._fitRatio : 1;

  if (entry._fitSig !== sig) {
    entry._fitSig = sig;

    const prevMidTransform = mid.style.transform;
    const prevInnerAnim = inner.style.animation;
    const prevInnerPlayState = inner.style.animationPlayState;
    const prevInnerTransform = inner.style.transform;

    mid.style.transform = rot ? ('rotate(' + rot + 'deg)') : 'none';
    inner.style.animation = 'none';
    inner.style.animationPlayState = '';
    inner.style.transform = 'none';
    void inner.offsetWidth;

    const rect = inner.getBoundingClientRect();
    const naturalW = rect.width;
    const naturalH = rect.height;

    mid.style.transform = prevMidTransform;
    inner.style.animation = prevInnerAnim;
    inner.style.animationPlayState = prevInnerPlayState;
    inner.style.transform = prevInnerTransform;

    if (naturalW > 0 && naturalH > 0) {
      const PADDING = 0.92;
      const maxW = canvasW * PADDING;
      const maxH = canvasH * PADDING;
      const scaledW = naturalW * userScale;
      const scaledH = naturalH * userScale;

      let ratio = 1;
      if (scaledW > maxW) ratio = Math.min(ratio, maxW / scaledW);
      if (scaledH > maxH) ratio = Math.min(ratio, maxH / scaledH);

      fitRatio = ratio;
      entry._fitRatio = fitRatio;
    }
  }

  const finalScale = userScale * fitRatio;
  mid.style.transform = 'scale(' + finalScale + ') rotate(' + rot + 'deg)';
  mid.style.transformOrigin = '50% 50%';

  // 🆕 CLAMP — keep text fully inside canvas
  void outer.offsetWidth;
  const rect = outer.getBoundingClientRect();
  const wrapRect = wrapEl.getBoundingClientRect();
  const elW = rect.width;
  const elH = rect.height;
  if (elW <= 0 || elH <= 0) return;

  // Current desired center (in canvas px) — using anchor
  const posX = ts.positionX != null ? ts.positionX : 50;
  const posY = ts.positionY != null ? ts.positionY : 50;
  const anchX = ts.anchorX != null ? ts.anchorX : 50;
  const anchY = ts.anchorY != null ? ts.anchorY : 50;

  // Element's top-left in canvas px
  const leftPx = canvasW * (posX / 100) - elW * (anchX / 100);
  const topPx  = canvasH * (posY / 100) - elH * (anchY / 100);

  // Adjust so full element stays inside
  let adjLeft = leftPx;
  let adjTop  = topPx;
  const MARGIN = 2;

  if (adjLeft < MARGIN) adjLeft = MARGIN;
  if (adjTop  < MARGIN) adjTop  = MARGIN;
  if (adjLeft + elW > canvasW - MARGIN) adjLeft = canvasW - MARGIN - elW;
  if (adjTop  + elH > canvasH - MARGIN) adjTop  = canvasH - MARGIN - elH;

  // Convert back to position % with same anchor
  const newPosX = ((adjLeft + elW * (anchX / 100)) / canvasW) * 100;
  const newPosY = ((adjTop  + elH * (anchY / 100)) / canvasH) * 100;

  outer.style.left = newPosX + '%';
  outer.style.top  = newPosY + '%';
}

// ═══════════════════════════════════════════════════════════════
//  HIERARCHY HELPERS
// ═══════════════════════════════════════════════════════════════
function getTopDisplayTrackIndexAt(time) {
  const appState = window.__appState;
  if (!appState) return -1;
  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.type) continue;
      const isV = clip.type.indexOf('video/') === 0;
      const isI = clip.type.indexOf('image/') === 0;
      if (!isV && !isI) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) return t;
    }
  }
  return -1;
}

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

export function getTopTextClipAt(time) {
  const active = getActiveTextClipsAt(time);
  if (!active.length) return null;
  return active[active.length - 1].clip;
}

function sampleTextState(clip, time) {
  const ts = clip.textState || {};
  if (!hasAnyKeyframes(clip)) return ts;
  const eff = Object.assign({}, ts);
  eff.positionX = sample(clip, 'x', time, ts.positionX != null ? ts.positionX : 50);
  eff.positionY = sample(clip, 'y', time, ts.positionY != null ? ts.positionY : 50);
  eff.scale = sample(clip, 'scale', time, ts.scale != null ? ts.scale : 100);
  eff.rotation = sample(clip, 'rotation', time, ts.rotation != null ? ts.rotation : 0);
  return eff;
}

function seekCssAnimation(el, animDur, relTime) {
  const t = Math.max(0, Math.min(animDur, relTime));
  el.style.animationPlayState = 'paused';
  el.style.animationDelay = '-' + t + 's';
}

function clearCssAnimation(el) {
  el.style.animation = 'none';
  el.style.animationPlayState = '';
  el.style.animationDelay = '';
}

// ═══════════════════════════════════════════════════════════════
//  PER-SEGMENT ANIMATIONS
// ═══════════════════════════════════════════════════════════════
function applySegmentAnimations(entry, ts, clipStart, animDur, time, isInside) {
  if (!ts.__segments || !ts.__segments.length) return;
  if (!entry.inner) return;

  if (!entry.segAnimState) entry.segAnimState = {};

  const lines = entry.inner.querySelectorAll('.tx-seg-line');

  for (let k = 0; k < lines.length; k++) {
    const lineEl = lines[k];
    const seg = ts.__segments[k];
    if (!seg) continue;

    const segAnim = seg.animation || 'none';
    const segKey = k + ':' + segAnim;
    const prev = entry.segAnimState[k];
    const isNewElement = !prev || prev.el !== lineEl;
    const prevKey = prev ? prev.key : '';

    if (segAnim === 'none') {
      if (!isNewElement && prevKey && prevKey !== 'none') {
        lineEl.style.animation = 'none';
      }
      entry.segAnimState[k] = { el: lineEl, key: 'none' };
      continue;
    }

    if (!isInside) {
      lineEl.style.animation = 'none';
      lineEl.style.animationPlayState = '';
      lineEl.style.animationDelay = '';
      entry.segAnimState[k] = { el: lineEl, key: '' };
      continue;
    }

    const isJsAnim = (segAnim === 'typewriter' || segAnim === 'decoder');

    if (isNewElement || prevKey !== segKey) {
      try { lineEl.style.animation = 'none'; } catch (_) {}
      void lineEl.offsetWidth;
      applyAnimation(lineEl, segAnim, animDur);
      entry.segAnimState[k] = { el: lineEl, key: segKey };
    }

    if (!isJsAnim) {
      const relTime = Math.max(0, Math.min(animDur, time - clipStart));
      lineEl.style.animationPlayState = 'paused';
      lineEl.style.animationDelay = '-' + relTime + 's';
    } else {
      lineEl.style.animationPlayState = '';
      lineEl.style.animationDelay = '';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════
export function renderAtTime(time) {
  injectStyles();
  const wrap = ensureWrap();
  if (!wrap) return;
  wrapEl = wrap;

  const topDisplayTrack = getTopDisplayTrackIndexAt(time);
  const active = getActiveTextClipsAt(time);
  const seen = new Set();

  for (let i = 0; i < active.length; i++) {
    const { clip, trackIndex } = active[i];
    const id = clip.__textId;
    seen.add(id);

    let entry = overlays.get(id);
    if (!entry || !document.body.contains(entry.el)) {
      const outer = document.createElement('div');
      outer.className = 'tx-overlay';
      outer.dataset.textId = id;

      const mid = document.createElement('div');
      mid.className = 'tx-mid';

      const inner = document.createElement('div');
      inner.className = 'tx-inner';

      mid.appendChild(inner);
      outer.appendChild(mid);
      wrap.appendChild(outer);

      entry = {
        el: outer, mid, inner,
        lastAnimKey: null,
        lastPlayheadTime: -9999,
        segAnimState: {},
        _fitSig: null,
        _fitRatio: 1
      };
      overlays.set(id, entry);
    }

    const textIsOnTop = (topDisplayTrack < 0) || (trackIndex > topDisplayTrack);
    if (!textIsOnTop) {
      entry.el.style.display = 'none';
      continue;
    }
    entry.el.style.display = '';

    const ts = sampleTextState(clip, time);
    const animKey = ts.animation || 'none';
    const animDur = (ts.animationDuration != null) ? ts.animationDuration : 0.6;
    const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
    const animEnd = clipStart + animDur;
    const isJsAnim = (animKey === 'typewriter' || animKey === 'decoder');
    const hasCssAnim = (animKey && animKey !== 'none' && !isJsAnim);
    const isInside = time >= clipStart && time < animEnd;

    const isNew = entry.lastAnimKey === null;
    const changed = animKey !== entry.lastAnimKey;
    const prevT = entry.lastPlayheadTime;
    const wasInside = prevT >= clipStart && prevT < animEnd;
    const justEntered = isInside && !wasInside;

    if (changed && !isNew) {
      clearCssAnimation(entry.inner);
      clearCssAnimation(entry.mid);
    }

    const jsAnimActive = isJsAnim && isInside;

    if (hasCssAnim && isInside) {
      if (isNew || changed || justEntered) {
        applyAnimation(entry.inner, animKey, animDur);
      }
      const relTime = Math.max(0, Math.min(animDur, time - clipStart));
      seekCssAnimation(entry.inner, animDur, relTime);
    } else if (jsAnimActive) {
      if (isNew || changed || justEntered) {
        applyAnimation(entry.inner, animKey, animDur);
      }
      entry.inner.style.animationPlayState = '';
      entry.inner.style.animationDelay = '';
    } else {
      if (entry.inner.style.animation && entry.inner.style.animation !== 'none') {
        clearCssAnimation(entry.inner);
      }
    }

    entry.lastAnimKey = animKey;
    entry.lastPlayheadTime = time;

    applyTextStyle(entry.el, ts, jsAnimActive);
    autoFitTextToCanvas(entry, ts);
    applySegmentAnimations(entry, ts, clipStart, animDur, time, isInside);

    entry.el.style.zIndex = String(40 + trackIndex);
  }

  overlays.forEach(function (entry, id) {
    if (!seen.has(id)) {
      try { entry.el.remove(); } catch (_) {}
      overlays.delete(id);
    }
  });
}

export function forceRerender() {
  overlays.forEach(function (entry) {
    entry.lastAnimKey = null;
    entry.segAnimState = {};
    entry._fitSig = null;
    entry._fitRatio = 1;
  });
  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}

export function refreshCurrent() {
  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}

export function removeOverlay() {
  overlays.forEach(function (entry) {
    try { entry.el.remove(); } catch (_) {}
  });
  overlays.clear();
}

export function initTextRenderer() {
  injectStyles();
  document.addEventListener('playback:tick', function (e) {
    const t = (e.detail && e.detail.time) || 0;
    renderAtTime(t);
  });
  document.addEventListener('editor:timeline-changed', function () { forceRerender(); });
  document.addEventListener('effects:refresh', function () { forceRerender(); });
  document.addEventListener('keyframe:changed', function () { forceRerender(); });
  document.addEventListener('transform:changed', function () { forceRerender(); });
  document.addEventListener('ratio:changed', function () { forceRerender(); });

  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}