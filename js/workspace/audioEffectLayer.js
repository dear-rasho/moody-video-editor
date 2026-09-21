// ================================================================
//  js/workspace/audioEffectLayer.js
//  Audio FX layer CRUD.
//  Layer = clip in timeline.audio with __audioFxId + __audioFxKey.
// ================================================================

import { placeClipAtTime } from '../layers/layersManager.js';

export const DEFAULT_FX_DURATION = 3;

function getState() { return window.__appState; }

// ─── Create ───────────────────────────────────────────────────
export function createAudioFxLayer(effectKey, label, duration) {
  const appState = getState();
  if (!appState) return null;

  const eng = window.__playbackEngine;
  const atTime = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
  const dur = Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_FX_DURATION;

  const id = 'afx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const clip = {
    name: (label || effectKey),
    url: 'audiofx://' + id,
    type: 'audio/effect',
    duration: dur,
    startTime: atTime,
    sourceIn: 0,
    __audioFxId: id,
    __audioFxKey: effectKey,
    __trimmed: true
  };

  if (!Array.isArray(appState.timeline.audio)) appState.timeline.audio = [];
  placeClipAtTime(appState.timeline.audio, clip, atTime);

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  // Auto-select the newly created FX layer
  requestAnimationFrame(() => {
    requestAnimationFrame(() => selectAudioFxLayerByUrl(clip.url));
  });

  return id;
}

// ─── Find ─────────────────────────────────────────────────────
export function findAudioFxLayerById(id) {
  if (!id) return null;
  const appState = getState();
  if (!appState) return null;
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip.__audioFxId === id) return { clip, trackIdx: t, clipIdx: c };
    }
  }
  return null;
}

export function getActiveAudioFxAt(time) {
  const appState = getState();
  if (!appState) return null;
  const tracks = appState.timeline.audio || [];
  const muted = appState.timeline.mutedAudioTracks || new Set();

  for (let t = 0; t < tracks.length; t++) {
    if (muted.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__audioFxId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) return clip;
    }
  }
  return null;
}
// ═══════════════════════════════════════════════════════════════
//  🆕 GET ALL ACTIVE FX — returns list sorted by track index
//  (bottom → top, so chaining goes bottom-to-top)
// ═══════════════════════════════════════════════════════════════
export function getActiveAudioFxListAt(time) {
  const appState = getState();
  if (!appState) return [];
  const tracks = appState.timeline.audio || [];
  const muted = appState.timeline.mutedAudioTracks || new Set();
  const result = [];

  for (let t = 0; t < tracks.length; t++) {
    if (muted.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__audioFxId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        result.push({ key: clip.__audioFxKey, trackIndex: t, clip });
        break; // only one FX per track
      }
    }
  }

  // Sort bottom → top (chaining order)
  result.sort((a, b) => a.trackIndex - b.trackIndex);
  return result;
}

export function getSelectedAudioFxLayer() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'A') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = getState();
  if (!appState) return null;
  const track = appState.timeline.audio[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip || !clip.__audioFxId) return null;
  return { clip, trackIdx, clipIdx };
}

// ─── Remove ───────────────────────────────────────────────────
export function removeAudioFxLayer(clip) {
  if (!clip || !clip.__audioFxId) return false;
  const appState = getState();
  if (!appState) return false;
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__audioFxId === clip.__audioFxId);
    if (idx >= 0) {
      track.splice(idx, 1);
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      return true;
    }
  }
  return false;
}

// ─── Select by URL ────────────────────────────────────────────
export function selectAudioFxLayerByUrl(url) {
  const appState = getState();
  if (!appState || !url) return false;
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].url === url) {
        const el = document.querySelector(
          '.clip[data-track="A' + (t + 1) + '"][data-clip="' + c + '"]'
        );
        if (el) {
          try {
            el.dispatchEvent(new MouseEvent('mousedown', {
              bubbles: true, cancelable: true, button: 0
            }));
            return true;
          } catch (_) {}
        }
      }
    }
  }
  return false;
}