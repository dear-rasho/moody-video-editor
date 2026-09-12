// ================================================================
//  js/workspace/trimPlayback.js
//  Prevents the trimmed-out portion from playing.
//
//  When the preview video's currentTime goes past sourceIn+duration
//  for the clip that owns the video URL, playback pauses.
//  When currentTime is before sourceIn (e.g. user seeked into the
//  trimmed-away head), it jumps forward to sourceIn.
// ================================================================

import { appState } from '../app.js';

const GUARD = 0.06;   // seconds of tolerance

export function initTrimPlayback(video) {
  if (!video) return;

  let enforcing = false;

  function findClipForUrl(url) {
    if (!url) return null;
    const vTracks = appState.timeline.visual || [];
    const aTracks = appState.timeline.audio  || [];

    for (let t = 0; t < vTracks.length; t++) {
      const track = vTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (clip && clip.url === url) return clip;
      }
    }
    for (let t = 0; t < aTracks.length; t++) {
      const track = aTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (clip && clip.url === url) return clip;
      }
    }
    return null;
  }

  function getRange(clip) {
    const sourceIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
    const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
    return { in: sourceIn, out: sourceIn + duration };
  }

  // ─── Enforce range on every frame ────────────────────────────
  video.addEventListener('timeupdate', () => {
    if (enforcing) return;
    if (video.paused || video.ended) return;

    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;

    const r = getRange(clip);

    if (video.currentTime >= r.out - GUARD) {
      enforcing = true;
      try { video.pause(); } catch (_) {}
      // Reset for next play (jump to sourceIn so restart is clean)
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
      return;
    }

    if (video.currentTime < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  });

  // ─── When user hits Play: if currentTime is out of range, seek ─
  video.addEventListener('play', () => {
    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;

    const r = getRange(clip);
    if (video.currentTime < r.in - GUARD ||
        video.currentTime >= r.out - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
  });

  // ─── Also enforce on seeked ──────────────────────────────────
  video.addEventListener('seeked', () => {
    if (enforcing) return;
    const src = video.currentSrc || video.src || '';
    const clip = findClipForUrl(src);
    if (!clip) return;
    const r = getRange(clip);
    if (video.currentTime < r.in - GUARD) {
      enforcing = true;
      try { video.currentTime = r.in; } catch (_) {}
      enforcing = false;
    }
    if (video.currentTime > r.out + GUARD) {
      enforcing = true;
      try { video.currentTime = r.out - GUARD; } catch (_) {}
      enforcing = false;
    }
  });
}
