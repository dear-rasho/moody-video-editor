// ================================================================
//  js/features/keyframeEngine.js
//  Global keyframe animation engine.
//
//  Watches the <video> element during playback and applies any
//  registered per-clip animations (speed for now, extendable).
//
//  Registry key  : video src URL (blob:...) — matches clip.url
//  Registry value: { speed: { kf, ease, base } }
//
//  Public API:
//    initKeyframeEngine({ video })    — call once at boot
//    registerSpeed(clip)              — call whenever a clip's speed
//                                       base / keyframes / easing change
//    unregisterClip(url)              — optional, on clip delete
//    applyOnce()                      — manually apply at current time
// ================================================================

let videoEl = null;
let rafId = null;

// url → { speed: { kf:[{time,value}], ease, base } }
const registry = new Map();

// ─── Easing math (shared, used by speed panel too) ─────────────
export function getEasedValue(t, ease) {
  t = Math.max(0, Math.min(1, t));
  switch (ease) {
    case 'linear':        return t;
    case 'easeIn':        return t * t;
    case 'easeOut':       return 1 - (1 - t) * (1 - t);
    case 'easeInOut':     return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':   return t * t * t;
    case 'easeOutCubic':  return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeInBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'easeOutBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'easeInOutBack': {
      const c1 = 1.70158, c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 'easeOutBounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'easeOutElastic': {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    default:
      return t;
  }
}

// ─── Generic keyframe sampler ─────────────────────────────────
//  Given a time, list of {time,value}, easing, and a base fallback,
//  returns the interpolated value at that time.
export function sampleKeyframes(t, kfs, ease, base) {
  if (!Array.isArray(kfs) || !kfs.length) return base;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, ease);
      return a.value + (b.value - a.value) * local;
    }
  }
  return last.value;
}

// ─── Rate clamp ────────────────────────────────────────────────
function clampRate(r) {
  if (!Number.isFinite(r)) return 1.0;
  return Math.max(0.0625, Math.min(16, r));
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

export function initKeyframeEngine(opts) {
  videoEl = opts && opts.video ? opts.video : null;
  if (!videoEl) return;

  videoEl.addEventListener('play',    startLoop);
  videoEl.addEventListener('playing', startLoop);
  videoEl.addEventListener('pause',   stopLoop);
  videoEl.addEventListener('ended',   stopLoop);
  videoEl.addEventListener('seeked',  applyOnce);
  videoEl.addEventListener('loadeddata', applyOnce);

  // React to src changes too
  videoEl.addEventListener('loadedmetadata', applyOnce);
}

export function registerSpeed(clip) {
  if (!clip || !clip.url) return;

  const hasBase = Number.isFinite(clip.__speed) && Math.abs(clip.__speed - 1) > 0.001;
  const hasKf   = Array.isArray(clip.__speedKf) && clip.__speedKf.length > 0;

  if (!hasBase && !hasKf) {
    unregisterClip(clip.url);
    return;
  }

  const entry = registry.get(clip.url) || {};
  entry.speed = {
    kf: hasKf
      ? clip.__speedKf.map(function (k) { return { time: k.time, value: k.value }; })
      : [],
    ease: clip.__speedEase || 'easeInOut',
    base: Number.isFinite(clip.__speed) ? clip.__speed : 1.0
  };
  registry.set(clip.url, entry);

  // If video is currently paused and loaded with this src, apply now
  if (videoEl && videoEl.src && videoEl.src === clip.url) {
    applyOnce();
  }
}

export function unregisterClip(url) {
  if (!url) return;
  registry.delete(url);
}

export function applyOnce() {
  if (!videoEl) return;
  const entry = registry.get(videoEl.src);
  if (entry && entry.speed) {
    const s = entry.speed;
    const rate = s.kf.length
      ? sampleKeyframes(videoEl.currentTime, s.kf, s.ease, s.base)
      : s.base;
    videoEl.playbackRate = clampRate(rate);
  } else {
    videoEl.playbackRate = 1.0;
  }
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════

function startLoop() {
  if (!videoEl || rafId) return;
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  // Apply the value at the current frame once, so paused state is accurate
  applyOnce();
}

function tick() {
  if (!videoEl || videoEl.paused || videoEl.ended) {
    rafId = null;
    return;
  }

  const entry = registry.get(videoEl.src);
  if (entry && entry.speed) {
    const s = entry.speed;
    const rate = s.kf.length
      ? sampleKeyframes(videoEl.currentTime, s.kf, s.ease, s.base)
      : s.base;
    videoEl.playbackRate = clampRate(rate);
  } else {
    // No registered animation → normal speed
    if (videoEl.playbackRate !== 1.0) videoEl.playbackRate = 1.0;
  }

  rafId = requestAnimationFrame(tick);
}