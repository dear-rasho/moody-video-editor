// ================================================================
//  js/workspace/keyframeStore.js
//  Keyframes + FULL easing library.
// ================================================================

export const ANIMATABLE_PROPS = [
  'x', 'y', 'scale', 'rotation',
  'anchorX', 'anchorY',
  'cropL', 'cropR', 'cropT', 'cropB'
];

const DEFAULT_EASE = 'quadInOut';

export function getKeyframes(clip, prop) {
  if (!clip || !clip.__keyframes) return [];
  return clip.__keyframes[prop] || [];
}

export function getPropKeys(clip) {
  if (!clip || !clip.__keyframes) return [];
  return Object.keys(clip.__keyframes).filter(k => clip.__keyframes[k] && clip.__keyframes[k].length);
}

export function hasAnyKeyframes(clip) {
  return getPropKeys(clip).length > 0;
}

export function findKeyframeIndex(clip, prop, time, tolerance = 0.05) {
  const kfs = getKeyframes(clip, prop);
  for (let i = 0; i < kfs.length; i++) {
    if (Math.abs(kfs[i].time - time) <= tolerance) return i;
  }
  return -1;
}

export function setKeyframe(clip, prop, time, value, ease) {
  if (!clip.__keyframes) clip.__keyframes = {};
  if (!Array.isArray(clip.__keyframes[prop])) clip.__keyframes[prop] = [];
  const kfs = clip.__keyframes[prop];
  const idx = findKeyframeIndex(clip, prop, time);
  if (idx >= 0) {
    kfs[idx].value = value;
    if (ease) kfs[idx].ease = ease;
  } else {
    kfs.push({ time, value, ease: ease || DEFAULT_EASE });
    kfs.sort((a, b) => a.time - b.time);
  }
}

export function removeKeyframe(clip, prop, time, tolerance = 0.05) {
  const kfs = getKeyframes(clip, prop);
  const idx = findKeyframeIndex(clip, prop, time, tolerance);
  if (idx >= 0) { kfs.splice(idx, 1); return true; }
  return false;
}

export function hasKeyframeAt(clip, prop, time) {
  return findKeyframeIndex(clip, prop, time) >= 0;
}

export function hasAnyKeyframeAt(clip, time) {
  const keys = getPropKeys(clip);
  for (let i = 0; i < keys.length; i++) {
    if (hasKeyframeAt(clip, keys[i], time)) return true;
  }
  return false;
}

export function sample(clip, prop, time, baseValue) {
  const kfs = getKeyframes(clip, prop);
  if (!kfs.length) return baseValue;
  if (kfs.length === 1) return kfs[0].value;
  if (time <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time || 1);
      const e = easeFn(t, a.ease);
      return a.value + (b.value - a.value) * e;
    }
  }
  return last.value;
}

export function sampleAll(clip, time, base) {
  const result = Object.assign({}, base || {});
  const keys = getPropKeys(clip);
  for (let i = 0; i < keys.length; i++) {
    const prop = keys[i];
    result[prop] = sample(clip, prop, time, result[prop]);
  }
  return result;
}

export function getPropsWithKeyframeAt(clip, time, tolerance = 0.05) {
  const result = [];
  const keys = getPropKeys(clip);
  for (let i = 0; i < keys.length; i++) {
    if (hasKeyframeAt(clip, keys[i], time)) result.push(keys[i]);
  }
  return result;
}

export function setAllEasesAtTime(clip, time, ease, tolerance = 0.05) {
  const keys = getPropKeys(clip);
  let count = 0;
  for (let i = 0; i < keys.length; i++) {
    const prop = keys[i];
    const idx = findKeyframeIndex(clip, prop, time, tolerance);
    if (idx >= 0) {
      clip.__keyframes[prop][idx].ease = ease;
      count++;
    }
  }
  return count;
}

export function getEaseAtTime(clip, time, tolerance = 0.05) {
  const keys = getPropKeys(clip);
  for (let i = 0; i < keys.length; i++) {
    const prop = keys[i];
    const idx = findKeyframeIndex(clip, prop, time, tolerance);
    if (idx >= 0) return clip.__keyframes[prop][idx].ease || DEFAULT_EASE;
  }
  return DEFAULT_EASE;
}

export function removeAllKeyframesAtTime(clip, time, tolerance = 0.05) {
  const keys = getPropKeys(clip);
  let removed = 0;
  for (let i = 0; i < keys.length; i++) {
    if (removeKeyframe(clip, keys[i], time, tolerance)) removed++;
  }
  return removed;
}

export function clearKeyframes(clip) {
  if (!clip) return;
  delete clip.__keyframes;
}

// ═══════════════════════════════════════════════════════════════
//  EASING FUNCTIONS — full library
// ═══════════════════════════════════════════════════════════════
export function easeFn(t, type) {
  t = Math.max(0, Math.min(1, t));

  switch (type) {
    case 'linear': return t;

    // Sine
    case 'sineIn':    return 1 - Math.cos((t * Math.PI) / 2);
    case 'sineOut':   return Math.sin((t * Math.PI) / 2);
    case 'sineInOut': return -(Math.cos(Math.PI * t) - 1) / 2;

    // Quad
    case 'quadIn':    return t * t;
    case 'quadOut':   return 1 - (1 - t) * (1 - t);
    case 'quadInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Cubic
    case 'cubicIn':    return t * t * t;
    case 'cubicOut':   return 1 - Math.pow(1 - t, 3);
    case 'cubicInOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Quart
    case 'quartIn':    return t * t * t * t;
    case 'quartOut':   return 1 - Math.pow(1 - t, 4);
    case 'quartInOut': return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    // Quint
    case 'quintIn':    return t * t * t * t * t;
    case 'quintOut':   return 1 - Math.pow(1 - t, 5);
    case 'quintInOut': return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

    // Expo
    case 'expoIn':  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 'expoOut': return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'expoInOut':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;

    // Back
    case 'backIn': {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'backOut': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'backInOut': {
      const c1 = 1.70158, c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }

    // Elastic
    case 'elasticIn': {
      if (t === 0) return 0;
      if (t === 1) return 1;
      const c4 = (2 * Math.PI) / 3;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'elasticOut': {
      if (t === 0) return 0;
      if (t === 1) return 1;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    // Bounce
    case 'bounceOut': {
      const n1 = 7.5625, d1 = 2.75;
      let x = t;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }

    // Legacy aliases
    case 'easeIn':         return t * t;
    case 'easeOut':        return 1 - (1 - t) * (1 - t);
    case 'easeInOut':      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':    return t * t * t;
    case 'easeOutCubic':   return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    default: return t;
  }
}