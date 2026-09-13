// ================================================================
//  js/workspace/effectLayer.js
//  Helpers to create / find / update / SELECT effect layers.
//  Effect layer = clip with type 'effect/plain' + __effectId.
// ================================================================

import { placeClipAtTime } from '../layers/layersManager.js';

export const DEFAULT_EFFECT_DURATION = 4;

function getState() {
  return window.__appState;
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
export function createEffectLayer(kind, state, name) {
  const appState = getState();
  if (!appState) return null;

  const eng = window.__playbackEngine;
  const atTime = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const clipData = {
    name: name || getKindLabel(kind),
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: Object.assign({ kind: kind }, state),
    startTime: atTime,
    duration: DEFAULT_EFFECT_DURATION,
    sourceIn: 0,
    __trimmed: true
  };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  placeClipAtTime(appState.timeline.visual, clipData, atTime);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  // 🆕 Auto-select the newly created layer so the delete button targets it
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      selectEffectLayerByUrl(clipData.url);
    });
  });

  return id;
}

// ─── Update ───────────────────────────────────────────────────
export function updateEffectLayer(clip, updates) {
  if (!clip || !clip.__effectId) return;
  clip.effectState = Object.assign({}, clip.effectState, updates);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

// ─── Programmatic selection ───────────────────────────────────
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
    crop: 'Crop',
    effect: 'Effect'
  };
  return labels[kind] || kind;
}