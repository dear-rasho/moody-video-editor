// ================================================================
//  js/features/keyframeEngine.js
//  Global keyframe engine — speed + sticker transforms.
//  No imports from app.js (standalone).
// ================================================================

let videoEl = null;
let rafId = null;

const speedRegistry = new Map();
const stickerRegistry = new Map();

// ─── Easing ────────────────────────────────────────────────────
export function getEasedValue(t, ease) {
  t = Math.max(0, Math.min(1, t));
  switch (ease) {
    case 'linear':         return t;
    case 'easeIn':         return t * t;
    case 'easeOut':        return 1 - (1 - t) * (1 - t);
    case 'easeInOut':      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':    return t * t * t;
    case 'easeOutCubic':   return 1 - Math.pow(1 - t, 3);
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
    default: return t;
  }
}

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

function samplePosition(t, kfs, ease) {
  if (!Array.isArray(kfs) || !kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time) return { x: kfs[0].x, y: kfs[0].y };
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return { x: last.x, y: last.y };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, ease);
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }
  }
  return { x: last.x, y: last.y };
}

function clampRate(r) {
  if (!Number.isFinite(r)) return 1.0;
  return Math.max(0.0625, Math.min(16, r));
}

// ─── Init ──────────────────────────────────────────────────────
export function initKeyframeEngine(opts) {
  videoEl = opts && opts.video ? opts.video : null;
  if (!videoEl) return;

  videoEl.addEventListener('play',         startLoop);
  videoEl.addEventListener('playing',      startLoop);
  videoEl.addEventListener('pause',        stopLoop);
  videoEl.addEventListener('ended',        stopLoop);
  videoEl.addEventListener('seeked',       applyOnce);
  videoEl.addEventListener('loadeddata',   applyOnce);
  videoEl.addEventListener('loadedmetadata', applyOnce);
}

// ─── Speed ─────────────────────────────────────────────────────
export function registerSpeed(clip) {
  if (!clip || !clip.url) return;

  const hasBase = Number.isFinite(clip.__speed) && Math.abs(clip.__speed - 1) > 0.001;
  const hasKf   = Array.isArray(clip.__speedKf) && clip.__speedKf.length > 0;

  if (!hasBase && !hasKf) {
    speedRegistry.delete(clip.url);
    return;
  }

  speedRegistry.set(clip.url, {
    kf: hasKf
      ? clip.__speedKf.map(function (k) { return { time: k.time, value: k.value }; })
      : [],
    ease: clip.__speedEase || 'easeInOut',
    base: Number.isFinite(clip.__speed) ? clip.__speed : 1.0
  });

  if (videoEl && videoEl.src && videoEl.src === clip.url) applyOnce();
}

export function unregisterSpeed(url) {
  if (!url) return;
  speedRegistry.delete(url);
}

// ─── Sticker ───────────────────────────────────────────────────
export function registerSticker(stickerId, data) {
  if (!stickerId) return;
  stickerRegistry.set(stickerId, {
    kfPosition: Array.isArray(data.kfPosition) ? data.kfPosition.slice() : [],
    kfScale:    Array.isArray(data.kfScale)    ? data.kfScale.slice()    : [],
    kfRotation: Array.isArray(data.kfRotation) ? data.kfRotation.slice() : [],
    easePosition: data.easePosition || 'easeInOut',
    easeScale:    data.easeScale    || 'easeInOut',
    easeRotation: data.easeRotation || 'easeInOut',
    overlay: data.overlay || null,
    base: {
      x: Number.isFinite(data.base && data.base.x) ? data.base.x : 50,
      y: Number.isFinite(data.base && data.base.y) ? data.base.y : 50,
      scale: Number.isFinite(data.base && data.base.scale) ? data.base.scale : 100,
      rotation: Number.isFinite(data.base && data.base.rotation) ? data.base.rotation : 0
    }
  });
  if (videoEl) applyStickers(videoEl.currentTime);
}

export function unregisterSticker(stickerId) {
  if (!stickerId) return;
  stickerRegistry.delete(stickerId);
}

export function updateStickerOverlay(stickerId, overlay) {
  const entry = stickerRegistry.get(stickerId);
  if (entry) entry.overlay = overlay;
}

// ─── Apply ─────────────────────────────────────────────────────
function applySpeed(t) {
  if (!videoEl) return;
  const entry = speedRegistry.get(videoEl.src);
  if (entry) {
    const rate = entry.kf.length
      ? sampleKeyframes(t, entry.kf, entry.ease, entry.base)
      : entry.base;
    videoEl.playbackRate = clampRate(rate);
  } else if (videoEl.playbackRate !== 1.0) {
    videoEl.playbackRate = 1.0;
  }
}

function applyStickers(t) {
  stickerRegistry.forEach(function (s) {
    if (!s.overlay || !s.overlay.parentNode) return;

    let x = s.base.x;
    let y = s.base.y;
    let scale = s.base.scale;
    let rotation = s.base.rotation;

    if (s.kfPosition.length) {
      const p = samplePosition(t, s.kfPosition, s.easePosition);
      if (p) { x = p.x; y = p.y; }
    }
    if (s.kfScale.length) {
      scale = sampleKeyframes(t, s.kfScale, s.easeScale, scale);
    }
    if (s.kfRotation.length) {
      rotation = sampleKeyframes(t, s.kfRotation, s.easeRotation, rotation);
    }

    s.overlay.style.left = x + '%';
    s.overlay.style.top  = y + '%';
    s.overlay.style.transform =
      'translate(-50%, -50%) scale(' + (scale / 100) + ') rotate(' + rotation + 'deg)';
  });
}

export function applyOnce() {
  if (!videoEl) return;
  const t = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : 0;
  applySpeed(t);
  applyStickers(t);
}

function startLoop() {
  if (!videoEl || rafId) return;
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  applyOnce();
}

function tick() {
  if (!videoEl || videoEl.paused || videoEl.ended) {
    rafId = null;
    return;
  }
  const t = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : 0;
  applySpeed(t);
  applyStickers(t);
  rafId = requestAnimationFrame(tick);
}