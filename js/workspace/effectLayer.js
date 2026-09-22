// ================================================================
//  js/workspace/effectLayer.js
//  Effect layer CRUD.
//
//  Rule: Effects START at the playhead, END at the current clip's end
//  (or timeline end if no clip under playhead).
//  User can drag/resize the effect layer afterward.
// ================================================================

import { placeClipAtTime } from '../layers/layersManager.js';

export const DEFAULT_EFFECT_DURATION = 3;

function getState() { return window.__appState; }

// ═══════════════════════════════════════════════════════════════
//  COMPUTE TIMELINE END (ignore effect/fx layers)
// ═══════════════════════════════════════════════════════════════
function computeTimelineEnd() {
  const appState = getState();
  if (!appState) return 0;
  let maxEnd = 0;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip) continue;
      if (clip.__effectId) continue;
      if (clip.__audioFxId) continue;
      if (clip.__soundId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      const end = s + d;
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 COMPUTE EFFECT RANGE FROM PLAYHEAD
//    Start = playhead
//    End   = clip end at playhead (fallback: timeline end)
// ═══════════════════════════════════════════════════════════════
function computeEffectRangeFromPlayhead() {
  const appState = getState();
  if (!appState) return { start: 0, duration: DEFAULT_EFFECT_DURATION };

  const eng = window.__playbackEngine;
  const playhead = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  // Find top display clip at playhead (video/image)
  let clipEnd = -1;
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
      if (playhead >= s && playhead < s + d) {
        clipEnd = s + d;
        break;
      }
    }
    if (clipEnd > 0) break;
  }

  // Fallback: timeline end, or playhead + default
  if (clipEnd < 0) {
    const tlEnd = computeTimelineEnd();
    clipEnd = tlEnd > playhead + 0.15 ? tlEnd : (playhead + DEFAULT_EFFECT_DURATION);
  }

  const start = Math.max(0, playhead);
  const dur = Math.max(0.15, clipEnd - start);
  return { start: start, duration: dur };
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION HELPERS
// ═══════════════════════════════════════════════════════════════
export function hasSelectedLayer() {
  return !!document.querySelector('.clip.selected');
}

export function getSelectedEffectLayer(kind) {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  if (el.dataset.clipType !== 'effect/plain') return null;

  const label = el.dataset.track;
  if (!label) return null;

  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;

  const appState = getState();
  if (!appState) return null;

  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;

  const clip = track[clipIdx];
  if (!clip || !clip.__effectId) return null;

  if (kind && (!clip.effectState || clip.effectState.kind !== kind)) return null;

  return { clip, trackIdx, clipIdx };
}

export function findEffectLayerById(id) {
  if (!id) return null;
  const appState = getState();
  if (!appState) return null;

  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].__effectId === id) {
        return { clip: track[c], trackIdx: t, clipIdx: c };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CREATE — starts at PLAYHEAD, ends at clip end
// ═══════════════════════════════════════════════════════════════
export function createEffectLayer(kind, state, name) {
  const appState = getState();
  if (!appState) return null;

  const range = computeEffectRangeFromPlayhead();

  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const clipData = {
    name: name || getKindLabel(kind),
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: Object.assign({ kind: kind }, state),
    startTime: range.start,
    duration: range.duration,
    sourceIn: 0,
    __trimmed: true
  };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  placeClipAtTime(appState.timeline.visual, clipData, range.start);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  // Auto-select the newly created layer
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      selectEffectLayerByUrl(clipData.url);
    });
  });

  return id;
}

// ═══════════════════════════════════════════════════════════════
//  CREATE AT EXACT RANGE
// ═══════════════════════════════════════════════════════════════
export function createEffectLayerAtRange(kind, state, name, startTime, duration) {
  const appState = getState();
  if (!appState) return null;

  const start = Math.max(0, Number.isFinite(startTime) ? startTime : 0);
  const dur = (Number.isFinite(duration) && duration > 0)
    ? duration
    : DEFAULT_EFFECT_DURATION;

  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const clipData = {
    name: name || getKindLabel(kind),
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: Object.assign({ kind: kind }, state),
    startTime: start,
    duration: dur,
    sourceIn: 0,
    __trimmed: true
  };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  placeClipAtTime(appState.timeline.visual, clipData, start);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      selectEffectLayerByUrl(clipData.url);
    });
  });

  return id;
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE
// ═══════════════════════════════════════════════════════════════
export function updateEffectLayer(clip, updates) {
  if (!clip || !clip.__effectId) return;
  clip.effectState = Object.assign({}, clip.effectState, updates);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
}

// ═══════════════════════════════════════════════════════════════
//  SELECT BY URL
// ═══════════════════════════════════════════════════════════════
export function selectEffectLayerByUrl(url) {
  const appState = getState();
  if (!appState || !url) return false;

  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip.url === url) {
        const label = 'V' + (t + 1);
        const el = document.querySelector(
          '.clip[data-track="' + label + '"][data-clip="' + c + '"]'
        );
        if (el) {
          try {
            el.dispatchEvent(new MouseEvent('mousedown', {
              bubbles: true, cancelable: true, button: 0
            }));
            return true;
          } catch (_) {}
        }
        return false;
      }
    }
  }
  return false;
}

export function getKindLabel(kind) {
  const labels = {
    filter: 'Filter',
    adjustment: 'Adjustments',
    colorWheel: 'Color Wheels',
    chroma: 'Chroma Key',
    effect: 'Effect'
  };
  return labels[kind] || kind;
}