// ================================================================
//  js/codebase/duplicateEngine.js
//  Prompt-based clip duplication.
//  Works with single, multi-select, or "all" clips.
// ================================================================

function deepCloneClip(clip) {
  let copy;
  try { copy = JSON.parse(JSON.stringify(clip)); }
  catch (_) { copy = Object.assign({}, clip); }

  const now = Date.now();
  const rnd = Math.random().toString(36).slice(2, 7);

  delete copy.__linkedId;
  delete copy.__beats;
  delete copy.__beatsDetectedAt;

  if (copy.__effectId)  { copy.__effectId  = 'fx-' + now + '-' + rnd; copy.url = 'effect://'  + copy.__effectId; }
  if (copy.__textId)    { copy.__textId    = 'tx-' + now + '-' + rnd; copy.url = 'text://'    + copy.__textId; }
  if (copy.__stickerId) { copy.__stickerId = 'sk-' + now + '-' + rnd; copy.url = 'sticker://' + copy.__stickerId; }
  if (copy.__audioFxId) { copy.__audioFxId = 'afx-' + now + '-' + rnd; copy.url = 'audiofx://' + copy.__audioFxId; }
  if (copy.__soundId)   { copy.__soundId   = 'se-' + now + '-' + rnd; }

  copy.name = (clip.name || 'Clip') + ' copy';
  return copy;
}

function findSelectedClips() {
  const result = [];

  // Multi-select first
  const multi = window.__multiSelect;
  if (multi && typeof multi.forEachSelectedClip === 'function') {
    multi.forEachSelectedClip(function (c) { if (c) result.push(c); });
  }

  // Single select fallback
  if (result.length === 0) {
    const el = document.querySelector('.clip.selected');
    if (el) {
      const appState = window.__appState;
      if (appState) {
        const label = el.dataset.track;
        const ci = Number(el.dataset.clip);
        if (label && Number.isFinite(ci)) {
          const group = label[0] === 'A' ? 'audio' : 'visual';
          const ti = Number(label.slice(1)) - 1;
          const tr = appState.timeline[group] && appState.timeline[group][ti];
          if (Array.isArray(tr) && tr[ci]) result.push(tr[ci]);
        }
      }
    }
  }

  return result;
}

function locateClip(clip, appState) {
  const groups = ['visual', 'audio'];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const list = appState.timeline[group] || [];
    for (let t = 0; t < list.length; t++) {
      const track = list[t];
      if (!Array.isArray(track)) continue;
      if (track.indexOf(clip) >= 0) {
        return { group: group, trackIdx: t, list: list, track: track };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Run duplicate
// ═══════════════════════════════════════════════════════════════
export function runDuplicate(opts) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  opts = opts || {};
  const mode = opts.mode || 'selected';     // 'selected' | 'all' | 'layer'
  const layerKey = opts.layerKey || null;   // e.g. 'V1', 'A2'
  const count = Math.max(1, Math.min(10, opts.count || 1));

  // ─── Collect clips to duplicate ──────────────────────
  let clipsToDup = [];
  let targetGroup = 'visual';

  if (mode === 'all' || mode === 'layer') {
    let group = 'visual';
    let trackIdx = 0;

    if (layerKey) {
      group = layerKey.charAt(0).toUpperCase() === 'A' ? 'audio' : 'visual';
      trackIdx = parseInt(layerKey.slice(1), 10) - 1;
    }

    const list = appState.timeline[group] || [];
    const track = list[trackIdx];
    if (!Array.isArray(track) || !track.length) {
      return { ok: false, error: 'No clips on layer ' + (layerKey || 'V1') };
    }
    clipsToDup = track.slice();
    targetGroup = group;
  } else {
    clipsToDup = findSelectedClips();
    if (!clipsToDup.length) {
      return { ok: false, error: 'Select clips first (or use "duplicate all")' };
    }
  }

  // ─── Group clips by their track + duplicate above ────
  const groups = new Map();  // key = group + '::' + trackIdx

  for (let i = 0; i < clipsToDup.length; i++) {
    const clip = clipsToDup[i];
    const loc = locateClip(clip, appState);
    if (!loc) continue;
    const key = loc.group + '::' + loc.trackIdx;
    if (!groups.has(key)) groups.set(key, { group: loc.group, trackIdx: loc.trackIdx, clips: [] });
    groups.get(key).clips.push(clip);
  }

  if (!groups.size) {
    return { ok: false, error: 'Could not locate selected clips' };
  }

  // ─── Duplicate each group into next track ────────────
  let totalDuplicated = 0;
  let layersCreated = 0;

  groups.forEach(function (info) {
    const list = appState.timeline[info.group] || [];
    const srcTrackIdx = info.trackIdx;
    let destTrackIdx = srcTrackIdx + 1;

    // Duplicate multiple times (count)
    for (let n = 0; n < count; n++) {
      // Ensure dest track exists
      while (list.length <= destTrackIdx) list.push([]);
      const destTrack = list[destTrackIdx];
      if (!Array.isArray(destTrack)) continue;

      for (let ci = 0; ci < info.clips.length; ci++) {
        const src = info.clips[ci];
        const copy = deepCloneClip(src);
        destTrack.push(copy);
        totalDuplicated++;
      }

      destTrack.sort(function (a, b) {
        return (a.startTime || 0) - (b.startTime || 0);
      });

      layersCreated++;
      destTrackIdx++;
    }
  });

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  return {
    ok: true,
    count: totalDuplicated,
    layers: layersCreated
  };
}