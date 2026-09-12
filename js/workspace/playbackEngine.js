// ================================================================
//  js/workspace/playbackEngine.js
//  Master playback clock.
//
//  NEW: Preloads the upcoming video clip while playhead is in a
//  blank/text/image area, so playback starts instantly when the
//  video clip's region begins.
// ================================================================

import { appState } from '../app.js';

const PRELOAD_AHEAD_SEC = 1.8;

export function initPlaybackEngine({ canvas, video, audio, preview, onTick }) {
  if (!canvas) return null;

  window.__previewBlockAutoDraw = true;

  let playheadTime = 0;
  let playing = false;
  let rafId = null;
  let lastRealTime = 0;

  let _ctx = null;
  function getCtx() {
    if (_ctx) return _ctx;
    try { _ctx = canvas.getContext('2d', { willReadFrequently: true }); }
    catch (_) { _ctx = canvas.getContext('2d'); }
    return _ctx;
  }

  // ─── Clip helpers ─────────────────────────────────────────
  function clipContainsTime(clip, time) {
    const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
    const d = Number.isFinite(clip.duration) ? clip.duration : 0;
    return time >= s && time < s + d;
  }

  function isVideoClip(c) {
    return c && c.type && c.type.indexOf('video/') === 0;
  }

  function getTopVisualClipAt(time) {
    const tracks = appState.timeline.visual || [];
    let topClip = null;
    let topIdx = -1;
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip) continue;
        if (clipContainsTime(clip, time)) {
          if (t > topIdx) { topClip = clip; topIdx = t; }
        }
      }
    }
    return topClip;
  }

  function getActiveAudioClipAt(time) {
    const tracks = appState.timeline.audio || [];
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip) continue;
        if (clipContainsTime(clip, time)) return clip;
      }
    }
    return null;
  }

  function computeLocalTime(clip, timelineTime) {
    const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
    const srcIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
    return srcIn + (timelineTime - s);
  }

  function getTimelineDuration() {
    let maxEnd = 0;
    const all = (appState.timeline.visual || []).concat(appState.timeline.audio || []);
    for (let t = 0; t < all.length; t++) {
      const track = all[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip) continue;
        const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
        const d = Number.isFinite(clip.duration) ? clip.duration : 0;
        if (s + d > maxEnd) maxEnd = s + d;
      }
    }
    return maxEnd;
  }

  // ─── Canvas ───────────────────────────────────────────────
  function syncCanvasSize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawBlack() {
    const c = getCtx();
    if (!c) return;
    syncCanvasSize();
    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ─── URL matching ─────────────────────────────────────────
  function srcMatches(el, url) {
    if (!el || !url) return false;
    const a = el.currentSrc || el.src || '';
    if (!a) return false;
    if (a === url) return true;
    // Normalize blob: compare UUIDs
    const aM = a.match(/blob:[^/]+\/(.+)$/);
    const bM = String(url).match(/blob:[^/]+\/(.+)$/);
    if (aM && bM) return aM[1] === bM[1];
    return false;
  }

  // ─── Video positioning ────────────────────────────────────
  function syncVideoPosition(clip, localTime) {
    if (!video) return;
    if (!srcMatches(video, clip.url)) {
      video.src = clip.url;
      video.load();
      const onMeta = function () {
        video.removeEventListener('loadedmetadata', onMeta);
        try { video.currentTime = localTime; } catch (_) {}
      };
      video.addEventListener('loadedmetadata', onMeta);
      return;
    }
    const drift = Math.abs(video.currentTime - localTime);
    if (drift > 0.20) {
      try { video.currentTime = localTime; } catch (_) {}
    }
  }

  function syncAudioPosition(clip, localTime) {
    if (!audio) return;
    if (!srcMatches(audio, clip.url)) {
      audio.src = clip.url;
      audio.load();
      const onMeta = function () {
        audio.removeEventListener('loadedmetadata', onMeta);
        try { audio.currentTime = localTime; } catch (_) {}
      };
      audio.addEventListener('loadedmetadata', onMeta);
      return;
    }
    const drift = Math.abs(audio.currentTime - localTime);
    if (drift > 0.20) {
      try { audio.currentTime = localTime; } catch (_) {}
    }
  }

  function pauseVideoIfNeeded() {
    if (video && !video.paused) { try { video.pause(); } catch (_) {} }
  }
  function pauseAudioIfNeeded() {
    if (audio && !audio.paused) { try { audio.pause(); } catch (_) {} }
  }

  // ═══════════════════════════════════════════════════════════
  //  PRELOAD: While playhead is NOT inside a video clip, prepare
  //  the next upcoming video clip's source position in the paused
  //  video element, so play() starts instantly.
  // ═══════════════════════════════════════════════════════════
  function preloadUpcomingVideo(currentTime) {
    const tracks = appState.timeline.visual || [];
    let bestClip = null;
    let bestStart = Infinity;

    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip || !isVideoClip(clip)) continue;
        const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
        if (s > currentTime &&
            s <= currentTime + PRELOAD_AHEAD_SEC &&
            s < bestStart) {
          bestClip = clip;
          bestStart = s;
        }
      }
    }

    if (!bestClip) return;

    const localTime = Number.isFinite(bestClip.sourceIn) ? bestClip.sourceIn : 0;
    const sameSrc = srcMatches(video, bestClip.url);

    if (!sameSrc) {
      // Different file → load + seek to sourceIn while paused
      video.src = bestClip.url;
      video.load();
      const onMeta = function () {
        video.removeEventListener('loadedmetadata', onMeta);
        try { video.currentTime = localTime; } catch (_) {}
      };
      video.addEventListener('loadedmetadata', onMeta);
      return;
    }

    // Same file → seek to sourceIn while paused (video is already paused here)
    if (video.paused) {
      const drift = Math.abs(video.currentTime - localTime);
      if (drift > 0.15) {
        try { video.currentTime = localTime; } catch (_) {}
      }
    }
  }

  // ─── Render frame ─────────────────────────────────────────
  function renderFrame(time) {
    const topClip = getTopVisualClipAt(time);
    const audioClip = getActiveAudioClipAt(time);

    // ═══ VIDEO ═══
    if (isVideoClip(topClip)) {
      const local = computeLocalTime(topClip, time);
      const sameSrc = srcMatches(video, topClip.url);

      if (!sameSrc) {
        // Wrong source — full sync (slower path, rare with preload)
        syncVideoPosition(topClip, local);
      } else {
        const drift = Math.abs(video.currentTime - local);
        if (playing) {
          // During play: only correct BIG drift (>0.5s). Small drift is fine.
          if (drift > 0.5) {
            try { video.currentTime = local; } catch (_) {}
          }
        } else {
          // Paused: correct precisely
          if (drift > 0.15) {
            try { video.currentTime = local; } catch (_) {}
          }
        }
      }

      if (playing) {
        if (video.paused) video.play().catch(() => {});
      } else {
        pauseVideoIfNeeded();
      }

      if (preview && typeof preview.redraw === 'function') {
        preview.redraw();
      } else {
        drawBlack();
        if (video && video.readyState >= 2) {
          try { getCtx().drawImage(video, 0, 0, canvas.width, canvas.height); } catch (_) {}
        }
      }
    } else {
      // 🆕 No video clip here → preload next one while paused
      pauseVideoIfNeeded();
      preloadUpcomingVideo(time);
      drawBlack();
    }

    // ═══ AUDIO ═══
    if (audioClip && audioClip.url && !audioClip.autoGenerated) {
      const local = computeLocalTime(audioClip, time);
      syncAudioPosition(audioClip, local);
      if (playing) {
        if (audio.paused) audio.play().catch(() => {});
      } else {
        pauseAudioIfNeeded();
      }
    } else {
      pauseAudioIfNeeded();
    }
  }

  // ─── rAF loop ─────────────────────────────────────────────
  function tick(now) {
    if (!playing) return;
    const dt = (now - lastRealTime) / 1000;
    lastRealTime = now;
    playheadTime += dt;

    const duration = getTimelineDuration();
    if (duration > 0 && playheadTime >= duration) {
      playheadTime = duration;
      renderFrame(playheadTime);
      emitTick();
      stop();
      return;
    }

    renderFrame(playheadTime);
    emitTick();
    rafId = requestAnimationFrame(tick);
  }

  function emitTick() {
    const detail = { time: playheadTime, duration: getTimelineDuration() };
    if (typeof onTick === 'function') {
      try { onTick(playheadTime, detail.duration); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent('playback:tick', { detail }));
  }

  // ─── Public API ───────────────────────────────────────────
  function play() {
    if (playing) return;
    const duration = getTimelineDuration();
    if (duration <= 0) return;
    if (playheadTime >= duration - 0.01) playheadTime = 0;
    playing = true;
    lastRealTime = performance.now();
    // Trigger an immediate render so play() of video is called ASAP
    renderFrame(playheadTime);
    rafId = requestAnimationFrame(tick);
    document.dispatchEvent(new CustomEvent('playback:state', { detail: { playing: true } }));
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pauseVideoIfNeeded();
    pauseAudioIfNeeded();
    document.dispatchEvent(new CustomEvent('playback:state', { detail: { playing: false } }));
  }

  function seek(time) {
    const wasPlaying = playing;
    pauseVideoIfNeeded();
    pauseAudioIfNeeded();
    playheadTime = Math.max(0, Math.min(getTimelineDuration(), Number(time) || 0));
    renderFrame(playheadTime);
    emitTick();
    if (wasPlaying) {
      lastRealTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  function getTime() { return playheadTime; }
  function isPlaying() { return playing; }

  renderFrame(playheadTime);
  emitTick();

  return {
    play,
    pause: stop,
    stop,
    seek,
    getTime,
    isPlaying,
    getDuration: getTimelineDuration,
    redraw: () => renderFrame(playheadTime)
  };
}