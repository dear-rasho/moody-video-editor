// ================================================================
//  js/workspace/trimPlayback.js
//  Enforces clip range ONLY during playback.
//  User can freely seek anywhere on the timeline.
// ================================================================

import { appState } from '../app.js';

const GUARD = 0.05;

export function initTrimPlayback(video) {
  if (!video) return;

  let loopTimer = null;
  let enforcing = false;

  // ─── URL matching (handles blob canonicalization) ───────────
  function urlsMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const aM = String(a).match(/blob:[^/]+\/(.+)$/);
    const bM = String(b).match(/blob:[^/]+\/(.+)$/);
    if (aM && bM) return aM[1] === bM[1];
    return false;
  }

  // ─── Find the clip for current URL ──────────────────────────
  function findClipForUrl(url) {
    const vTracks = appState.timeline.visual || [];
    const aTracks = appState.timeline.audio  || [];

    for (let t = 0; t < vTracks.length; t++) {
      const track = vTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        if (track[c] && track[c].url && urlsMatch(track[c].url, url)) return track[c];
      }
    }
    for (let t = 0; t < aTracks.length; t++) {
      const track = aTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        if (track[c] && track[c].url && urlsMatch(track[c].url, url)) return track[c];
      }
    }
    // Fallback: V1 first clip
    const v1 = vTracks[0];
    if (Array.isArray(v1) && v1.length) return v1[0];
    return null;
  }

  function getRange(clip) {
    const sourceIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
    const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
    return { in: sourceIn, out: sourceIn + duration };
  }

  // ─── Enforce during active playback ONLY ────────────────────
  function enforceNow() {
    if (video.paused || video.ended) {
      stopLoop();
      return;
    }
    if (enforcing) return;

    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;

    const r = getRange(clip);
    const t = video.currentTime;

    // Reached clip's out point → pause here (don't seek back)
    if (t >= r.out - GUARD) {
      enforcing = true;
      try { video.pause(); } catch (_) {}
      enforcing = false;
      stopLoop();
      return;
    }

    // Played past into pre-sourceIn region → jump forward
    if (t < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  }

  function startLoop() {
    if (loopTimer) return;
    enforceNow();
    loopTimer = setInterval(enforceNow, 50);
  }

  function stopLoop() {
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  video.addEventListener('play',    startLoop);
  video.addEventListener('playing', startLoop);
  video.addEventListener('pause',   stopLoop);
  video.addEventListener('ended',   stopLoop);

  // ─── On play press: prepare the start position ──────────────
  video.addEventListener('play', function () {
    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;

    const r = getRange(clip);
    const t = video.currentTime;

    // Past clip end → don't play (pause immediately)
    if (t >= r.out - GUARD) {
      enforcing = true;
      try { video.pause(); } catch (_) {}
      enforcing = false;
      return;
    }

    // Before sourceIn → jump forward to sourceIn
    if (t < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  });

  // ⚠️ NOTE: NO seeked clamp. User can move the playhead anywhere.
}