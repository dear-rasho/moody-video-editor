// ================================================================
//  js/workspace/playbackEngine.js
//  Master playback clock.
//
//  Layer compositing — looks at ALL visual clips at the current
//  time, finds the top-most VIDEO clip, plays it. Text/image/
//  sticker overlays render independently on top.
//
//  Audio: plays standalone audio clips ONLY. Auto-generated audio
//  from video is muted (video's own audio plays directly). Audio FX
//  layers are handled separately by audioFxRenderer.js.
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

  // All visual clips at time, sorted bottom→top (V1 first)
  // Skips hidden tracks.
  function getVisualStackAt(time) {
    const tracks = appState.timeline.visual || [];
    const hidden = appState.timeline.hiddenVisualTracks || new Set();
    const stack = [];
    for (let t = 0; t < tracks.length; t++) {
      if (hidden.has(t)) continue;
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip) continue;
        if (clipContainsTime(clip, time)) {
          stack.push({ clip, trackIndex: t });
          break;
        }
      }
    }
    return stack;
  }

  // Top-most video clip in the active stack
  function getTopVideoClipInStack(stack) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (isVideoClip(stack[i].clip)) return stack[i].clip;
    }
    return null;
  }

  // Active audio clip — respects muted tracks; skips generated
  // sound effects AND audio FX layers (both handled elsewhere).
  function getActiveAudioClipAt(time) {
    const tracks = appState.timeline.audio || [];
    const muted = appState.timeline.mutedAudioTracks || new Set();
    for (let t = 0; t < tracks.length; t++) {
      if (muted.has(t)) continue;
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (!clip) continue;
        if (clip.__soundId) continue;     // generated SFX → soundeffect.js
        if (clip.__audioFxId) continue;   // audio FX layer → audioFxRenderer.js
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

  // ─── Preload next video clip ──────────────────────────────
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
      video.src = bestClip.url;
      video.load();
      const onMeta = function () {
        video.removeEventListener('loadedmetadata', onMeta);
        try { video.currentTime = localTime; } catch (_) {}
      };
      video.addEventListener('loadedmetadata', onMeta);
      return;
    }

    if (video.paused) {
      const drift = Math.abs(video.currentTime - localTime);
      if (drift > 0.15) {
        try { video.currentTime = localTime; } catch (_) {}
      }
    }
  }

  // ─── Render frame ─────────────────────────────────────────
  function renderFrame(time) {
    const audioClip = getActiveAudioClipAt(time);
    const visualStack = getVisualStackAt(time);
    const videoClip = getTopVideoClipInStack(visualStack);

    // ═══ VIDEO BASE ═══
    if (videoClip) {
      const local = computeLocalTime(videoClip, time);
      const sameSrc = srcMatches(video, videoClip.url);

      if (!sameSrc) {
        syncVideoPosition(videoClip, local);
      } else {
        const drift = Math.abs(video.currentTime - local);
        if (playing) {
          if (drift > 0.5) {
            try { video.currentTime = local; } catch (_) {}
          }
        } else {
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
      pauseVideoIfNeeded();
      preloadUpcomingVideo(time);
      drawBlack();
    }

    // ═══ AUDIO ═══
    // Only play standalone audio clips. Auto-generated audio from
    // video plays via the video element itself (unmuted). Audio FX
    // layers are handled by audioFxRenderer.js.
    if (audioClip && audioClip.url) {
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