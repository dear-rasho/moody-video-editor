// ================================================================
//  js/codebase/codebaseEngine.js
//  Prompt → commands → layers
//  🆕 Timestamped multi-layer + segments + ratio + unknown tracking
// ================================================================

import { createEffectLayer } from '../workspace/effectLayer.js';
import { createAudioFxLayer } from '../workspace/audioEffectLayer.js';
import { placeClipAtTime } from '../layers/layersManager.js';
import { resolveFontFamily, loadGoogleFont } from './fontLibrary.js';

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

let _lastCreatedClips = [];
let _unknownParts = [];

function _resetUnknown() { _unknownParts = []; }
function _addUnknown(part, context) {
  if (!part) return;
  const trimmed = String(part).trim();
  if (!trimmed) return;
  const entry = context ? (context + ': "' + trimmed + '"') : '"' + trimmed + '"';
  if (_unknownParts.indexOf(entry) < 0) _unknownParts.push(entry);
}

// ═══════════════════════════════════════════════════════════════
//  🆕 SPLIT PROPERTY STRING
//  "font Anton size 180 color black" → 3 parts
// ═══════════════════════════════════════════════════════════════
const PROP_KEYWORDS_RE = /\b(font|size|color|colour|position|animation|shadow|align|alignment|scale|rotation|opacity|stroke)\b/g;

function splitPropString(str) {
  if (!str) return [];
  const commaParts = str.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const result = [];

  for (let ci = 0; ci < commaParts.length; ci++) {
    const part = commaParts[ci];
    PROP_KEYWORDS_RE.lastIndex = 0;
    const indices = [];
    let m;
    while ((m = PROP_KEYWORDS_RE.exec(part)) !== null) {
      indices.push(m.index);
    }
    if (indices.length === 0) {
      result.push(part);
      continue;
    }
    if (indices[0] > 0) indices.unshift(0);
    for (let i = 0; i < indices.length; i++) {
      const s = indices[i];
      const e = (i + 1 < indices.length) ? indices[i + 1] : part.length;
      const chunk = part.slice(s, e).trim();
      if (chunk) result.push(chunk);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  RATIO
// ═══════════════════════════════════════════════════════════════
function detectRatio(prompt) {
  const m = prompt.match(/^\s*ratio\s+(\d+\s*:\s*\d+)/im);
  if (!m) return null;
  return m[1].replace(/\s+/g, '');
}

function applyRatio(ratioStr) {
  if (!ratioStr) return false;
  const sel = document.querySelector('#ratio-select');
  if (!sel) return false;
  const opts = Array.from(sel.options);
  const opt = opts.find(o => o.value === ratioStr);
  if (!opt) return false;
  sel.value = ratioStr;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  TIMESTAMPED LAYERS
// ═══════════════════════════════════════════════════════════════
function hasTimestampedLayers(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') return false;
  return /\[\s*\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]/.test(rawPrompt);
}

function parseTimeStr(str) {
  const parts = String(str).split(':').map(function (n) { return parseInt(n, 10) || 0; });
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function fmtSec(s) {
  if (!Number.isFinite(s)) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  if (m > 0) return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
  return sec.toFixed(1) + 's';
}

function parseTimestampedLayers(rawPrompt) {
  _resetUnknown();
  const blockRegex = /\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]/g;

  const blocks = [];
  let lastIndex = 0;
  let lastTime = null;
  let match;

  while ((match = blockRegex.exec(rawPrompt)) !== null) {
    if (lastTime !== null) {
      const content = rawPrompt.slice(lastIndex, match.index).trim();
      blocks.push({ start: lastTime.start, end: lastTime.end, content });
    }
    lastTime = {
      start: parseTimeStr(match[1]),
      end: parseTimeStr(match[2])
    };
    lastIndex = blockRegex.lastIndex;
  }

  if (lastTime !== null) {
    const content = rawPrompt.slice(lastIndex).trim();
    blocks.push({ start: lastTime.start, end: lastTime.end, content });
  }

  const layers = [];
  const trailingCommands = [];

  for (let i = 0; i < blocks.length; i++) {
    const parsed = parseTimestampBlock(blocks[i]);
    if (!parsed) continue;
    if (parsed.type === 'trailing') {
      if (parsed.commands) trailingCommands.push.apply(trailingCommands, parsed.commands);
    } else {
      layers.push(parsed);
    }
  }

  return { layers, trailingCommands };
}

function detectBlockType(content) {
  const c = (content || '').trim();
  if (!c) return null;

  if (/^(?:sticker|emoji)\s+/i.test(c)) return 'sticker';
  if (/^(?:audio|sound|awaaz)\s+/i.test(c)) return 'audiofx';
  if (/^["']/.test(c)) return 'text';
  if (/^text\s+["']/i.test(c)) return 'text';
  if (/\[seg/i.test(c)) return 'text';
  if (/\b(shadows?|midtones?|highlights?|hdr)\b\s+\w+/i.test(c)) return 'colorwheel';
  if (/\b(chroma|green\s*screen|blue\s*screen)\b/i.test(c)) return 'chroma';

  const onlyWord = c.toLowerCase().trim();
  if (EFFECT_PRESETS.indexOf(onlyWord) >= 0) return 'effect';

  const parts = c.split(/[,\n]+/).map(function (s) { return s.trim(); });
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = part.toLowerCase().match(/^([a-z][a-z\s]*?)\s+(-?\d+(?:\.\d+)?)/);
    if (m) {
      const key = m[1].replace(/\s+/g, '');
      const mapped = SYNONYMS[key] || key;
      if (ADJUSTMENT_KEYS.indexOf(mapped) >= 0) return 'adjustment';
      if (FILTER_KEYS.indexOf(mapped) >= 0) return 'filter';
    }
    if (FILTER_KEYS.indexOf(part.toLowerCase()) >= 0) return 'filter';
  }

  return 'trailing';
}

function parseTimestampBlock(block) {
  const content = (block.content || '').trim();
  if (!content) return null;

  const type = detectBlockType(content);
  if (!type) {
    _addUnknown(content, '[' + fmtSec(block.start) + ' - ' + fmtSec(block.end) + ']');
    return null;
  }

  if (type === 'trailing') {
    return { type: 'trailing', commands: [content], start: block.start, end: block.end };
  }

  if (type === 'text') return parseTextBlock(block, content);
  if (type === 'sticker') return parseStickerBlock(block, content);
  if (type === 'audiofx') return parseAudioFxBlock(block, content);
  if (type === 'adjustment' || type === 'filter' || type === 'effect' ||
      type === 'colorwheel' || type === 'chroma') {
    return { type: type, start: block.start, end: block.end, raw: content };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  TEXT BLOCK PARSER (with segments)
// ═══════════════════════════════════════════════════════════════
function parseTextBlock(block, content) {
  const segRegex = /\[\s*(?:seg|segment|word)\s+["']([^"']+)["']\s*([^\]]*)\]/gi;
  const segments = [];
  let m;
  let textWithoutSegs = content;

  while ((m = segRegex.exec(content)) !== null) {
    const segText = m[1];
    const segPropsStr = m[2] || '';
    const parsedSeg = parseLayerProps(segPropsStr);
    const segProps = parsedSeg.props || parsedSeg;
    const segUnknown = parsedSeg.unknown || [];
    for (let k = 0; k < segUnknown.length; k++) {
      _addUnknown(segUnknown[k], 'seg "' + segText + '"');
    }
    segments.push({
      text: segText,
      props: segProps
    });
  }
  textWithoutSegs = content.replace(segRegex, '').replace(/\s+/g, ' ').trim();

  let mainText = '';
  let propsStr = '';

  const qm = textWithoutSegs.match(/^text\s+["']([^"']+)["']\s*(.*)$/i);
  if (qm) {
    mainText = qm[1];
    propsStr = qm[2] || '';
  } else {
    const qm2 = textWithoutSegs.match(/^["']([^"']+)["']\s*(.*)$/);
    if (qm2) {
      mainText = qm2[1];
      propsStr = qm2[2] || '';
    } else {
      propsStr = textWithoutSegs;
    }
  }

  if (segments.length > 0 && !mainText) mainText = '';

  const parsedProps = parseLayerProps(propsStr);
  const props = parsedProps.props || parsedProps;
  const unknownProps = parsedProps.unknown || [];
  for (let k = 0; k < unknownProps.length; k++) {
    _addUnknown(unknownProps[k], 'text @ ' + fmtSec(block.start) + 's');
  }

  return {
    type: 'text',
    start: block.start,
    end: block.end,
    text: mainText.replace(/\|\s*/g, '\n').replace(/\\n/g, '\n'),
    props: props,
    segments: segments
  };
}

// ═══════════════════════════════════════════════════════════════
//  STICKER / AUDIO FX BLOCKS
// ═══════════════════════════════════════════════════════════════
function parseStickerBlock(block, content) {
  const emojiM = content.match(/^(?:sticker|emoji)\s+(.)/u);
  if (!emojiM) return null;
  const emoji = emojiM[1];
  const rest = content.slice(emojiM[0].length);
  const props = {};
  const atM = rest.match(/\bat\s+(\d+)\s+(\d+)/i);
  if (atM) { props.x = parseFloat(atM[1]); props.y = parseFloat(atM[2]); }
  const sizeM = rest.match(/\bsize\s+(\d+)/i);
  if (sizeM) props.scale = parseInt(sizeM[1], 10);
  return {
    type: 'sticker',
    start: block.start,
    end: block.end,
    emoji: emoji,
    props: props
  };
}

function parseAudioFxBlock(block, content) {
  const m = content.match(/^(?:audio|sound|awaaz)\s+([a-z][a-z\s]*)/i);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).filter(Boolean);
  const keys = words.filter(function (w) { return AUDIO_FX_KEYS.indexOf(w) >= 0; });
  if (!keys.length) return null;
  return { type: 'audiofx', start: block.start, end: block.end, keys: keys };
}

// ═══════════════════════════════════════════════════════════════
//  LAYER PROPERTIES PARSER
// ═══════════════════════════════════════════════════════════════
function parseLayerProps(str) {
  const unknown = [];
  const props = {
    animation: 'none',
    animationDuration: 0.6,
    positionX: 50,
    positionY: 50,
    color: '#ffffff',
    gradientEnabled: false,
    gradientColor1: '#ff0066',
    gradientColor2: '#0066ff',
    gradientAngle: 90,
    shadowEnabled: false,
    fontFamily: 'Arial',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    strokeWidth: 0,
    strokeColor: '#000000',
    alignment: 'center',
    scale: 100,
    rotation: 0,
    opacity: 100,
    newline: false
  };

  if (!str) return { props: props, unknown: unknown };

  const parts = splitPropString(str);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let m;

    // animation
    m = part.match(/^animation\s+([A-Za-z][A-Za-z0-9]*)/i);
    if (m) {
      const raw = m[1].toLowerCase();
      const ALIAS = {
        bounce: 'bounceIn', fade: 'fadeIn', fadein: 'fadeIn',
        fadeup: 'fadeUp', fadedown: 'fadeDown',
        pop: 'popIn', popin: 'popIn',
        slide: 'slideUp', slideup: 'slideUp', slidedown: 'slideDown',
        slideleft: 'slideLeft', slideright: 'slideRight',
        zoom: 'zoomIn', zoomin: 'zoomIn', zoomout: 'zoomOut',
        flip: 'flip3DX', flipx: 'flip3DX', flipy: 'flip3DY',
        rotate: 'rotate3D', rotate3d: 'rotate3D',
        type: 'typewriter', typewriter: 'typewriter',
        decode: 'decoder', decoder: 'decoder', scramble: 'decoder',
        wobbly: 'wave', wave: 'wave', bouncewave: 'bounceWave',
        cinematic: 'cinematicBlur', blur: 'cinematicBlur',
        flicker: 'flicker', glow: 'flicker',
        scribble: 'scribble', hand: 'scribble', handdrawn: 'scribble',
        glitch: 'glitch', shake: 'shake', pulse: 'pulse'
      };
      props.animation = ALIAS[raw] || m[1];
      continue;
    }

    // position
    m = part.match(/^position\s+(top|bottom|center|middle|left|right)\b/i);
    if (m) {
      const p = m[1].toLowerCase();
      if (p === 'top') props.positionY = 20;
      else if (p === 'bottom') props.positionY = 80;
      else if (p === 'center' || p === 'middle') { props.positionX = 50; props.positionY = 50; }
      else if (p === 'left') props.positionX = 20;
      else if (p === 'right') props.positionX = 80;
      continue;
    }
    m = part.match(/^position\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (m) {
      props.positionX = parseFloat(m[1]);
      props.positionY = parseFloat(m[2]);
      continue;
    }

    // gradient
    m = part.match(/^(?:colou?r\s+ramp|gradient|ramp)\s+(#[0-9a-fA-F]{3,8})\s+(?:to|→|->)\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) {
      props.gradientEnabled = true;
      props.gradientColor1 = m[1];
      props.gradientColor2 = m[2];
      continue;
    }
    m = part.match(/^(?:colou?r\s+ramp|gradient|ramp)\s+(#[0-9a-fA-F]{3,8})\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) {
      props.gradientEnabled = true;
      props.gradientColor1 = m[1];
      props.gradientColor2 = m[2];
      continue;
    }

    // color
    m = part.match(/^colou?r\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) { props.color = m[1]; continue; }
    m = part.match(/^colou?r\s+([a-zA-Z]+)/i);
    if (m) { props.color = colorNameToHex(m[1]); continue; }

    // shadow
    if (/^shadow\b/i.test(part)) { props.shadowEnabled = true; continue; }

    // newline
    if (/^newline$/i.test(part) || /^linebreak$/i.test(part)) {
      props.newline = true;
      continue;
    }

    // bold / italic
    if (/^font\s+bold$/i.test(part)) { props.fontWeight = 'bold'; continue; }
    if (/^font\s+italic$/i.test(part)) { props.fontStyle = 'italic'; continue; }
    if (/^bold$/i.test(part)) { props.fontWeight = 'bold'; continue; }
    if (/^italic$/i.test(part)) { props.fontStyle = 'italic'; continue; }

    // font X
    m = part.match(/^font\s+(.+)$/i);
    if (m) {
      const requested = m[1].trim();
      const resolved = resolveFontFamily(requested);
      props.fontFamily = resolved;
      loadGoogleFont(resolved);
      continue;
    }

    // font size N
    m = part.match(/^font\s*[-]?size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    // size N
    m = part.match(/^size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    // align
    m = part.match(/^align(?:ment)?\s+(left|center|right)/i);
    if (m) { props.alignment = m[1].toLowerCase(); continue; }

    // scale
    m = part.match(/^scale\s+(-?\d+)/i);
    if (m) { props.scale = parseInt(m[1], 10); continue; }

    // rotation
    m = part.match(/^rot(?:ation)?\s+(-?\d+)/i);
    if (m) { props.rotation = parseInt(m[1], 10); continue; }

    // opacity
    m = part.match(/^opacity\s+(\d+)/i);
    if (m) { props.opacity = parseInt(m[1], 10); continue; }

    // stroke
    m = part.match(/^stroke\s*[- ]?(?:width\s+)?(\d+)(?:\s+(#[0-9a-fA-F]{3,8}))?/i);
    if (m) {
      props.strokeWidth = parseInt(m[1], 10);
      if (m[2]) props.strokeColor = m[2];
      continue;
    }

    unknown.push(part);
  }

  return { props: props, unknown: unknown };
}

function colorNameToHex(name) {
  const map = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#00ff00',
    blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
    pink: '#ff88aa', orange: '#ff8800', purple: '#8800ff', gray: '#888888',
    grey: '#888888', lime: '#00ff00', gold: '#ffcc00', silver: '#cccccc',
    brown: '#8b4513', navy: '#000080', teal: '#008080', olive: '#808000',
    maroon: '#800000', aqua: '#00ffff', whitish: '#f5f5f5'
  };
  const k = String(name || '').toLowerCase();
  return map[k] || '#ffffff';
}

// ═══════════════════════════════════════════════════════════════
//  BUILD TEXT CLIP
// ═══════════════════════════════════════════════════════════════
function buildTextClip(L, duration) {
  const id = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const p = L.props || {};

  let segments = null;
  if (L.segments && L.segments.length > 0) {
    segments = L.segments.map(function (s) {
      const sp = s.props || {};
      return {
        text: s.text,
        fontFamily: sp.fontFamily || p.fontFamily || 'Arial',
        fontSize: sp.fontSize || p.fontSize || 36,
        fontWeight: sp.fontWeight || p.fontWeight || 'normal',
        fontStyle: sp.fontStyle || p.fontStyle || 'normal',
        color: sp.color || p.color || '#ffffff',
        gradientEnabled: !!sp.gradientEnabled,
        gradientColor1: sp.gradientColor1 || '#ff0066',
        gradientColor2: sp.gradientColor2 || '#0066ff',
        gradientAngle: sp.gradientAngle || 90,
        shadowEnabled: !!sp.shadowEnabled,
        strokeWidth: sp.strokeWidth || 0,
        strokeColor: sp.strokeColor || '#000000',
        animation: sp.animation || 'none',
        rotation: sp.rotation || 0,
        scale: sp.scale != null ? sp.scale : 100,
        opacity: sp.opacity != null ? sp.opacity : 100,
        align: sp.alignment || 'center',
        newline: !!sp.newline
      };
    });
  }

  const mainText = L.text || '';
  if (!mainText && !segments) return null;

  return {
    name: (mainText || (segments ? segments.map(function (s) { return s.text; }).join(' ') : '')).slice(0, 30),
    url: 'text://' + id,
    type: 'text/plain',
    __textId: id,
    textState: {
      content: mainText,
      __segments: segments,
      fontFamily: p.fontFamily || 'Arial',
      fontSize: p.fontSize || 36,
      fontWeight: p.fontWeight || 'normal',
      fontStyle: p.fontStyle || 'normal',
      color: p.color || '#ffffff',
      strokeWidth: p.strokeWidth || 0,
      strokeColor: p.strokeColor || '#000000',
      gradientEnabled: !!p.gradientEnabled,
      gradientColor1: p.gradientColor1 || '#ff0066',
      gradientColor2: p.gradientColor2 || '#0066ff',
      gradientAngle: p.gradientAngle || 90,
      shadowEnabled: !!p.shadowEnabled,
      shadowColor: '#000000',
      shadowBlur: 8,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      alignment: p.alignment || 'center',
      positionX: p.positionX != null ? p.positionX : 50,
      positionY: p.positionY != null ? p.positionY : 50,
      scale: p.scale != null ? p.scale : 100,
      rotation: p.rotation || 0,
      opacity: p.opacity != null ? p.opacity : 100,
      animation: p.animation || 'none',
      animationDuration: p.animationDuration || 0.6
    },
    startTime: L.start,
    duration: duration
  };
}

function buildStickerClip(L, duration) {
  const id = 'sk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const p = L.props || {};
  return {
    name: L.emoji,
    url: 'sticker://' + id,
    type: 'sticker/plain',
    __stickerId: id,
    stickerState: {
      emoji: L.emoji,
      x: p.x != null ? p.x : 50,
      y: p.y != null ? p.y : 50,
      scale: p.scale != null ? p.scale : 100,
      rotation: 0
    },
    startTime: L.start,
    duration: duration
  };
}

// ═══════════════════════════════════════════════════════════════
//  BUILD EFFECT LAYER
// ═══════════════════════════════════════════════════════════════
function buildEffectLayer(L) {
  const appState = window.__appState;
  if (!appState) return null;

  const duration = L.end - L.start;
  if (duration <= 0) return null;

  const raw = L.raw || '';
  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  let effectState = null;
  let label = '';

  if (L.type === 'adjustment') {
    const adj = extractAdjustments(raw);
    if (!Object.keys(adj).length) return null;
    effectState = { kind: 'adjustment', adjustments: adj };
    label = 'Adj';
  } else if (L.type === 'filter') {
    const fil = extractFilters(raw);
    if (!Object.keys(fil).length) return null;
    effectState = { kind: 'filter', filters: fil };
    label = 'Filter';
  } else if (L.type === 'effect') {
    const preset = raw.trim().toLowerCase();
    if (EFFECT_PRESETS.indexOf(preset) < 0) return null;
    effectState = {
      kind: 'effect',
      presetKey: preset,
      filters: {
        brightness: 100, contrast: 100, saturation: 100, hue: 0,
        grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
      },
      motion: null
    };
    label = preset;
  } else if (L.type === 'colorwheel') {
    const cw = extractColorWheel(raw);
    if (!cw) return null;
    effectState = { kind: 'colorWheel', colorWheel: cw };
    label = 'Color Wheel';
  } else if (L.type === 'chroma') {
    const ch = extractChroma(raw);
    if (!ch) return null;
    effectState = { kind: 'chroma', chroma: ch };
    label = 'Chroma';
  }

  if (!effectState) return null;

  const clipData = {
    name: label,
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: effectState,
    startTime: L.start,
    duration: duration,
    sourceIn: 0,
    __trimmed: true
  };

  placeClipAtTime(appState.timeline.visual, clipData, L.start);
  return L.type + '@' + fmtSec(L.start) + ' (' + fmtSec(duration) + 's)';
}

function extractAdjustments(str) {
  const adj = {};
  const parts = str.split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].toLowerCase().match(/^([a-z][a-z\s]*?)\s+(-?\d+(?:\.\d+)?)/);
    if (!m) continue;
    const key = m[1].replace(/\s+/g, '');
    const mapped = SYNONYMS[key] || key;
    if (ADJUSTMENT_KEYS.indexOf(mapped) >= 0) {
      let v = parseFloat(m[2]);
      // If value > 100, treat as filter scale (100=normal)
      if (v > 100) v = (v - 100) * 1.5;
      adj[mapped] = Math.max(-100, Math.min(100, v));
    }
  }
  return adj;
}

function extractFilters(str) {
  const base = {
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
  };
  const parts = str.split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const low = parts[i].toLowerCase();
    if (FILTER_KEYS.indexOf(low) >= 0) {
      const r = FILTER_RANGES[low] || [0, 100];
      base[low] = r[1];
      continue;
    }
    const m = low.match(/^([a-z]+)\s+(-?\d+(?:\.\d+)?)/);
    if (!m) continue;
    const key = m[1];
    if (FILTER_KEYS.indexOf(key) >= 0) {
      const r = FILTER_RANGES[key] || [0, 100];
      base[key] = Math.max(r[0], Math.min(r[1], parseFloat(m[2])));
    }
  }
  return base;
}

function extractColorWheel(str) {
  const cw = { tones: {}, hdrWhite: 100 };
  let found = false;
  const parts = str.split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].toLowerCase().match(/^(shadows?|midtones?|mid|highlights?|highs?)\s+(\w+)(?:\s+(\d+))?(?:\s+(\d+))?/);
    if (m) {
      const tone = m[1].startsWith('sh') ? 'shadows'
                 : m[1].startsWith('mi') || m[1] === 'mid' ? 'midtones'
                 : 'highlights';
      const hue = COLOR_HUES[m[2]];
      if (hue != null) {
        cw.tones[tone] = {
          h: hue,
          s: m[3] ? Math.max(0, Math.min(100, parseInt(m[3], 10))) : 50,
          intensity: m[4] ? Math.max(0, Math.min(100, parseInt(m[4], 10))) : 50
        };
        found = true;
        continue;
      }
    }
    const hm = parts[i].match(/^hdr\s+(\d+)/i);
    if (hm) { cw.hdrWhite = Math.max(0, Math.min(200, parseInt(hm[1], 10))); found = true; }
  }
  return found ? cw : null;
}

function extractChroma(str) {
  const m = str.match(/(?:chroma(?:\s*key)?|green\s*screen|blue\s*screen)\s*(#[0-9a-fA-F]{3,6})?/i);
  if (!m) return null;
  let hex = m[1];
  if (!hex) {
    if (/green/i.test(str)) hex = '#00ff00';
    else if (/blue/i.test(str)) hex = '#0000ff';
    else hex = '#00ff00';
  }
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const sim = str.match(/similarity\s+(\d+)/i);
  const smooth = str.match(/smooth(?:ness)?\s+(\d+)/i);
  const spill = str.match(/spill\s+(\d+)/i);
  const intensity = str.match(/intensity\s+(\d+)/i);
  return {
    keyColor: rgb,
    similarity: sim ? Math.max(0, Math.min(100, parseInt(sim[1], 10))) : 30,
    smoothness: smooth ? Math.max(0, Math.min(100, parseInt(smooth[1], 10))) : 20,
    spill: spill ? Math.max(0, Math.min(100, parseInt(spill[1], 10))) : 50,
    intensity: intensity ? Math.max(0, Math.min(100, parseInt(intensity[1], 10))) : 100
  };
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO FX
// ═══════════════════════════════════════════════════════════════
function createAudioFxLayerWithRange(key, label, startTime, duration) {
  const appState = window.__appState;
  if (!appState) return null;
  if (!Array.isArray(appState.timeline.audio)) appState.timeline.audio = [];

  const id = 'afx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const clip = {
    name: label,
    url: 'audiofx://' + id,
    type: 'audio/effect',
    duration: duration,
    startTime: startTime,
    sourceIn: 0,
    __audioFxId: id,
    __audioFxKey: key,
    __trimmed: true
  };
  placeClipAtTime(appState.timeline.audio, clip, startTime);
  return id;
}

// ═══════════════════════════════════════════════════════════════
//  EXECUTE TIMESTAMPED
// ═══════════════════════════════════════════════════════════════
function executeTimestampedLayers(parsed) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];
  if (!Array.isArray(appState.timeline.audio)) appState.timeline.audio = [];

  const results = [];
  const warnings = [];
  const layers = parsed.layers || [];

  let firstDuration = 0;
  for (let i = 0; i < layers.length; i++) {
    const d = layers[i].end - layers[i].start;
    if (d > 0) { firstDuration = d; break; }
  }

  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const duration = L.end - L.start;
    if (duration <= 0) continue;

    try {
      if (L.type === 'text') {
        const clipData = buildTextClip(L, duration);
        if (clipData) {
          placeClipAtTime(appState.timeline.visual, clipData, L.start);
          results.push('text@' + fmtSec(L.start) + ' (' + fmtSec(duration) + 's)');
        }
      } else if (L.type === 'sticker') {
        const clipData = buildStickerClip(L, duration);
        if (clipData) {
          placeClipAtTime(appState.timeline.visual, clipData, L.start);
          results.push('sticker ' + L.emoji + '@' + fmtSec(L.start));
        }
      } else if (L.type === 'audiofx') {
        for (let k = 0; k < L.keys.length; k++) {
          try {
            createAudioFxLayerWithRange(L.keys[k], L.keys[k], L.start, duration);
            results.push('audio:' + L.keys[k] + '@' + fmtSec(L.start));
          } catch (e) { warnings.push('audio ' + L.keys[k] + ': fail'); }
        }
      } else if (L.type === 'adjustment' || L.type === 'filter' || L.type === 'effect' ||
                 L.type === 'colorwheel' || L.type === 'chroma') {
        const r = buildEffectLayer(L);
        if (r) results.push(r);
      }
    } catch (e) {
      warnings.push(L.type + ' @' + fmtSec(L.start) + ': ' + (e.message || 'fail'));
    }
  }

  if (parsed.trailingCommands && parsed.trailingCommands.length > 0) {
    const fallbackDur = firstDuration > 0 ? firstDuration : 3;
    for (let i = 0; i < parsed.trailingCommands.length; i++) {
      const cmd = parsed.trailingCommands[i];
      try {
        const r = executeTrailingCommand(cmd, fallbackDur);
        if (r) results.push(r);
      } catch (e) { warnings.push(cmd); }
    }
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));

  let maxEnd = 0;
  for (let i = 0; i < layers.length; i++) {
    const e = layers[i].end;
    if (Number.isFinite(e) && e > maxEnd) maxEnd = e;
  }
  if (maxEnd > 0 && typeof window.__autofitTimelineToDuration === 'function') {
    setTimeout(function () {
      window.__autofitTimelineToDuration(maxEnd);
    }, 50);
  }

  resetPlayhead();

  return {
    ok: results.length > 0,
    results,
    warnings,
    unknown: _unknownParts.slice(),
    error: results.length === 0 ? (warnings[0] || 'No layers created') : undefined
  };
}

// ═══════════════════════════════════════════════════════════════
//  TRAILING COMMANDS
// ═══════════════════════════════════════════════════════════════
function executeTrailingCommand(cmd, fallbackDuration) {
  const appState = window.__appState;
  if (!appState) return null;

  const low = String(cmd).toLowerCase().trim();

  const adj = extractAdjustments(low);
  if (Object.keys(adj).length > 0) {
    createEffectWithDuration('adjustment', { adjustments: adj }, 'Adj', 0, fallbackDuration);
    return 'adjustment (' + fallbackDuration + 's)';
  }

  const fil = extractFilters(low);
  const hasFilter = Object.keys(fil).some(function (k) {
    return k !== 'brightness' && k !== 'contrast' && k !== 'saturation' &&
           k !== 'hue' && k !== 'opacity' && fil[k] !== 0;
  });
  if (hasFilter) {
    createEffectWithDuration('filter', { filters: fil }, 'Filter', 0, fallbackDuration);
    return 'filter (' + fallbackDuration + 's)';
  }

  const single = low.split(/\s+/).filter(Boolean);
  if (single.length === 1 && EFFECT_PRESETS.indexOf(single[0]) >= 0) {
    createEffectWithDuration('effect', {
      presetKey: single[0],
      filters: {
        brightness: 100, contrast: 100, saturation: 100, hue: 0,
        grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
      },
      motion: null
    }, single[0], 0, fallbackDuration);
    return 'effect:' + single[0];
  }

  return null;
}

function createEffectWithDuration(kind, state, name, startTime, duration) {
  const appState = window.__appState;
  if (!appState) return null;
  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const clipData = {
    name: name || kind,
    url: 'effect://' + id,
    type: 'effect/plain',
    __effectId: id,
    effectState: Object.assign({ kind: kind }, state),
    startTime: startTime || 0,
    duration: duration > 0 ? duration : 3,
    sourceIn: 0,
    __trimmed: true
  };
  placeClipAtTime(appState.timeline.visual, clipData, startTime || 0);
  return id;
}

function resetPlayhead() {
  const eng = window.__playbackEngine;
  if (!eng) return;
  try { if (typeof eng.pause === 'function') eng.pause(); } catch (_) {}
  try { if (typeof eng.seek === 'function') eng.seek(0); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  PARSE PROMPT
// ═══════════════════════════════════════════════════════════════
export function parsePrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { ok: false, error: 'Empty prompt' };
  }

  _resetUnknown();
  const ratio = detectRatio(rawPrompt);

  if (hasTimestampedLayers(rawPrompt)) {
    const parsed = parseTimestampedLayers(rawPrompt);
    if (parsed.layers && parsed.layers.length > 0) {
      return { ok: true, state: { timestampedLayers: parsed, ratio: ratio } };
    }
  }

  const state = {
    adjustments: {}, filters: {}, effectPreset: null, speed: null,
    transition: null, texts: [], stickers: [], colorWheel: null,
    chroma: null, transforms: {}, keyframes: [], audioFx: [],
    trimOps: [],
    ratio: ratio,
    target: 'selected'
  };

  let prompt = rawPrompt.toLowerCase().trim();
  prompt = prompt.replace(/^\s*ratio\s+\d+\s*:\s*\d+\s*$/im, '');

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

  _addUnknown(seg);
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
//  EXECUTE PROMPT
// ═══════════════════════════════════════════════════════════════
export function executePrompt(state) {
  if (!state) return { ok: false, error: 'No state' };
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  if (state.ratio) applyRatio(state.ratio);

  if (state.timestampedLayers) {
    return executeTimestampedLayers(state.timestampedLayers);
  }

  _lastCreatedClips = [];

  const hasClips = hasAnyClips(appState);
  const results = [];
  const warnings = [];

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

      const created = findClipByUrl(appState.timeline.visual, clipData.url);
      if (created) _lastCreatedClips.push(created);

      results.push('text:"' + t.content + '"');
    });
  }

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

  if (state.audioFx.length > 0) {
    state.audioFx.forEach(key => {
      try {
        const id = createAudioFxLayer(key, key);
        if (id) results.push('audio:' + key);
      } catch (e) { console.warn(e); }
    });
  }

  let targetClip = getSelectedClip(appState);
  if (!targetClip && _lastCreatedClips.length > 0) {
    targetClip = _lastCreatedClips[_lastCreatedClips.length - 1];
  }

  const tfKeys = Object.keys(state.transforms);
  if (tfKeys.length > 0 && targetClip) {
    if (!targetClip.__transform) targetClip.__transform = {};
    Object.assign(targetClip.__transform, state.transforms);
    if (targetClip.__textId && targetClip.textState) {
      if (state.transforms.x != null) targetClip.textState.positionX = state.transforms.x;
      if (state.transforms.y != null) targetClip.textState.positionY = state.transforms.y;
      if (state.transforms.scale != null) targetClip.textState.scale = state.transforms.scale;
      if (state.transforms.rotation != null) targetClip.textState.rotation = state.transforms.rotation;
    }
    results.push('transform');
  }

  if (state.keyframes.length > 0 && targetClip) {
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
    results.push('keyframes');
  }

  if (state.speed != null && targetClip) {
    applySpeedToClip(targetClip, state.speed);
    results.push('speed:' + state.speed + 'x');
  }

  if (state.transition && targetClip) {
    targetClip.__transitionIn = {
      key: state.transition.type,
      duration: state.transition.duration
    };
    results.push('transition');
  }

  if (Object.keys(state.adjustments).length > 0) {
    if (hasClips || _lastCreatedClips.length > 0) {
      try {
        const id = createEffectLayer('adjustment', { adjustments: state.adjustments }, 'Adjustments');
        if (id) results.push('adjustments');
      } catch (e) { console.warn(e); }
    } else warnings.push('adjustments: clip daalein');
  }

  if (Object.keys(state.filters).length > 0) {
    if (hasClips || _lastCreatedClips.length > 0) {
      const filters = {
        brightness: 100, contrast: 100, saturation: 100, hue: 0,
        grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
      };
      Object.assign(filters, state.filters);
      try {
        const id = createEffectLayer('filter', { filters }, 'Filter');
        if (id) results.push('filter');
      } catch (e) { console.warn(e); }
    } else warnings.push('filter: clip daalein');
  }

  if (state.effectPreset) {
    if (hasClips || _lastCreatedClips.length > 0) {
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
    } else warnings.push('effect: clip daalein');
  }

  if (state.colorWheel) {
    if (hasClips || _lastCreatedClips.length > 0) {
      try {
        const id = createEffectLayer('colorWheel', { colorWheel: state.colorWheel }, 'Color Wheel');
        if (id) results.push('colorWheel');
      } catch (e) { console.warn(e); }
    } else warnings.push('colorWheel: clip daalein');
  }

  if (state.chroma) {
    if (hasClips || _lastCreatedClips.length > 0) {
      try {
        const id = createEffectLayer('chroma', { chroma: state.chroma }, 'Chroma Key');
        if (id) results.push('chroma');
      } catch (e) { console.warn(e); }
    } else warnings.push('chroma: clip daalein');
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));

  resetPlayhead();

  if (results.length === 0) {
    const errMsg = warnings.length ? warnings.join(' • ') : 'Koi command execute nahi hui';
    return { ok: false, error: errMsg, unknown: _unknownParts.slice() };
  }
  if (warnings.length > 0) results.push('⚠️ ' + warnings.join(', '));
  return { ok: true, results, unknown: _unknownParts.slice() };
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