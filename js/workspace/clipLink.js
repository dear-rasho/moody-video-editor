// ================================================================
//  js/workspace/clipLink.js
//  Propagates trim/move changes to clips linked via __linkedId
//  (e.g., video ↔ auto-generated audio).
// ================================================================

import { appState } from '../app.js';

export function findLinkedClips(primaryClip) {
  if (!primaryClip) return [];
  const linkedId = primaryClip.__linkedId;
  if (!linkedId) return [];

  const result = [];
  const allTracks = []
    .concat(appState.timeline.visual || [])
    .concat(appState.timeline.audio  || []);

  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip !== primaryClip && clip.__linkedId === linkedId) {
        result.push(clip);
      }
    }
  }
  return result;
}

export function applyTrimToLinked(primaryClip, snapshot) {
  const linked = findLinkedClips(primaryClip);
  for (let i = 0; i < linked.length; i++) {
    const clip = linked[i];
    if (Number.isFinite(snapshot.startTime)) clip.startTime = snapshot.startTime;
    if (Number.isFinite(snapshot.duration))  clip.duration  = snapshot.duration;
    if (Number.isFinite(snapshot.sourceIn))  clip.sourceIn  = snapshot.sourceIn;
    clip.__trimmed = true;
  }
  return linked.length;
}

// 🆕 Propagate just startTime (for drag-move)
export function propagateStartTime(primaryClip) {
  const linked = findLinkedClips(primaryClip);
  for (let i = 0; i < linked.length; i++) {
    linked[i].startTime = primaryClip.startTime;
  }
  return linked.length;
}