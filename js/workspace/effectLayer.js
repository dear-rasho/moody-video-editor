// ================================================================
//  js/workspace/effectLayer.js
//  Effect layer CRUD.
//
//  FIX: Default duration = FULL timeline end, so chroma/filter/
//       adjustment/colorwheel apply to the WHOLE video by default.
//       User can trim/move them like any other layer.
// ================================================================

import { placeClipAtTime } from '../layers/layersManager.js';

export const DEFAULT_EFFECT_DURATION = 3;

function getState() { return window.__appState; }

// ─── Compute timeline end (ignore other effect/fx layers) ─────
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
      if (clip.__effectId) continue;    // ignore other effect layers
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

// ─── Selection helpers ────────────────────────────────────────
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

// ─── Create ───────────────────────────────────────────────────
//  🆕 Default: startTime = 0, duration = FULL timeline end
export function createEffectLayer(kind, state, name) {
  const appState = getState();
  if (!appState) return null;

  // Compute full timeline duration
  const timelineEnd = computeTimelineEnd();
  const dur = timelineEnd > 0 ? timelineEnd : DEFAULT_EFFECT_DURATION;

  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const clipData = {
    name: name || getKindLabel(kind),
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: Object.assign({ kind: kind }, state),
    startTime: 0,                    // 🆕 start from 0
    duration: dur,                   // 🆕 full timeline
    sourceIn: 0,
    __trimmed: true
  };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  placeClipAtTime(appState.timeline.visual, clipData, 0);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  // Auto-select the newly created layer
  requestAnimationFrame(() => {
    requestAnimationFrame(() => selectEffectLayerByUrl(clipData.url));
  });

  return id;
}

// ─── Update ───────────────────────────────────────────────────
export function updateEffectLayer(clip, updates) {
  if (!clip || !clip.__effectId) return;
  clip.effectState = Object.assign({}, clip.effectState, updates);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
}

// ─── Select by URL ────────────────────────────────────────────
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