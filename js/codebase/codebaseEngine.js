// ================================================================
//  js/codebase/codebaseEngine.js
//  Prompt → commands → layers
//  🆕 FIX: TEXT/STICKER pehle create hote hain, phir un par
//     keyframes/transform/speed apply hote hain.
// ================================================================

import { createEffectLayer } from '../workspace/effectLayer.js';
import { createAudioFxLayer } from '../workspace/audioEffectLayer.js';
import { placeClipAtTime } from '../layers/layersManager.js';

const ADJUSTMENT_KEYS = [
  'brightness', 'contrast', 'exposure', 'whites', 'blacks',
  'shadows', 'highlights', 'clarity', 'saturation', 'vibrance',
  'temperature', 'tint', 'noise', 'sharpen', 'vignette',
  'reds', 'oranges', 'yellows', 'greens', 'cyans',
  'blues', 'purples', 'magentas', 'skintones'
];

const FILTER_KEYS = ['grayscale', 'sepia', 'invert', 'blur', 'hue', 'opacity'];
const FILTER_RANGES = {
  grayscale: [0, 100], sepia: [0, 100], invert: [0, 100],
  blur: [0, 20], hue: [0, 360], opacity: [0, 100]
};

const EFFECT_PRESETS = [
  'shake', 'bounce', 'pulse', 'zoomPulse', 'glitch', 'wobble',
  'warm', 'cool', 'vintage', 'cinematic', 'bw', 'dreamy',
  'vivid', 'faded', 'dramatic', 'negative', 'softGlow', 'noir'
];

const AUDIO_FX_KEYS = [
  'studio', 'warm', 'bright', 'vocal', 'podcast',
  'deep', 'monster', 'chipmunk', 'baby', 'robot',
  'echo', 'reverb', 'cave', 'stadium', 'telephone',
  'underwater', 'whisper', 'radio'
];

const TRANSFORM_KEYS = [
  'scale', 'rotation', 'x', 'y', 'anchorX', 'anchorY',
  'cropL', 'cropR', 'cropT', 'cropB'
];

const TRANSFORM_RANGES = {
  scale: [10, 500], rotation: [-360, 360],
  x: [0, 100], y: [0, 100],
  anchorX: [0, 100], anchorY: [0, 100],
  cropL: [0, 95], cropR: [0, 95], cropT: [0, 95], cropB: [0, 95]
};

const COLOR_HUES = {
  red: 0, orange: 30, yellow: 60, lime: 90,
  green: 120, teal: 150, cyan: 180, sky: 200,
  blue: 240, indigo: 260, purple: 270, violet: 280,
  magenta: 300, pink: 320, rose: 340
};

const SYNONYMS = {
  bright: 'brightness', roshni: 'brightness',
  sat: 'saturation', temp: 'temperature',
  sharp: 'sharpen', grain: 'noise',
  skin: 'skintones', skintone: 'skintones', skintones: 'skintones',
  'skin tone': 'skintones',
  red: 'reds', orange: 'oranges', yellow: 'yellows',
  green: 'greens', cyan: 'cyans', blue: 'blues',
  purple: 'purples', magenta: 'magentas', pink: 'magentas',
  bw: 'grayscale', 'b&w': 'grayscale', blackandwhite: 'grayscale',
  dhundhla: 'blur', reverse: 'invert',
  lal: 'reds', narangi: 'oranges', peela: 'yellows',
  hara: 'greens', neela: 'blues', jamuni: 'purples', gulabi: 'magentas'
};

// 🆕 Track newly-created clips so later commands can find them
let _lastCreatedClips = [];   // array (text/sticker creates multiple)

// ═══════════════════════════════════════════════════════════════
//  PARSER
// ═══════════════════════════════════════════════════════════════
export function parsePrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { ok: false, error: 'Empty prompt' };
  }
  const state = {
    adjustments: {}, filters: {}, effectPreset: null, speed: null,
    transition: null, texts: [], stickers: [], colorWheel: null,
    chroma: null, transforms: {}, keyframes: [], audioFx: [],
    trimOps: [],
    target: 'selected'
  };
  let prompt = rawPrompt.toLowerCase().trim();
  if (/\ball\s+clips?\b|\bevery\s+clip\b|\bsab\s+clips?\b|\bhar\s+clip\b/.test(prompt)) {
    state.target = 'all';
    prompt = prompt.replace(/\ball\s+clips?\b|\bevery\s+clip\b|\bsab\s+clips?\b|\bhar\s+clip\b/g, '');
  }
  const parts = prompt.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) parseSegment(part, state);
  return { ok: true, state };
}

function parseSegment(seg, state) {
  const kfM = seg.match(/\b(scale|zoom|rotation|rotate|x|y|position|opacity)\s+(-?[\d.]+)(?:\s*,?\s*(-?[\d.]+))?\s+to\s+(-?[\d.]+)(?:\s*,?\s*(-?[\d.]+))?\s+(?:over|in)\s+([\d.]+)\s*s?/i);
  if (kfM) {
    const propRaw = kfM[1].toLowerCase();
    const prop = mapKeyframeProp(propRaw);
    const isPosition = prop === 'position';
    let from, to;
    if (isPosition) {
      from = { x: parseFloat(kfM[2]), y: parseFloat(kfM[3] || kfM[2]) };
      to   = { x: parseFloat(kfM[4]), y: parseFloat(kfM[5] || kfM[4]) };
    } else {
      from = { value: parseFloat(kfM[2]) };
      to   = { value: parseFloat(kfM[4]) };
    }
    const duration = parseFloat(kfM[6]) || 3;
    state.keyframes.push({ prop, from, to, duration, isPosition, source: propRaw });
    return;
  }

  const cwM = seg.match(/\b(shadows?|midtones?|mid|highlights?|highs?)\s+(\w+)(?:\s+(\d+))?(?:\s+(\d+))?/i);
  if (cwM) {
    const toneRaw = cwM[1].toLowerCase();
    const toneKey = toneRaw.startsWith('sh') ? 'shadows'
                  : toneRaw.startsWith('mi') || toneRaw === 'mid' ? 'midtones'
                  : 'highlights';
    const colorName = cwM[2].toLowerCase();
    const hue = COLOR_HUES[colorName];
    if (hue != null) {
      const sat = cwM[3] ? clamp(parseFloat(cwM[3]), 0, 100) : 50;
      const intensity = cwM[4] ? clamp(parseFloat(cwM[4]), 0, 100) : 50;
      if (!state.colorWheel) state.colorWheel = { tones: {}, hdrWhite: 100 };
      state.colorWheel.tones[toneKey] = { h: hue, s: sat, intensity };
      return;
    }
  }

  const hdrM = seg.match(/^hdr\s+(\d+)/i);
  if (hdrM) {
    if (!state.colorWheel) state.colorWheel = { tones: {}, hdrWhite: 100 };
    state.colorWheel.hdrWhite = clamp(parseFloat(hdrM[1]), 0, 200);
    return;
  }

  const chromaM = seg.match(/(?:chroma(?:\s*key)?|green\s*screen|blue\s*screen)\s*(#[0-9a-fA-F]{3,6})?/i);
  if (chromaM) {
    let hex = chromaM[1];
    if (!hex) {
      if (/green/i.test(seg)) hex = '#00ff00';
      else if (/blue/i.test(seg)) hex = '#0000ff';
      else hex = '#00ff00';
    }
    const rgb = hexToRgb(hex);
    if (rgb) {
      const simM = seg.match(/similarity\s+(\d+)/i);
      const smoothM = seg.match(/smooth(?:ness)?\s+(\d+)/i);
      const spillM = seg.match(/spill\s+(\d+)/i);
      const intM = seg.match(/intensity\s+(\d+)/i);
      state.chroma = {
        keyColor: rgb,
        similarity: simM ? clamp(parseFloat(simM[1]), 0, 100) : 30,
        smoothness: smoothM ? clamp(parseFloat(smoothM[1]), 0, 100) : 20,
        spill: spillM ? clamp(parseFloat(spillM[1]), 0, 100) : 50,
        intensity: intM ? clamp(parseFloat(intM[1]), 0, 100) : 100
      };
      return;
    }
  }

  const audioM = seg.match(/\b(?:audio|sound|awaaz|soundfx)\s+([a-z][a-z\s]*)/i);
  if (audioM) {
    const words = audioM[1].trim().split(/\s+/);
    words.forEach(w => {
      if (AUDIO_FX_KEYS.includes(w)) state.audioFx.push(w);
    });
    if (state.audioFx.length > 0) return;
  }
  if (seg.split(/\s+/).length === 1 && AUDIO_FX_KEYS.includes(seg)) {
    state.audioFx.push(seg);
    return;
  }

  let textMatch = seg.match(/text\s+["']([^"']+)["'](.*)/i);
  if (!textMatch) textMatch = seg.match(/["']([^"']+)["'](.*)/);
  if (textMatch && /text|likho|write/i.test(seg)) {
    const content = textMatch[1];
    const rest = (textMatch[2] || '').trim();
    const textObj = { content };
    const sizeM = rest.match(/size\s+(\d+)/i);
    if (sizeM) textObj.fontSize = parseInt(sizeM[1], 10);
    const colorM = rest.match(/color\s+([#\w]+)/i);
    if (colorM) textObj.color = colorM[1];
    if (/\btop\b|upar/i.test(rest))      textObj.positionY = 20;
    if (/\bbottom\b|neeche/i.test(rest)) textObj.positionY = 80;
    if (/\bcenter\b|middle|beech/i.test(rest)) textObj.positionY = 50;
    state.texts.push(textObj);
    return;
  }

  const stickerM = seg.match(/(?:sticker|emoji)\s+(.)/u);
  if (stickerM) { state.stickers.push({ emoji: stickerM[1] }); return; }

  let speedM = seg.match(/(?:speed|tez)\s+([\d.]+)\s*x?/i);
  if (!speedM) speedM = seg.match(/^([\d.]+)\s*x\b/i);
  if (speedM) {
    const v = parseFloat(speedM[1]);
    if (Number.isFinite(v) && v >= 0.1 && v <= 16) { state.speed = v; return; }
  }

  const transM = seg.match(/(fade\s*black|fade\s*white|fade|dissolve|slide\s*left|slide\s*right|slide\s*up|slide\s*down|zoom\s*in|zoom\s*out|wipe\s*left|wipe\s*right|circle\s*in)\s*(?:in|out|transition)?\s*([\d.]+)?/i);
  if (transM) {
    const raw = transM[1].toLowerCase().replace(/\s+/g, '');
    const typeMap = {
      fade: 'fade', fadeblack: 'fadeBlack', fadewhite: 'fadeWhite',
      dissolve: 'dissolve', slideleft: 'slideLeft', slideright: 'slideRight',
      slideup: 'slideUp', slidedown: 'slideDown', zoomin: 'zoomIn',
      zoomout: 'zoomOut', wipeleft: 'wipeLeft', wiperight: 'wipeRight',
      circlein: 'circleIn'
    };
    const type = typeMap[raw] || 'fade';
    const duration = transM[2] ? parseFloat(transM[2]) : 0.5;
    state.transition = { type, duration: clamp(duration, 0.1, 3) };
    return;
  }

  if (/^(trim\s*left|left\s*trim)$/i.test(seg)) { state.trimOps.push('left'); return; }
  if (/^(trim\s*right|right\s*trim)$/i.test(seg)) { state.trimOps.push('right'); return; }
  if (/^(split|cut|split\s*clip)$/i.test(seg)) { state.trimOps.push('split'); return; }

  const transTfM = seg.match(/^position\s+(\d+)\s+(\d+)$/i);
  if (transTfM) {
    state.transforms.x = clamp(parseFloat(transTfM[1]), 0, 100);
    state.transforms.y = clamp(parseFloat(transTfM[2]), 0, 100);
    return;
  }

  const tfM = seg.match(/^([a-z]+)\s+(-?[\d.]+)\s*%?$/i);
  if (tfM) {
    const key = tfM[1].toLowerCase();
    const val = parseFloat(tfM[2]);
    if (TRANSFORM_KEYS.includes(key) && Number.isFinite(val)) {
      const r = TRANSFORM_RANGES[key] || [-Infinity, Infinity];
      state.transforms[key] = clamp(val, r[0], r[1]);
      return;
    }
  }

  const words = seg.split(/\s+/).filter(Boolean);
  if (words.length === 1 && EFFECT_PRESETS.includes(words[0])) {
    state.effectPreset = words[0];
    return;
  }

  const kvM = seg.match(/^([a-z][a-z\s]*?)\s+(-?\d+(?:\.\d+)?)\s*%?$/);
  if (kvM) {
    let key = kvM[1].trim().replace(/\s+/g, '');
    const value = parseFloat(kvM[2]);
    key = SYNONYMS[key] || key;
    if (ADJUSTMENT_KEYS.includes(key)) {
      state.adjustments[key] = clamp(value, -100, 100);
      return;
    }
    if (FILTER_KEYS.includes(key)) {
      const r = FILTER_RANGES[key] || [0, 100];
      state.filters[key] = clamp(value, r[0], r[1]);
      return;
    }
  }

  if (words.length === 1) {
    const w = words[0];
    const key = SYNONYMS[w] || w;
    if (FILTER_KEYS.includes(key)) {
      const r = FILTER_RANGES[key] || [0, 100];
      state.filters[key] = r[1];
      return;
    }
    if (EFFECT_PRESETS.includes(w)) { state.effectPreset = w; return; }
  }
}

function mapKeyframeProp(raw) {
  if (raw === 'zoom') return 'scale';
  if (raw === 'rotate') return 'rotation';
  if (raw === 'position') return 'position';
  return raw;
}
function clamp(v, min, max) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}
function hexToRgb(hex) {
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
}

// ═══════════════════════════════════════════════════════════════
//  EXECUTOR  🆕 TEXT/STICKER pehle
// ═══════════════════════════════════════════════════════════════
export function executePrompt(state) {
  if (!state) return { ok: false, error: 'No state' };
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  _lastCreatedClips = [];

  const hasClips = hasAnyClips(appState);
  const results = [];
  const warnings = [];

  // ═══════════════════════════════════════════════════════════
  //  1) 🆕 TEXT — PEHLE (so keyframes can attach to new clip)
  // ═══════════════════════════════════════════════════════════
  if (state.texts.length > 0) {
    if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];
    const eng = window.__playbackEngine;
    const atTime = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

    state.texts.forEach((t, i) => {
      const id = 'tx-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 6);
      const clipData = {
        name: t.content, url: 'text://' + id, type: 'text/plain', __textId: id,
        textState: {
          content: t.content, fontFamily: 'Arial', fontSize: t.fontSize || 36,
          fontWeight: 'normal', fontStyle: 'normal', color: t.color || '#ffffff',
          strokeWidth: 0, strokeColor: '#000000', gradientEnabled: false,
          shadowEnabled: false, alignment: 'center',
          positionX: 50, positionY: t.positionY != null ? t.positionY : 50,
          scale: 100, rotation: 0, opacity: 100,
          animation: 'none', animationDuration: 0.6
        },
        startTime: atTime, duration: 3
      };
      placeClipAtTime(appState.timeline.visual, clipData, atTime);

      // Track created clip
      const created = findClipByUrl(appState.timeline.visual, clipData.url);
      if (created) _lastCreatedClips.push(created);

      results.push('text:"' + t.content + '"');
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  2) 🆕 STICKER
  // ═══════════════════════════════════════════════════════════
  if (state.stickers.length > 0) {
    if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];
    const eng = window.__playbackEngine;
    const atTime = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

    state.stickers.forEach((s, i) => {
      const id = 'sk-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 6);
      const clipData = {
        name: s.emoji, url: 'sticker://' + id, type: 'sticker/plain', __stickerId: id,
        stickerState: { emoji: s.emoji, x: 50, y: 50, scale: 100, rotation: 0 },
        startTime: atTime, duration: 3
      };
      placeClipAtTime(appState.timeline.visual, clipData, atTime);

      const created = findClipByUrl(appState.timeline.visual, clipData.url);
      if (created) _lastCreatedClips.push(created);

      results.push('sticker:' + s.emoji);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  3) AUDIO FX
  // ═══════════════════════════════════════════════════════════
  if (state.audioFx.length > 0) {
    state.audioFx.forEach(key => {
      try {
        const id = createAudioFxLayer(key, key);
        if (id) results.push('audio:' + key);
      } catch (e) { console.warn(e); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  4) 🆕 Now resolve "target clip" for transform/trim/kf/speed
  //     Priority: selected clip → last created clip
  // ═══════════════════════════════════════════════════════════
  let targetClip = getSelectedClip(appState);
  if (!targetClip && _lastCreatedClips.length > 0) {
    targetClip = _lastCreatedClips[_lastCreatedClips.length - 1];
  }

  // TRANSFORM
  const tfKeys = Object.keys(state.transforms);
  if (tfKeys.length > 0) {
    if (targetClip) {
      if (!targetClip.__transform) targetClip.__transform = {};
      Object.assign(targetClip.__transform, state.transforms);
      if (targetClip.__textId && targetClip.textState) {
        if (state.transforms.x != null) targetClip.textState.positionX = state.transforms.x;
        if (state.transforms.y != null) targetClip.textState.positionY = state.transforms.y;
        if (state.transforms.scale != null) targetClip.textState.scale = state.transforms.scale;
        if (state.transforms.rotation != null) targetClip.textState.rotation = state.transforms.rotation;
      }
      if (targetClip.__stickerId && targetClip.stickerState) {
        if (state.transforms.x != null) targetClip.stickerState.x = state.transforms.x;
        if (state.transforms.y != null) targetClip.stickerState.y = state.transforms.y;
        if (state.transforms.scale != null) targetClip.stickerState.scale = state.transforms.scale;
        if (state.transforms.rotation != null) targetClip.stickerState.rotation = state.transforms.rotation;
      }
      results.push('transform');
    } else {
      warnings.push('transform: clip select karein');
    }
  }

  // TRIM
  if (state.trimOps.length > 0) {
    if (!targetClip) {
      warnings.push('trim: clip select karein');
    } else {
      const eng = window.__playbackEngine;
      const playhead = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
      for (const op of state.trimOps) {
        const curStart = Number.isFinite(targetClip.startTime) ? targetClip.startTime : 0;
        const curDur   = Number.isFinite(targetClip.duration)  ? targetClip.duration  : 3;
        const curEnd   = curStart + curDur;
        const inside = playhead > curStart + 0.01 && playhead < curEnd - 0.01;
        if (!inside) {
          warnings.push(op + ': playhead clip ke andar rakho');
          continue;
        }
        if (op === 'left') {
          const cutAmount = playhead - curStart;
          targetClip.startTime = playhead;
          targetClip.duration  = curEnd - playhead;
          targetClip.sourceIn  = (Number.isFinite(targetClip.sourceIn) ? targetClip.sourceIn : 0) + cutAmount;
          targetClip.__trimmed = true;
          syncLinkedTrim(appState, targetClip, targetClip.startTime, targetClip.duration, targetClip.sourceIn);
          results.push('trimLeft:' + cutAmount.toFixed(2) + 's');
        } else if (op === 'right') {
          const cutAmount = curEnd - playhead;
          targetClip.startTime = curStart;
          targetClip.duration  = playhead - curStart;
          targetClip.__trimmed = true;
          syncLinkedTrim(appState, targetClip, targetClip.startTime, targetClip.duration, targetClip.sourceIn);
          results.push('trimRight:' + cutAmount.toFixed(2) + 's');
        } else if (op === 'split') {
          const firstDur  = playhead - curStart;
          const secondDur = curEnd - playhead;
          const srcIn     = Number.isFinite(targetClip.sourceIn) ? targetClip.sourceIn : 0;
          targetClip.startTime = curStart;
          targetClip.duration  = firstDur;
          targetClip.sourceIn  = srcIn;
          targetClip.__trimmed = true;
          const secondClip = Object.assign({}, targetClip);
          secondClip.startTime = playhead;
          secondClip.duration  = secondDur;
          secondClip.sourceIn  = srcIn + firstDur;
          secondClip.name = (targetClip.name || 'Clip') + ' (2)';
          secondClip.__trimmed = true;
          delete secondClip.__linkedId;
          if (targetClip.__keyframes) {
            secondClip.__keyframes = JSON.parse(JSON.stringify(targetClip.__keyframes));
            for (const prop of Object.keys(secondClip.__keyframes)) {
              secondClip.__keyframes[prop] = (secondClip.__keyframes[prop] || []).filter(k => k.time >= playhead);
            }
            for (const prop of Object.keys(targetClip.__keyframes)) {
              targetClip.__keyframes[prop] = (targetClip.__keyframes[prop] || []).filter(k => k.time < playhead);
            }
          }
          let inserted = false;
          const tracks = appState.timeline.visual || [];
          for (let t = 0; t < tracks.length; t++) {
            const track = tracks[t];
            if (!Array.isArray(track)) continue;
            const idx = track.indexOf(targetClip);
            if (idx >= 0) { track.splice(idx + 1, 0, secondClip); inserted = true; break; }
          }
          if (!inserted) {
            const aTracks = appState.timeline.audio || [];
            for (let t = 0; t < aTracks.length; t++) {
              const track = aTracks[t];
              if (!Array.isArray(track)) continue;
              const idx = track.indexOf(targetClip);
              if (idx >= 0) { track.splice(idx + 1, 0, secondClip); break; }
            }
          }
          results.push('split@' + playhead.toFixed(2) + 's');
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  KEYFRAMES  🆕 ab naye text clip par bhi apply honge
  // ═══════════════════════════════════════════════════════════
  if (state.keyframes.length > 0) {
    if (!targetClip) {
      warnings.push('keyframes: clip select karein');
    } else {
      const eng = window.__playbackEngine;
      const now = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
      const base = Number.isFinite(targetClip.startTime) ? targetClip.startTime : 0;
      let currentTime = Math.max(base, now);

      if (!targetClip.__keyframes) targetClip.__keyframes = {};

      for (const kf of state.keyframes) {
        if (kf.isPosition) {
          if (!targetClip.__keyframes.x) targetClip.__keyframes.x = [];
          if (!targetClip.__keyframes.y) targetClip.__keyframes.y = [];
          targetClip.__keyframes.x.push({ time: currentTime, value: kf.from.x, ease: 'easeInOut' });
          targetClip.__keyframes.x.push({ time: currentTime + kf.duration, value: kf.to.x, ease: 'easeInOut' });
          targetClip.__keyframes.y.push({ time: currentTime, value: kf.from.y, ease: 'easeInOut' });
          targetClip.__keyframes.y.push({ time: currentTime + kf.duration, value: kf.to.y, ease: 'easeInOut' });
        } else {
          const prop = kf.prop;
          if (!targetClip.__keyframes[prop]) targetClip.__keyframes[prop] = [];
          targetClip.__keyframes[prop].push({ time: currentTime, value: kf.from.value, ease: 'easeInOut' });
          targetClip.__keyframes[prop].push({ time: currentTime + kf.duration, value: kf.to.value, ease: 'easeInOut' });
        }
        currentTime += kf.duration;
      }

      // Sort + dedupe
      for (const prop of Object.keys(targetClip.__keyframes)) {
        const arr = targetClip.__keyframes[prop];
        if (!Array.isArray(arr)) continue;
        arr.sort((a, b) => a.time - b.time);
        const deduped = [];
        for (let i = 0; i < arr.length; i++) {
          if (i > 0 && Math.abs(arr[i].time - arr[i - 1].time) < 0.001) {
            deduped[deduped.length - 1] = arr[i];
          } else {
            deduped.push(arr[i]);
          }
        }
        targetClip.__keyframes[prop] = deduped;
      }

      results.push('keyframes:' + state.keyframes.length);
    }
  }

  // SPEED
  if (state.speed != null) {
    if (targetClip) {
      applySpeedToClip(targetClip, state.speed);
      syncLinkedSpeed(appState, targetClip, state.speed);
      results.push('speed:' + state.speed + 'x');
    } else {
      warnings.push('speed: clip select karein');
    }
  }

  // TRANSITION
  if (state.transition) {
    if (targetClip) {
      targetClip.__transitionIn = {
        key: state.transition.type,
        duration: state.transition.duration
      };
      results.push('transition:' + state.transition.type);
    } else {
      warnings.push('transition: clip select karein');
    }
  }

  // ADJUSTMENTS (needs clip)
  const adjKeys = Object.keys(state.adjustments);
  if (adjKeys.length > 0) {
    if (!hasClips && _lastCreatedClips.length === 0) {
      warnings.push('adjustments: clip daalein');
    } else {
      try {
        const id = createEffectLayer('adjustment', { adjustments: state.adjustments }, 'Adjustments');
        if (id) results.push('adjustments');
      } catch (e) { console.warn(e); }
    }
  }

  // FILTER
  const filterKeys = Object.keys(state.filters);
  if (filterKeys.length > 0) {
    if (!hasClips && _lastCreatedClips.length === 0) {
      warnings.push('filter: clip daalein');
    } else {
      const filters = {
        brightness: 100, contrast: 100, saturation: 100, hue: 0,
        grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
      };
      Object.assign(filters, state.filters);
      try {
        const id = createEffectLayer('filter', { filters }, 'Filter');
        if (id) results.push('filter');
      } catch (e) { console.warn(e); }
    }
  }

  // EFFECT PRESET
  if (state.effectPreset) {
    if (!hasClips && _lastCreatedClips.length === 0) {
      warnings.push('effect: clip daalein');
    } else {
      const baseFilters = {
        brightness: 100, contrast: 100, saturation: 100, hue: 0,
        grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
      };
      try {
        const id = createEffectLayer('effect',
          { presetKey: state.effectPreset, filters: baseFilters, motion: null },
          capitalize(state.effectPreset));
        if (id) results.push('effect:' + state.effectPreset);
      } catch (e) { console.warn(e); }
    }
  }

  // COLOR WHEEL
  if (state.colorWheel) {
    if (!hasClips && _lastCreatedClips.length === 0) {
      warnings.push('colorWheel: clip daalein');
    } else {
      try {
        const id = createEffectLayer('colorWheel', { colorWheel: state.colorWheel }, 'Color Wheel');
        if (id) results.push('colorWheel');
      } catch (e) { console.warn(e); }
    }
  }

  // CHROMA
  if (state.chroma) {
    if (!hasClips && _lastCreatedClips.length === 0) {
      warnings.push('chroma: clip daalein');
    } else {
      try {
        const id = createEffectLayer('chroma', { chroma: state.chroma }, 'Chroma Key');
        if (id) results.push('chroma');
      } catch (e) { console.warn(e); }
    }
  }

  // Fire events
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));

  if (results.length === 0) {
    const errMsg = warnings.length ? warnings.join(' • ') : 'Koi command execute nahi hui';
    return { ok: false, error: errMsg };
  }
  if (warnings.length > 0) results.push('⚠️ ' + warnings.join(', '));
  return { ok: true, results };
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function hasAnyClips(appState) {
  const v = appState.timeline.visual || [];
  const a = appState.timeline.audio || [];
  for (const t of v) if (Array.isArray(t) && t.length) return true;
  for (const t of a) if (Array.isArray(t) && t.length) return true;
  return false;
}

function findClipByUrl(list, url) {
  if (!Array.isArray(list)) return null;
  for (let t = 0; t < list.length; t++) {
    const track = list[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      if (track[c] && track[c].url === url) return track[c];
    }
  }
  return null;
}

function getSelectedClip(appState) {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label) return null;
  const group = label[0] === 'A' ? 'audio' : 'visual';
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const track = appState.timeline[group]?.[trackIdx];
  if (!Array.isArray(track)) return null;
  return track[clipIdx] || null;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function applySpeedToClip(clip, speed) {
  if (!clip) return;
  if (!Number.isFinite(clip.__speedBase) || clip.__speedBase <= 0) {
    clip.__speedBase = Number.isFinite(clip.duration) ? clip.duration : 3;
  }
  clip.__speed = speed;
  clip.duration = clip.__speedBase / speed;
  clip.__trimmed = true;
}

function syncLinkedSpeed(appState, primaryClip, speed) {
  if (!primaryClip || !primaryClip.__linkedId) return;
  const linkedId = primaryClip.__linkedId;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const other = track[c];
      if (other === primaryClip) continue;
      if (!other || other.__linkedId !== linkedId) continue;
      applySpeedToClip(other, speed);
      other.startTime = primaryClip.startTime;
    }
  }
}

function syncLinkedTrim(appState, clip, startTime, duration, sourceIn) {
  if (!clip || !clip.__linkedId) return;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const other = track[c];
      if (other === clip) continue;
      if (!other || other.__linkedId !== clip.__linkedId) continue;
      if (Number.isFinite(startTime)) other.startTime = startTime;
      if (Number.isFinite(duration))  other.duration  = duration;
      if (Number.isFinite(sourceIn))  other.sourceIn  = sourceIn;
      other.__trimmed = true;
    }
  }
}