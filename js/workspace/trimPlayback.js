// ================================================================
//  js/workspace/trimPlayback.js
//  Enforces clip sourceIn / sourceOut during playback.
//
//  Bulletproof version:
//    • setInterval-based (not rAF) — no throttle issues
//    • Robust blob-URL matching
//    • Fallback to V1's first clip if URL match fails
//    • Immediate enforcement on play + on seek
// ================================================================

import { appState } from '../app.js';

const GUARD = 0.05;   // seconds of tolerance

export function initTrimPlayback(video) {
  if (!video) return;

  let loopTimer = null;
  let enforcing = false;

  // ─── URL matching (handles blob canonicalization) ───────────
  function urlsMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    // Blob URLs: compare only the UUID part
    const aM = String(a).match(/blob:[^/]+\/(.+)$/);
    const bM = String(b).match(/blob:[^/]+\/(.+)$/);
    if (aM && bM) return aM[1] === bM[1];
    return false;
  }

  // ─── Find the clip currently being played ──────────────────
  function findClipForUrl(url) {
    const vTracks = appState.timeline.visual || [];
    const aTracks = appState.timeline.audio  || [];

    // 1) URL match across visual tracks
    for (let t = 0; t < vTracks.length; t++) {
      const track = vTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (clip && clip.url && urlsMatch(clip.url, url)) return clip;
      }
    }

    // 2) URL match across audio tracks
    for (let t = 0; t < aTracks.length; t++) {
      const track = aTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (clip && clip.url && urlsMatch(clip.url, url)) return clip;
      }
    }

    // 3) Fallback — V1's clips: find one containing currentTime
    const v1 = vTracks[0];
    if (Array.isArray(v1) && v1.length) {
      const t = video.currentTime;
      for (let c = 0; c < v1.length; c++) {
        const clip = v1[c];
        if (!clip) continue;
        const inT = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
        const dur = Number.isFinite(clip.duration) ? clip.duration : 0;
        if (t >= inT - GUARD && t <= inT + dur + GUARD) return clip;
      }
      // Still nothing → first clip as last resort
      return v1[0];
    }

    return null;
  }

  // ─── Compute playback range ────────────────────────────────
  function getRange(clip) {
    const sourceIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
    const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
    return { in: sourceIn, out: sourceIn + duration };
  }

  // ─── Enforce on every tick ─────────────────────────────────
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

    if (t >= r.out - GUARD) {
      enforcing = true;
      try { video.pause(); } catch (_) {}
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
      stopLoop();
      return;
    }

    if (t < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  }

  // ─── Loop control ──────────────────────────────────────────
  function startLoop() {
    if (loopTimer) return;
    // Immediate check + 20Hz periodic check
    enforceNow();
    loopTimer = setInterval(enforceNow, 50);
  }

  function stopLoop() {
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = null;
  }

  // ─── Lifecycle events ──────────────────────────────────────
  video.addEventListener('play',    startLoop);
  video.addEventListener('playing', startLoop);
  video.addEventListener('pause',   stopLoop);
  video.addEventListener('ended',   stopLoop);

  // ── On play: if position is out of range, seek immediately ──
  video.addEventListener('play', function () {
    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;
    const r = getRange(clip);
    const t = video.currentTime;
    if (t < r.in - GUARD || t >= r.out - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  });

  // ── On manual seek: clamp into range ───────────────────────
  video.addEventListener('seeked', function () {
    if (enforcing) return;
    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;
    const r = getRange(clip);
    const t = video.currentTime;

    if (t < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    } else if (t > r.out + GUARD) {
      enforcing = true;
      try { video.currentTime = r.out - GUARD; } catch (_) {}
      enforcing = false;
    }
  });

  // ─── Debug hook (optional — remove later) ──────────────────
  // Uncomment to see what's happening in the console:
  // video.addEventListener('timeupdate', function () {
  //   const src = video.currentSrc || video.src || '';
  //   const clip = findClipForUrl(src);
  //   if (clip) {
  //     const r = getRange(clip);
  //     console.log('[trim] t=' + video.currentTime.toFixed(2) +
  //                 ' in=' + r.in + ' out=' + r.out);
  //   } else {
  //     console.log('[trim] no clip for', src);
  //   }
  // });
}