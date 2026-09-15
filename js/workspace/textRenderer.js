// ═══════════════════════════════════════════════════════════════
//  🆕 IMAGE CACHE for export
// ═══════════════════════════════════════════════════════════════
const _imageCache = new Map();

export function preloadImage(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return; }
    const cached = _imageCache.get(url);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      resolve(cached);
      return;
    }
    const img = new Image();
    img.onload = () => {
      _imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn('[export] image load failed:', String(url).slice(0, 60));
      resolve(null);
    };
    _imageCache.set(url, img);
    img.src = url;
  });
}

export async function preloadAllImages() {
  const appState = window.__appState;
  if (!appState) return;
  const urls = new Set();
  const allTracks = []
    .concat(appState.timeline.visual || [])
    .concat(appState.timeline.audio || []);
  for (let i = 0; i < allTracks.length; i++) {
    const track = allTracks[i];
    if (!Array.isArray(track)) continue;
    for (let j = 0; j < track.length; j++) {
      const clip = track[j];
      if (clip && clip.type && clip.type.indexOf('image/') === 0 && clip.url) {
        urls.add(clip.url);
      }
    }
  }
  if (urls.size === 0) return;
  console.log('[export] preloading', urls.size, 'image(s)');
  await Promise.all([...urls].map(u => preloadImage(u)));
  console.log('[export] preload done');
}

function getImageSync(url) {
  const img = _imageCache.get(url);
  if (!img) return null;
  if (!img.complete) return null;
  if (img.naturalWidth === 0) return null;
  return img;
}
import { applyAnimation } from '../features/animations.js';
import { hasAnyKeyframes, sample } from './keyframeStore.js';

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
      transform-origin: 50% 50%;
    }
    .tx-mid {
      transform-origin: 50% 50%;
      display: inline-block;
      white-space: pre;
      line-height: 1.15;
    }
    .tx-inner {
      display: inline-block;
      white-space: pre;
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
//  STYLE APPLIER — 3 layers
// ═══════════════════════════════════════════════════════════════
export function applyTextStyle(el, ts) {
  if (!el || !ts) return;
  const outer = el;
  const mid = el.querySelector('.tx-mid');
  const inner = el.querySelector('.tx-inner');
  if (!mid || !inner) return;

  // ─── INNER: text content + typography ───────────
  inner.textContent = ts.content || '';
  inner.style.fontFamily = '"' + (ts.fontFamily || 'Arial') + '", sans-serif';
  inner.style.fontSize = (ts.fontSize || 36) + 'px';
  inner.style.fontWeight = ts.fontWeight || 'normal';
  inner.style.fontStyle = ts.fontStyle || 'normal';
  inner.style.textAlign = ts.alignment || 'center';
  inner.style.whiteSpace = 'pre';
  inner.style.lineHeight = '1.15';

  // Text color / gradient
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
    ? ts.strokeWidth + 'px ' + (ts.strokeColor || '#000000')
    : '';

  inner.style.textShadow = ts.shadowEnabled
    ? (ts.shadowOffsetX || 0) + 'px ' + (ts.shadowOffsetY || 0) + 'px ' +
      (ts.shadowBlur || 0) + 'px ' + (ts.shadowColor || '#000000')
    : '';

  // ─── OUTER: position + base centering ───────────
  outer.style.left = (ts.positionX != null ? ts.positionX : 50) + '%';
  outer.style.top  = (ts.positionY != null ? ts.positionY : 50) + '%';

  let tx = '-50%';
  let originX = '50%';
  if (ts.alignment === 'left')   { tx = '0%';    originX = '0%';   }
  if (ts.alignment === 'right')  { tx = '-100%'; originX = '100%'; }

  outer.style.transformOrigin = originX + ' 50%';
  // 🆕 IMPORTANT — animation is on INNER so outer transform always applies
  outer.style.transform =
    'translate(' + tx + ', -50%)';

  outer.style.opacity = String(Math.max(0, Math.min(100, ts.opacity != null ? ts.opacity : 100)) / 100);

  // ─── MID: user scale + rotation ─────────────────
  const scalePct = ts.scale != null ? ts.scale : 100;
  const rot = ts.rotation || 0;
  mid.style.transform = 'scale(' + (scalePct / 100) + ') rotate(' + rot + 'deg)';
  mid.style.transformOrigin = '50% 50%';
}

// ═══════════════════════════════════════════════════════════════
//  HIERARCHY
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
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════
export function renderAtTime(time) {
  injectStyles();
  const wrap = ensureWrap();
  if (!wrap) return;

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

      entry = { el: outer, mid, inner, lastAnimKey: null, lastPlayheadTime: -9999 };
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

    // 🆕 Animation goes on INNER element only
    if (hasCssAnim && isInside) {
      if (isNew || changed || justEntered) {
        applyAnimation(entry.inner, animKey, animDur);
      }
      const relTime = Math.max(0, Math.min(animDur, time - clipStart));
      seekCssAnimation(entry.inner, animDur, relTime);
    } else if (isJsAnim && isInside) {
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

    // 🆕 Apply styles AFTER animation state
    applyTextStyle(entry.el, ts);
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

  const eng = window.__playbackEngine;
  renderAtTime(eng ? eng.getTime() : 0);
}