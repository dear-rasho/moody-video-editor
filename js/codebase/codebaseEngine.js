import { createEffectLayer } from '../workspace/effectLayer.js';
import { createAudioFxLayer } from '../workspace/audioEffectLayer.js';
import { placeClipAtTime } from '../layers/layersManager.js';
import { resolveFontFamily, loadGoogleFont } from './fontLibrary.js';
import { openKeyframeGraph } from '../workspace/keyframeGraph.js';
import { clearKeyframes as clearAllKeyframes } from '../workspace/keyframeStore.js';
import { runDetectBeats, runBeatsEditing, buildEffectStateForKey } from './beatsEngine.js';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
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

// 🆕 Transition aliases — ONCE at top
const TRANSITION_ALIASES = {
  'fade': 'fade',
  'dissolve': 'dissolve',
  'fade black': 'fadeBlack', 'fadeblack': 'fadeBlack',
  'fade white': 'fadeWhite', 'fadewhite': 'fadeWhite',
  'slide': 'slideLeft', 'slide left': 'slideLeft', 'slideleft': 'slideLeft',
  'slide right': 'slideRight', 'slideright': 'slideRight',
  'slide up': 'slideUp', 'slideup': 'slideUp',
  'slide down': 'slideDown', 'slidedown': 'slideDown',
  'zoom': 'zoomIn', 'zoom in': 'zoomIn', 'zoomin': 'zoomIn',
  'zoom out': 'zoomOut', 'zoomout': 'zoomOut',
  'wipe left': 'wipeLeft', 'wipeleft': 'wipeLeft',
  'wipe right': 'wipeRight', 'wiperight': 'wipeRight',
  'circle': 'circleIn', 'circle in': 'circleIn', 'circlein': 'circleIn',
  'blur': 'blur'
};

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let _lastCreatedClips = [];
let _unknownParts = [];
let _autoOpenGraph = false;

function _resetUnknown() { _unknownParts = []; }
function _addUnknown(part, context) {
  if (!part) return;
  const trimmed = String(part).trim();
  if (!trimmed) return;
  const entry = context ? (context + ': "' + trimmed + '"') : '"' + trimmed + '"';
  if (_unknownParts.indexOf(entry) < 0) _unknownParts.push(entry);
}

// ═══════════════════════════════════════════════════════════════
//  PROPERTY SPLITTER
// ═══════════════════════════════════════════════════════════════
const PROP_PATTERNS = [
  /^(?:font\s*[-]?size)\s+\d+/i,
  /^(?:colou?r\s+ramp|gradient|ramp)\s+#[0-9a-fA-F]+\s+(?:to|→|->)\s+#[0-9a-fA-F]+/i,
  /^(?:colou?r\s+ramp|gradient|ramp)\s+#[0-9a-fA-F]+\s+#[0-9a-fA-F]+/i,
  /^position\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/i,
  /^position\s+(?:top|bottom|center|middle|left|right)\b/i,
  /^position\s*[xy]\s+-?\d+(?:\.\d+)?/i,
  /^anchor\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/i,
  /^anchor\s*[xy]\s+-?\d+(?:\.\d+)?/i,
  /^anchor\s+(?:top-left|top-center|top-right|center-left|center-right|bottom-left|bottom-center|bottom-right|top|bottom|center|middle|left|right)\b/i,
  /^animation\s+[a-z][a-z0-9]*/i,
  /^font\s+(?:bold|italic)\b/i,
  /^font\s+[A-Za-z][A-Za-z0-9_-]*(?:\s+(?!(?:size|color|colour|position|animation|shadow|align|alignment|scale|rotation|opacity|stroke|anchor|newline|linebreak|bold|italic)\b)[A-Za-z][A-Za-z0-9_-]*)*/i,
  /^font\s+\S+/i,
  /^size\s+\d+/i,
  /^colou?r\s+#[0-9a-fA-F]+/i,
  /^colou?r\s+[a-zA-Z]+/i,
  /^shadow\b/i,
  /^bold\b/i,
  /^italic\b/i,
  /^newline\b/i,
  /^linebreak\b/i,
  /^align(?:ment)?\s+(?:left|center|right)\b/i,
  /^scale\s+-?\d+/i,
  /^rot(?:ation)?\s+-?\d+/i,
  /^opacity\s+\d+/i,
  /^stroke\s*[- ]?(?:width\s+)?\d+(?:\s+#[0-9a-fA-F]+)?/i
];

function splitPropString(str) {
  if (!str) return [];
  const commaParts = String(str).split(',').map(s => s.trim()).filter(Boolean);
  const result = [];

  for (let ci = 0; ci < commaParts.length; ci++) {
    let rest = commaParts[ci];
    let safety = 0;
    while (rest && safety++ < 30) {
      rest = rest.replace(/^[\s,]+/, '');
      if (!rest) break;
      let matched = false;
      for (let pi = 0; pi < PROP_PATTERNS.length; pi++) {
        const m = rest.match(PROP_PATTERNS[pi]);
        if (m && m.index === 0 && m[0].length > 0) {
          result.push(m[0].trim());
          rest = rest.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) { result.push(rest); break; }
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
  return /\[\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*\]/.test(rawPrompt);
}

function parseTimeStr(str) {
  const s = String(str).trim();
  const parts = s.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const sec = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + sec;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const sec = parseFloat(parts[1]) || 0;
    return m * 60 + sec;
  }
  return parseFloat(parts[0]) || 0;
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
  const blockRegex = /\[\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*\]/g;

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

// ═══════════════════════════════════════════════════════════════
//  BLOCK TYPE DETECTION
// ═══════════════════════════════════════════════════════════════
function detectBlockType(content) {
  const c = (content || '').trim();
  if (!c) return null;

  if (/^(?:sticker|emoji)\s+/i.test(c)) return 'sticker';
  if (/^(?:audio|sound|awaaz)\s+/i.test(c)) return 'audiofx';
  if (/^["']/.test(c)) return 'text';
  if (/^text\s+["']/i.test(c)) return 'text';
  if (/\[seg/i.test(c)) return 'text';

  const onlyWord = c.toLowerCase().trim();
  if (EFFECT_PRESETS.indexOf(onlyWord) >= 0) return 'effect';

  const parts = c.split(/[,\n]+/).map(s => s.trim());
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const low = part.toLowerCase();

    if (FILTER_KEYS.indexOf(low) >= 0) return 'effect';

    const m = low.match(/^([a-z][a-z\s]*?)\s+(-?\d+(?:\.\d+)?)/);
    if (m) {
      const key = m[1].replace(/\s+/g, '');
      const mapped = SYNONYMS[key] || key;
      if (ADJUSTMENT_KEYS.indexOf(mapped) >= 0) return 'effect';
      if (FILTER_KEYS.indexOf(mapped) >= 0) return 'effect';
      if (mapped === 'shadows' || mapped === 'midtones' ||
          mapped === 'highlights' || mapped === 'hdr') return 'effect';
    }
  }

  if (/\b(shadows?|midtones?|highlights?)\s+(?:red|orange|yellow|lime|green|teal|cyan|sky|blue|indigo|purple|violet|magenta|pink|rose)\b/i.test(c)) {
    return 'effect';
  }
  if (/\bhdr\s+\d+/i.test(c)) return 'effect';
  if (/\b(chroma|green\s*screen|blue\s*screen)\b/i.test(c)) return 'effect';

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
  if (type === 'effect') {
    return { type: 'effect', start: block.start, end: block.end, raw: content };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  TEXT BLOCK PARSER
// ═══════════════════════════════════════════════════════════════
function parseTextBlock(block, content) {
  const segments = [];
  const ranges = [];
  const startRegex = /\[\s*(?:seg|segment|word)\s+/gi;
  let m;

  while ((m = startRegex.exec(content)) !== null) {
    const blockStart = m.index;

    let qi = m.index + m[0].length;
    while (qi < content.length && content[qi] !== '"' && content[qi] !== "'") qi++;
    if (qi >= content.length) continue;

    const openQ = content[qi];
    const endBracket = content.indexOf(']', qi + 1);
    if (endBracket < 0) continue;

    let closeQi = -1;
    for (let j = endBracket - 1; j > qi; j--) {
      if (content[j] === openQ) { closeQi = j; break; }
    }
    if (closeQi < 0) continue;

    const segText = content.slice(qi + 1, closeQi);
    const segPropsStr = content.slice(closeQi + 1, endBracket).trim();

    const parsedSeg = parseLayerProps(segPropsStr);
    const segProps = parsedSeg.props || parsedSeg;
    const segUnknown = parsedSeg.unknown || [];
    for (let k = 0; k < segUnknown.length; k++) {
      _addUnknown(segUnknown[k], 'seg "' + segText + '"');
    }

    segments.push({ text: segText, props: segProps });
    ranges.push([blockStart, endBracket + 1]);

    startRegex.lastIndex = endBracket + 1;
  }

  let textWithoutSegs = content;
  for (let i = ranges.length - 1; i >= 0; i--) {
    textWithoutSegs =
      textWithoutSegs.slice(0, ranges[i][0]) + ' ' +
      textWithoutSegs.slice(ranges[i][1]);
  }
  textWithoutSegs = textWithoutSegs.replace(/\s+/g, ' ').trim();

  let mainText = '';
  let propsStr = '';

  if (textWithoutSegs) {
    const qm = textWithoutSegs.match(/^text\s+["']([\s\S]*?)["']\s*(.*)$/i);
    if (qm) {
      mainText = qm[1];
      propsStr = qm[2] || '';
    } else {
      const qm2 = textWithoutSegs.match(/^["']([\s\S]*?)["']\s*(.*)$/);
      if (qm2) {
        mainText = qm2[1];
        propsStr = qm2[2] || '';
      } else {
        propsStr = textWithoutSegs;
      }
    }
  }

  const parsedProps = parseLayerProps(propsStr);
  const props = parsedProps.props || parsedProps;
  const unknownProps = parsedProps.unknown || [];
  for (let k = 0; k < unknownProps.length; k++) {
    _addUnknown(unknownProps[k], 'text @ ' + fmtSec(block.start));
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
  return { type: 'sticker', start: block.start, end: block.end, emoji, props };
}

function parseAudioFxBlock(block, content) {
  const m = content.match(/^(?:audio|sound|awaaz)\s+([a-z][a-z\s]*)/i);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).filter(Boolean);
  const keys = words.filter(w => AUDIO_FX_KEYS.indexOf(w) >= 0);
  if (!keys.length) return null;
  return { type: 'audiofx', start: block.start, end: block.end, keys };
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
    anchorX: 50,
    anchorY: 50,
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

  if (!str) return { props, unknown };

  const parts = splitPropString(str);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let m;

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

    m = part.match(/^position\s*x\s+(-?\d+(?:\.\d+)?)/i);
    if (m) { props.positionX = parseFloat(m[1]); continue; }

    m = part.match(/^position\s*y\s+(-?\d+(?:\.\d+)?)/i);
    if (m) { props.positionY = parseFloat(m[1]); continue; }

    m = part.match(/^anchor\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (m) { props.anchorX = parseFloat(m[1]); props.anchorY = parseFloat(m[2]); continue; }

    m = part.match(/^anchor\s*x\s+(-?\d+(?:\.\d+)?)/i);
    if (m) { props.anchorX = parseFloat(m[1]); continue; }

    m = part.match(/^anchor\s*y\s+(-?\d+(?:\.\d+)?)/i);
    if (m) { props.anchorY = parseFloat(m[1]); continue; }

    m = part.match(/^anchor\s+(top-left|top-center|top-right|center-left|center-right|bottom-left|bottom-center|bottom-right|top|bottom|center|middle|left|right)\b/i);
    if (m) {
      const a = m[1].toLowerCase();
      if (a === 'top-left')          { props.anchorX = 0;   props.anchorY = 0; }
      else if (a === 'top-center' || a === 'top')    { props.anchorX = 50;  props.anchorY = 0; }
      else if (a === 'top-right')    { props.anchorX = 100; props.anchorY = 0; }
      else if (a === 'center-left' || a === 'left')  { props.anchorX = 0;   props.anchorY = 50; }
      else if (a === 'center' || a === 'middle')     { props.anchorX = 50;  props.anchorY = 50; }
      else if (a === 'center-right' || a === 'right') { props.anchorX = 100; props.anchorY = 50; }
      else if (a === 'bottom-left')  { props.anchorX = 0;   props.anchorY = 100; }
      else if (a === 'bottom-center' || a === 'bottom') { props.anchorX = 50; props.anchorY = 100; }
      else if (a === 'bottom-right') { props.anchorX = 100; props.anchorY = 100; }
      continue;
    }

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
    if (m) { props.positionX = parseFloat(m[1]); props.positionY = parseFloat(m[2]); continue; }

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

    m = part.match(/^colou?r\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) { props.color = m[1]; continue; }
    m = part.match(/^colou?r\s+([a-zA-Z]+)/i);
    if (m) { props.color = colorNameToHex(m[1]); continue; }

    if (/^shadow\b/i.test(part)) { props.shadowEnabled = true; continue; }

    if (/^newline\b/i.test(part) || /^linebreak\b/i.test(part)) { props.newline = true; continue; }

    if (/^font\s+bold\b/i.test(part)) { props.fontWeight = 'bold'; continue; }
    if (/^font\s+italic\b/i.test(part)) { props.fontStyle = 'italic'; continue; }
    if (/^bold$/i.test(part)) { props.fontWeight = 'bold'; continue; }
    if (/^italic$/i.test(part)) { props.fontStyle = 'italic'; continue; }

    m = part.match(/^font\s+(.+)$/i);
    if (m) {
      const requested = m[1].trim();
      const resolved = resolveFontFamily(requested);
      props.fontFamily = resolved;
      loadGoogleFont(resolved);
      continue;
    }

    m = part.match(/^font\s*[-]?size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    m = part.match(/^size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    m = part.match(/^align(?:ment)?\s+(left|center|right)/i);
    if (m) { props.alignment = m[1].toLowerCase(); continue; }

    m = part.match(/^scale\s+(-?\d+)/i);
    if (m) { props.scale = parseInt(m[1], 10); continue; }

    m = part.match(/^rot(?:ation)?\s+(-?\d+)/i);
    if (m) { props.rotation = parseInt(m[1], 10); continue; }

    m = part.match(/^opacity\s+(\d+)/i);
    if (m) { props.opacity = parseInt(m[1], 10); continue; }

    m = part.match(/^stroke\s*[- ]?(?:width\s+)?(\d+)(?:\s+(#[0-9a-fA-F]{3,8}))?/i);
    if (m) {
      props.strokeWidth = parseInt(m[1], 10);
      if (m[2]) props.strokeColor = m[2];
      continue;
    }

    unknown.push(part);
  }

  return { props, unknown };
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
  return map[String(name || '').toLowerCase()] || '#ffffff';
}

// ═══════════════════════════════════════════════════════════════
//  BUILD TEXT CLIP
// ═══════════════════════════════════════════════════════════════
function buildTextClip(L, duration) {
  const id = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const p = L.props || {};

  let segments = null;
  if (L.segments && L.segments.length > 0) {
    segments = L.segments.map(s => {
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
        anchorX: sp.anchorX != null ? sp.anchorX : 50,
        anchorY: sp.anchorY != null ? sp.anchorY : 50,
        newline: !!sp.newline
      };
    });
  }

  const mainText = L.text || '';
  if (!mainText && !segments) return null;

  return {
    name: (mainText || (segments ? segments.map(s => s.text).join(' ') : '')).slice(0, 30),
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
      anchorX: p.anchorX != null ? p.anchorX : 50,
      anchorY: p.anchorY != null ? p.anchorY : 50,
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
  const targetClip = getSelectedDisplayClip(appState);

  const adj = extractAdjustments(raw);
  const cw = extractColorWheel(raw);
  const fil = extractFilters(raw);
  const hasFilter = Object.keys(fil).some(k => {
    if (k === 'brightness' || k === 'contrast' || k === 'saturation' ||
        k === 'hue' || k === 'opacity') return false;
    return fil[k] !== 0;
  });
  const onlyWord = raw.trim().toLowerCase();
  const isPreset = EFFECT_PRESETS.indexOf(onlyWord) >= 0;
  const ch = extractChroma(raw);

  const hasAny = Object.keys(adj).length > 0 || cw || hasFilter || isPreset || ch;
  if (!hasAny) return null;

  if (targetClip) {
    if (!targetClip.__grading) targetClip.__grading = {};

    if (Object.keys(adj).length > 0) {
      targetClip.__grading.adjustments = Object.assign(
        {}, targetClip.__grading.adjustments || {}, adj
      );
    }
    if (cw) {
      targetClip.__grading.colorWheel = Object.assign(
        {}, targetClip.__grading.colorWheel || {}, cw
      );
    }
    if (hasFilter) {
      targetClip.__grading.filters = Object.assign(
        {}, targetClip.__grading.filters || {}, fil
      );
    }
    if (ch) targetClip.__grading.chroma = ch;
    if (isPreset) targetClip.__grading.preset = onlyWord;

    return 'attached to "' + (targetClip.name || 'clip').slice(0, 20) + '"';
  }

  const created = [];

  if (Object.keys(adj).length > 0) {
    const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-adj';
    placeClipAtTime(appState.timeline.visual, {
      name: 'Adj',
      url: 'effect://' + id,
      type: 'effect/plain',
      __effectId: id,
      effectState: { kind: 'adjustment', adjustments: adj },
      startTime: L.start,
      duration: duration,
      sourceIn: 0,
      __trimmed: true
    }, L.start);
    created.push('adj');
  }

  if (cw) {
    const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-cw';
    placeClipAtTime(appState.timeline.visual, {
      name: 'Wheel',
      url: 'effect://' + id,
      type: 'effect/plain',
      __effectId: id,
      effectState: { kind: 'colorWheel', colorWheel: cw },
      startTime: L.start,
      duration: duration,
      sourceIn: 0,
      __trimmed: true
    }, L.start);
    created.push('wheel');
  }

  if (hasFilter) {
    const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-fil';
    placeClipAtTime(appState.timeline.visual, {
      name: 'Filter',
      url: 'effect://' + id,
      type: 'effect/plain',
      __effectId: id,
      effectState: { kind: 'filter', filters: fil },
      startTime: L.start,
      duration: duration,
      sourceIn: 0,
      __trimmed: true
    }, L.start);
    created.push('filter');
  }

  if (isPreset) {
    const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-pre';
    placeClipAtTime(appState.timeline.visual, {
      name: onlyWord,
      url: 'effect://' + id,
      type: 'effect/plain',
      __effectId: id,
      effectState: {
        kind: 'effect',
        presetKey: onlyWord,
        filters: {
          brightness: 100, contrast: 100, saturation: 100, hue: 0,
          grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
        },
        motion: null
      },
      startTime: L.start,
      duration: duration,
      sourceIn: 0,
      __trimmed: true
    }, L.start);
    created.push('preset:' + onlyWord);
  }

  if (ch) {
    const id = 'fx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-ch';
    placeClipAtTime(appState.timeline.visual, {
      name: 'Chroma',
      url: 'effect://' + id,
      type: 'effect/plain',
      __effectId: id,
      effectState: { kind: 'chroma', chroma: ch },
      startTime: L.start,
      duration: duration,
      sourceIn: 0,
      __trimmed: true
    }, L.start);
    created.push('chroma');
  }

  if (created.length === 0) return null;

  return '@' + fmtSec(L.start) + ' (' + fmtSec(duration) + 's) [' +
         created.join(' + ') + ']';
}

function getSelectedDisplayClip(appState) {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;

  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'V') return null;

  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;

  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;

  const clip = track[clipIdx];
  if (!clip || !clip.type) return null;

  const isVideo = clip.type.indexOf('video/') === 0;
  const isImage = clip.type.indexOf('image/') === 0;
  if (!isVideo && !isImage) return null;

  return clip;
}

// ═══════════════════════════════════════════════════════════════
//  EXTRACTORS
// ═══════════════════════════════════════════════════════════════
function extractAdjustments(str) {
  const adj = {};
  const parts = str.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].toLowerCase().match(/^([a-z][a-z\s]*?)\s+(-?\d+(?:\.\d+)?)/);
    if (!m) continue;

    const key = m[1].replace(/\s+/g, '');
    const mapped = SYNONYMS[key] || key;
    if (ADJUSTMENT_KEYS.indexOf(mapped) < 0) continue;

    let v = parseFloat(m[2]);

    if (mapped === 'brightness' || mapped === 'contrast' ||
        mapped === 'saturation' || mapped === 'exposure') {
      if (v >= 50) v = (v - 100) * 1.5;
    }

    adj[mapped] = Math.max(-100, Math.min(100, v));
  }
  return adj;
}

function extractFilters(str) {
  const base = {
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
  };
  const parts = str.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
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
  const parts = str.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
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
//  EXECUTE TIMESTAMPED LAYERS
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
            results.push('audio:' + L.keys[k]);
          } catch (e) { warnings.push('audio ' + L.keys[k] + ': fail'); }
        }
      } else if (L.type === 'effect') {
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
      try {
        const r = executeTrailingCommand(parsed.trailingCommands[i], fallbackDur);
        if (r) results.push(r);
      } catch (e) { warnings.push(parsed.trailingCommands[i]); }
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
    setTimeout(() => window.__autofitTimelineToDuration(maxEnd), 50);
  }

  if (_autoOpenGraph) {
    setTimeout(() => openKeyframeGraph(), 200);
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
  const hasFilter = Object.keys(fil).some(k => {
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
    effectState: Object.assign({ kind }, state),
    startTime: startTime || 0,
    duration: duration > 0 ? duration : 3,
    sourceIn: 0,
    __trimmed: true
  };
  placeClipAtTime(appState.timeline.visual, clipData, startTime || 0);
  return id;
}

function resetPlayhead() {
  // 🆕 Only pause — do NOT seek back to 0.
  // Playhead stays where the user had it before applying the prompt.
  const eng = window.__playbackEngine;
  if (!eng) return;
  try { if (typeof eng.pause === 'function') eng.pause(); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  LAYER TRANSITIONS PARSER
// ═══════════════════════════════════════════════════════════════
function parseLayerTransitions(seg) {
  const m = seg.match(/^(?:layer\s+([a-z]\d+)\s+)?transitions?\s+(.+?)(\s+loop)?$/i);
  if (!m) return null;

  const layerKey = m[1] ? m[1].toUpperCase() : null;
  const listStr = m[2].trim();
  const loop = !!m[3];

  const parts = listStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1 && !layerKey) return null;

  const list = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase().trim();

    if (part === 'null' || part === 'none' || part === 'skip' || part === '-') {
      list.push({ type: null, duration: null });
      continue;
    }

    const dm = part.match(/^(.+?)\s+([\d.]+)$/);
    let name = part;
    let dur = 0.5;

    if (dm) {
      const possibleName = dm[1].trim();
      const possibleDur = parseFloat(dm[2]);
      if (TRANSITION_ALIASES[possibleName.replace(/\s+/g, ' ')] !== undefined) {
        name = possibleName;
        dur = Math.max(0.1, Math.min(3, possibleDur));
      }
    }

    const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
    let resolved = TRANSITION_ALIASES[normalizedName];
    if (resolved === undefined) {
      resolved = TRANSITION_ALIASES[normalizedName.replace(/\s+/g, '')];
    }
    if (resolved === undefined) {
      resolved = TRANSITION_ALIASES[normalizedName.split(/\s+/)[0]];
    }

    if (resolved === undefined) continue;

    list.push({
      type: resolved,
      duration: resolved ? dur : null
    });
  }

  if (!list.length) return null;
  return { layerKey, list, loop };
}

// ═══════════════════════════════════════════════════════════════
//  SPECIAL COMMANDS
// ═══════════════════════════════════════════════════════════════
function trySpecialCommand(seg, state) {
  const low = seg.toLowerCase().trim();

  // 🆕 Detect beats (with optional filter)
  {
    const dbM = low.match(/^(?:detect|find|identify)\s*beats?\s*(.*)$/i)
             || low.match(/^beats?\s*detect\s*(.*)$/i);
    if (dbM) {
      state.detectBeats = { filter: (dbM[1] || '').trim() };
      return true;
    }
  }
  if (/^(tighten\s*track|close\s*gaps?|magnet|no\s*gaps?)$/i.test(low)) {
    state.tightenTracks = true;
    return true;
  }

  const layerTransM = parseLayerTransitions(low);
  if (layerTransM) {
    state.layerTransitions = layerTransM;
    return true;
  }

  const transAllM = low.match(/^(?:transition\s+all|all\s+transitions?|transitions?\s+between\s+all)\s+(fade\s*black|fade\s*white|fade|dissolve|slide\s*left|slide\s*right|slide\s*up|slide\s*down|zoom\s*in|zoom\s*out|wipe\s*left|wipe\s*right|circle\s*in)(?:\s+([\d.]+))?$/i);
  if (transAllM) {
    const raw = transAllM[1].toLowerCase().replace(/\s+/g, '');
    const typeMap = {
      fade: 'fade', fadeblack: 'fadeBlack', fadewhite: 'fadeWhite',
      dissolve: 'dissolve', slideleft: 'slideLeft', slideright: 'slideRight',
      slideup: 'slideUp', slidedown: 'slideDown', zoomin: 'zoomIn',
      zoomout: 'zoomOut', wipeleft: 'wipeLeft', wiperight: 'wipeRight',
      circlein: 'circleIn'
    };
    const key = typeMap[raw] || 'fade';
    const duration = transAllM[2] ? parseFloat(transAllM[2]) : 0.5;
    state.transitionAll = { type: key, duration: Math.max(0.1, Math.min(3, duration)) };
    return true;
  }

  const atM = low.match(
    /^transition\s+at\s+([\d.]+)\s*s?\s+(fade\s*black|fade\s*white|fade|dissolve|slide\s*left|slide\s*right|slide\s*up|slide\s*down|zoom\s*in|zoom\s*out|wipe\s*left|wipe\s*right|circle\s*in)\s*([\d.]+)?$/i
  );
  if (atM) {
    const time = parseFloat(atM[1]);
    const raw = atM[2].toLowerCase().replace(/\s+/g, '');
    const typeMap = {
      fade: 'fade', fadeblack: 'fadeBlack', fadewhite: 'fadeWhite',
      dissolve: 'dissolve', slideleft: 'slideLeft', slideright: 'slideRight',
      slideup: 'slideUp', slidedown: 'slideDown', zoomin: 'zoomIn',
      zoomout: 'zoomOut', wipeleft: 'wipeLeft', wiperight: 'wipeRight',
      circlein: 'circleIn'
    };
    if (!state.atTransitions) state.atTransitions = [];
    state.atTransitions.push({
      time: time,
      type: typeMap[raw] || 'fade',
      duration: atM[3] ? Math.max(0.1, Math.min(3, parseFloat(atM[3]))) : 0.5
    });
    return true;
  }

  if (/^(graph\s*on|auto\s*graph|show\s*graph\s*on)$/i.test(low)) {
    state.autoGraph = true; return true;
  }
  if (/^(graph\s*off|auto\s*graph\s*off|no\s*graph)$/i.test(low)) {
    state.autoGraph = false; return true;
  }
  if (/^(graph|show\s*graph|open\s*graph|keyframe\s*graph|kf\s*graph)$/i.test(low)) {
    state.openGraph = true; return true;
  }
  if (/^(clear\s*keyframes?|delete\s*keyframes?|remove\s*keyframes?|reset\s*keyframes?)$/i.test(low)) {
    state.clearKeyframes = true; return true;
  }

  return false;
}
// ═══════════════════════════════════════════════════════════════
//  🆕 LAYER TRANSITIONS EXTRACTOR (before comma-split)
//
//  Problem: parsePrompt splits input by comma. A command like:
//    "layer v1 transitions dissolve, slide, zoom, fade"
//  breaks into:
//    ["layer v1 transitions dissolve", "slide", "zoom", "fade"]
//  → only 1 transition gets applied instead of 4.
//
//  Fix: scan the RAW prompt, grab the full comma-list BEFORE
//  the generic split runs.
// ═══════════════════════════════════════════════════════════════
const _TRANS_ITEM_SRC =
  '(?:(?:fade\\s*black|fade\\s*white|fade|dissolve' +
  '|slide(?:\\s+(?:left|right|up|down))?' +
  '|zoom(?:\\s+(?:in|out))?' +
  '|wipe(?:\\s+(?:left|right))?' +
  '|circle(?:\\s+in)?' +
  '|blur' +
  '|null|none|skip|-)' +
  '(?:\\s+\\d+(?:\\.\\d+)?)?)';

function extractLayerTransitionsFromPrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') return null;

  const re = new RegExp(
    '(?:^|\\n|,)\\s*(' +
      '(?:layer\\s+[a-z]\\d+\\s+)?transitions?\\s+' +
      _TRANS_ITEM_SRC +
      '(?:\\s*,\\s*' + _TRANS_ITEM_SRC + ')*' +
    ')(\\s+loop)?',
    'i'
  );

  const m = rawPrompt.match(re);
  if (!m) return null;

  const cmd = (m[1] + (m[2] || '')).trim();
  const parsed = parseLayerTransitions(cmd);
  if (!parsed || !parsed.list || !parsed.list.length) return null;

  const remaining = (
    rawPrompt.slice(0, m.index) +
    rawPrompt.slice(m.index + m[0].length)
  ).trim();

  return { parsed: parsed, remaining: remaining };
}
// ═══════════════════════════════════════════════════════════════
//  🆕 BEATS EDIT EXTRACTOR (before comma-split)
//  "beats edit shake, zoom, pulse" → pattern array
// ═══════════════════════════════════════════════════════════════
function extractBeatsEditFromPrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') return null;

  const low = String(rawPrompt).toLowerCase();
  const marker = 'beats edit';
  const idx = low.indexOf(marker);
  if (idx < 0) return null;

  // Everything after "beats edit"
  const after = rawPrompt.slice(idx + marker.length);

  // Find first newline — beats edit ends at newline
  const nlIdx = after.search(/\n/);
  let beatsPart, rest;

  if (nlIdx >= 0) {
    beatsPart = after.slice(0, nlIdx);
    rest = after.slice(nlIdx + 1);
  } else {
    beatsPart = after;
    rest = '';
  }

  // Clean leading separators
  beatsPart = beatsPart.replace(/^[\s,:;\-]+/, '').trim();
  if (!beatsPart) return null;

  // Split by comma OR whitespace
  const pattern = beatsPart
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s && /^[a-z][a-z0-9_]*$/i.test(s));

  if (!pattern.length) return null;

  const before = rawPrompt.slice(0, idx).replace(/[\s,]+$/, '');
  const remaining = (before + (rest ? '\n' + rest.trim() : '')).trim();

  return { pattern, remaining };
}

// 🆕 Import at top of file (agar nahi hai):
// import { runDetectBeats, runBeatsEditing } from './beatsEngine.js';
// ═══════════════════════════════════════════════════════════════
//  PARSE PROMPT
// ═══════════════════════════════════════════════════════════════
export function parsePrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { ok: false, error: 'Empty prompt' };
  }

  console.log('[parsePrompt] input:', JSON.stringify(rawPrompt));

  _resetUnknown();
  const ratio = detectRatio(rawPrompt);

  if (hasTimestampedLayers(rawPrompt)) {
    const parsed = parseTimestampedLayers(rawPrompt);
    if (parsed.layers && parsed.layers.length > 0) {
      return { ok: true, state: { timestampedLayers: parsed, ratio } };
    }
  }

  const state = {
    adjustments: {}, filters: {}, effectPreset: null, speed: null,
    transition: null, texts: [], stickers: [], colorWheel: null,
    chroma: null, transforms: {}, keyframes: [], audioFx: [],
    trimOps: [],
    textProps: null,
    ratio: ratio,
    target: 'selected',
    autoGraph: null,
    openGraph: false,
    clearKeyframes: false,
    tightenTracks: false,
    transitionAll: null,
    atTransitions: [],
    layerTransitions: null,
       detectBeats: null,
    beatsEdit: null
  };

  let prompt = rawPrompt.toLowerCase().trim();
  prompt = prompt.replace(/^\s*ratio\s+\d+\s*:\s*\d+\s*$/im, '');

  // ═══════════════════════════════════════════════════════════
  //  🆕 BEATS EDIT — scan raw prompt for "beats edit"
  // ═══════════════════════════════════════════════════════════
  {
    const marker = 'beats edit';
    const markerIdx = prompt.indexOf(marker);

    console.log('[parsePrompt] beats marker index:', markerIdx);

    if (markerIdx >= 0) {
      // Everything after "beats edit"
      const after = prompt.slice(markerIdx + marker.length);

      // Split at first newline
      const nlIdx = after.search(/\n/);
      let beatsPart, rest;
      if (nlIdx >= 0) {
        beatsPart = after.slice(0, nlIdx);
        rest = after.slice(nlIdx + 1);
      } else {
        beatsPart = after;
        rest = '';
      }

      // Strip leading separators
      beatsPart = beatsPart.replace(/^[\s,:;\-]+/, '').trim();

      console.log('[parsePrompt] beatsPart:', JSON.stringify(beatsPart));
      if (beatsPart) {
        // 🆕 Support new syntax: ';', ':', '+', ','
        // Keep the raw string; parse in beatsEngine
        const rawPattern = beatsPart.trim();

        console.log('[parsePrompt] beats raw:', JSON.stringify(rawPattern));

        if (rawPattern) {
          state.beatsEdit = { raw: rawPattern };

          const before = prompt.slice(0, markerIdx).replace(/[\s,]+$/, '');
          prompt = (before + (rest ? '\n' + rest.trim() : '')).trim();

          console.log('[parsePrompt] remaining after extraction:', JSON.stringify(prompt));
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  🆕 LAYER TRANSITIONS — scan raw prompt
  // ═══════════════════════════════════════════════════════════
  {
    const re = /(?:^|\n|,)\s*((?:layer\s+[a-z]\d+\s+)?transitions?\s+(?:(?:fade\s*black|fade\s*white|fade|dissolve|slide(?:\s+(?:left|right|up|down))?|zoom(?:\s+(?:in|out))?|wipe(?:\s+(?:left|right))?|circle(?:\s+in)?|blur|null|none|skip|-)(?:\s+\d+(?:\.\d+)?)?)(?:\s*,\s*(?:(?:fade\s*black|fade\s*white|fade|dissolve|slide(?:\s+(?:left|right|up|down))?|zoom(?:\s+(?:in|out))?|wipe(?:\s+(?:left|right))?|circle(?:\s+in)?|blur|null|none|skip|-)(?:\s+\d+(?:\.\d+)?)?))*)(\s+loop)?/i;
    const m = prompt.match(re);
    if (m) {
      const cmd = (m[1] + (m[2] || '')).trim();
      const parsed = parseLayerTransitions(cmd);
      if (parsed && parsed.list && parsed.list.length) {
        state.layerTransitions = parsed;
        prompt = (
          prompt.slice(0, m.index) +
          prompt.slice(m.index + m[0].length)
        ).trim();
      }
    }
  }

  if (/\ball\s+clips?\b|\bevery\s+clip\b|\bsab\s+clips?\b|\bhar\s+clip\b/.test(prompt)) {
    state.target = 'all';
    prompt = prompt.replace(/\ball\s+clips?\b|\bevery\s+clip\b|\bsab\s+clips?\b|\bhar\s+clip\b/g, '');
  }

  const parts = prompt.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  console.log('[parsePrompt] final parts:', parts);
  console.log('[parsePrompt] state.beatsEdit:', state.beatsEdit);

  for (const part of parts) {
    if (trySpecialCommand(part, state)) continue;
    parseSegment(part, state);
  }

  return { ok: true, state };
}

// ═══════════════════════════════════════════════════════════════
//  PARSE SEGMENT
// ═══════════════════════════════════════════════════════════════
function parseSegment(seg, state) {
  if (/^(?:layer\s+[a-z]\d+\s+)?transitions?\s+/i.test(seg)) return;
  if (/^transition\s+(?:at|all)\s/i.test(seg)) return;

  const kfM = seg.match(/\b(scale|zoom|rotation|rotate|x|y|position|opacity)\s+(-?[\d.]+)(?:\s*,?\s*(-?[\d.]+))?\s+to\s+(-?[\d.]+)(?:\s*,?\s*(-?[\d.]+))?\s+(?:over|in)\s+([\d.]+)\s*s?/i);
  if (kfM) {
    const propRaw = kfM[1].toLowerCase();
    const prop = mapKeyframeProp(propRaw);
    const isPosition = prop === 'position';
    let from, to;
    if (isPosition) {
      from = { x: parseFloat(kfM[2]), y: parseFloat(kfM[3] || kfM[2]) };
      to = { x: parseFloat(kfM[4]), y: parseFloat(kfM[5] || kfM[4]) };
    } else {
      from = { value: parseFloat(kfM[2]) };
      to = { value: parseFloat(kfM[4]) };
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
    const hue = COLOR_HUES[cwM[2].toLowerCase()];
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
      state.chroma = {
        keyColor: rgb,
        similarity: 30, smoothness: 20, spill: 50, intensity: 100
      };
      return;
    }
  }

  const audioM = seg.match(/\b(?:audio|sound|awaaz|soundfx)\s+([a-z][a-z\s]*)/i);
  if (audioM) {
    audioM[1].trim().split(/\s+/).forEach(w => {
      if (AUDIO_FX_KEYS.includes(w)) state.audioFx.push(w);
    });
    if (state.audioFx.length > 0) return;
  }
  if (seg.split(/\s+/).length === 1 && AUDIO_FX_KEYS.includes(seg)) {
    state.audioFx.push(seg);
    return;
  }

  let textMatch = seg.match(/text\s+["']([\s\S]*?)["'](.*)$/i);
  if (!textMatch) textMatch = seg.match(/["']([\s\S]*?)["'](.*)$/);
  if (textMatch && /text|likho|write/i.test(seg)) {
    const content = textMatch[1];
    const rest = (textMatch[2] || '').trim();
    const textObj = { content };
    const sizeM = rest.match(/size\s+(\d+)/i);
    if (sizeM) textObj.fontSize = parseInt(sizeM[1], 10);
    const colorM = rest.match(/color\s+([#\w]+)/i);
    if (colorM) textObj.color = colorM[1];
    if (/\btop\b|upar/i.test(rest)) textObj.positionY = 20;
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

  const transM = seg.match(/^(fade\s*black|fade\s*white|fade|dissolve|slide\s*left|slide\s*right|slide\s*up|slide\s*down|zoom\s*in|zoom\s*out|wipe\s*left|wipe\s*right|circle\s*in)\s*(?:in|out|transition)?\s*([\d.]+)?$/i);
  if (transM) {
    const raw = transM[1].toLowerCase().replace(/\s+/g, '');
    const typeMap = {
      fade: 'fade', fadeblack: 'fadeBlack', fadewhite: 'fadeWhite',
      dissolve: 'dissolve', slideleft: 'slideLeft', slideright: 'slideRight',
      slideup: 'slideUp', slidedown: 'slideDown', zoomin: 'zoomIn',
      zoomout: 'zoomOut', wipeleft: 'wipeLeft', wiperight: 'wipeRight',
      circlein: 'circleIn'
    };
    state.transition = {
      type: typeMap[raw] || 'fade',
      duration: clamp(transM[2] ? parseFloat(transM[2]) : 0.5, 0.1, 3)
    };
    return;
  }

  if (/^(trim\s*left|left\s*trim)$/i.test(seg)) { state.trimOps.push('left'); return; }
  if (/^(trim\s*right|right\s*trim)$/i.test(seg)) { state.trimOps.push('right'); return; }
  if (/^(split|cut|split\s*clip)$/i.test(seg)) { state.trimOps.push('split'); return; }

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

  if (!state.textProps) state.textProps = {};
  let matched = false;
  let m2;

  m2 = seg.match(/^align(?:ment)?\s+(left|center|right)$/i);
  if (m2) { state.textProps.alignment = m2[1].toLowerCase(); matched = true; }

  if (!matched) {
    m2 = seg.match(/^anchor\s+(top-left|top-center|top-right|center-left|center-right|bottom-left|bottom-center|bottom-right|top|bottom|center|middle|left|right)$/i);
    if (m2) {
      const a = m2[1].toLowerCase();
      if (a === 'top-left') { state.textProps.anchorX = 0; state.textProps.anchorY = 0; }
      else if (a === 'top-center' || a === 'top') { state.textProps.anchorX = 50; state.textProps.anchorY = 0; }
      else if (a === 'top-right') { state.textProps.anchorX = 100; state.textProps.anchorY = 0; }
      else if (a === 'center-left' || a === 'left') { state.textProps.anchorX = 0; state.textProps.anchorY = 50; }
      else if (a === 'center' || a === 'middle') { state.textProps.anchorX = 50; state.textProps.anchorY = 50; }
      else if (a === 'center-right' || a === 'right') { state.textProps.anchorX = 100; state.textProps.anchorY = 50; }
      else if (a === 'bottom-left') { state.textProps.anchorX = 0; state.textProps.anchorY = 100; }
      else if (a === 'bottom-center' || a === 'bottom') { state.textProps.anchorX = 50; state.textProps.anchorY = 100; }
      else if (a === 'bottom-right') { state.textProps.anchorX = 100; state.textProps.anchorY = 100; }
      matched = true;
    }
  }

  if (!matched) {
    m2 = seg.match(/^position\s*x\s+(-?\d+(?:\.\d+)?)$/i);
    if (m2) { state.textProps.positionX = parseFloat(m2[1]); matched = true; }
  }
  if (!matched) {
    m2 = seg.match(/^position\s*y\s+(-?\d+(?:\.\d+)?)$/i);
    if (m2) { state.textProps.positionY = parseFloat(m2[1]); matched = true; }
  }
  if (!matched) {
    m2 = seg.match(/^position\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/i);
    if (m2) {
      state.textProps.positionX = parseFloat(m2[1]);
      state.textProps.positionY = parseFloat(m2[2]);
      matched = true;
    }
  }
  if (!matched) {
    m2 = seg.match(/^position\s+(top|bottom|center|middle|left|right)$/i);
    if (m2) {
      const p = m2[1].toLowerCase();
      if (p === 'top') state.textProps.positionY = 20;
      else if (p === 'bottom') state.textProps.positionY = 80;
      else if (p === 'center' || p === 'middle') { state.textProps.positionX = 50; state.textProps.positionY = 50; }
      else if (p === 'left') state.textProps.positionX = 20;
      else if (p === 'right') state.textProps.positionX = 80;
      matched = true;
    }
  }
  if (!matched) {
    m2 = seg.match(/^font\s+([a-z][a-z0-9 _-]+)$/i);
    if (m2) {
      const requested = m2[1].trim();
      const resolved = resolveFontFamily(requested);
      state.textProps.fontFamily = resolved;
      loadGoogleFont(resolved);
      matched = true;
    }
  }
  if (!matched) {
    m2 = seg.match(/^(?:font\s*)?size\s+(\d+)$/i);
    if (m2) { state.textProps.fontSize = parseInt(m2[1], 10); matched = true; }
  }
  if (!matched) {
    m2 = seg.match(/^colou?r\s+(#[0-9a-fA-F]{3,8})$/i);
    if (m2) { state.textProps.color = m2[1]; matched = true; }
  }
  if (!matched) {
    m2 = seg.match(/^colou?r\s+([a-z]+)$/i);
    if (m2) { state.textProps.color = colorNameToHex(m2[1]); matched = true; }
  }
  if (!matched && /^shadow$/i.test(seg)) {
    state.textProps.shadowEnabled = true; matched = true;
  }
  if (!matched && /^bold$/i.test(seg)) {
    state.textProps.fontWeight = 'bold'; matched = true;
  }
  if (!matched && /^italic$/i.test(seg)) {
    state.textProps.fontStyle = 'italic'; matched = true;
  }

  if (matched) return;

  if (Object.keys(state.textProps).length === 0) state.textProps = null;
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
export async function executePrompt(state) {
  if (!state) return { ok: false, error: 'No state' };
  

  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  if (state.ratio) applyRatio(state.ratio);

  if (state.autoGraph === true)  _autoOpenGraph = true;
  if (state.autoGraph === false) _autoOpenGraph = false;

  // ═══ 🆕 BEATS — terminal (short-circuit) ═══════════════════
  if (state.detectBeats) {
    const filterStr = (state.detectBeats && state.detectBeats.filter) || '';
    const r = await runDetectBeats(filterStr);
    if (!r.ok) return { ok: false, error: r.error };

    let toastMsg = '🥁 ' + r.beatsCount + ' beats detected';
    if (r.totalDetected && r.totalDetected !== r.beatsCount) {
      toastMsg += '  (from ' + r.totalDetected + ')';
    }
    _showToast(toastMsg);

    return {
      ok: true,
      results: ['detectBeats:' + r.beatsCount],
      beatsReport: r.report || ''
    };
  }

  if (state.beatsEdit) {
    // 🆕 Pass raw string (new syntax) OR pattern array (old)
    const input = state.beatsEdit.raw || state.beatsEdit.pattern;
    const r = await runBeatsEditing(input);
    if (!r.ok) return { ok: false, error: r.error };
    _showToast('🥁 ' + r.effectsApplied + ' effects on ' + r.beatsCount + ' beats');
    return {
      ok: true,
      results: ['beatsEdit:' + r.effectsApplied + ' on ' + r.beatsCount + ' beats']
    };
  }

  // ═══ Regular commands ═════════════════════════════════════
  const results = [];
  const warnings = [];
  _lastCreatedClips = [];

  if (state.tightenTracks) {
    let closedCount = 0;
    const allTracks = [].concat(
      appState.timeline.visual || [],
      appState.timeline.audio || []
    );
    for (let t = 0; t < allTracks.length; t++) {
      const track = allTracks[t];
      if (!Array.isArray(track) || track.length < 2) continue;
      track.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      let cursor = 0;
      for (let i = 0; i < track.length; i++) {
        const clip = track[i];
        const dur = Number.isFinite(clip.duration) ? clip.duration : 3;
        if (Math.abs((clip.startTime || 0) - cursor) > 0.01) {
          clip.startTime = cursor;
          clip.__trimmed = true;
          closedCount++;
        }
        cursor += dur;
      }
    }
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    _showToast('🧲 ' + closedCount + ' gaps closed');
    results.push('tighten ' + closedCount);
  }

  if (state.layerTransitions) {
    const lt = state.layerTransitions;
    let targetLayerKey = lt.layerKey;

    if (!targetLayerKey) {
      const sel = document.querySelector('.clip.selected');
      if (sel && sel.dataset.track) targetLayerKey = sel.dataset.track.toUpperCase();
    }

    if (!targetLayerKey) {
      warnings.push('Layer transitions: no layer specified and no clip selected');
    } else {
      const layerGroup = targetLayerKey.charAt(0) === 'A' ? 'audio' : 'visual';
      const layerIdx = parseInt(targetLayerKey.slice(1), 10) - 1;
      const tracks = appState.timeline[layerGroup] || [];
      const track = tracks[layerIdx];

      if (!Array.isArray(track) || track.length === 0) {
        warnings.push('Layer ' + targetLayerKey + ' is empty');
      } else {
        const sortedClips = track.slice().sort((a, b) =>
          (a.startTime || 0) - (b.startTime || 0)
        );
        let applied = 0, skipped = 0, idx = 0;

        for (let i = 1; i < sortedClips.length; i++) {
          const clip = sortedClips[i];
          const curStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
          if (curStart <= 0.01) { skipped++; continue; }

          let patItem = null;
          if (idx < lt.list.length) { patItem = lt.list[idx]; idx++; }
          else if (lt.loop) { patItem = lt.list[idx % lt.list.length]; idx++; }
          else { skipped++; continue; }

          const prev = sortedClips[i - 1];
          const prevStart = Number.isFinite(prev.startTime) ? prev.startTime : 0;
          const prevEnd = prevStart + (Number.isFinite(prev.duration) ? prev.duration : 0);
          if (prevStart >= curStart - 0.01) { skipped++; continue; }
          if (Math.abs(prevEnd - curStart) > 0.5) { skipped++; continue; }

          if (!patItem || patItem.type === null) {
            delete clip.__transitionIn;
            skipped++;
            continue;
          }

          clip.__transitionIn = {
            key: patItem.type,
            duration: patItem.duration != null ? patItem.duration : 0.5
          };
          applied++;
        }

        document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
        document.dispatchEvent(new CustomEvent('transition:changed'));

        let msg = '⇄ ' + targetLayerKey + ': ' + applied + ' applied';
        if (skipped > 0) msg += ' (' + skipped + ' skipped)';
        _showToast(msg);
        results.push('layerTransitions:' + applied);
      }
    }
  }

  if (state.transitionAll) {
    const key = state.transitionAll.type;
    const dur = state.transitionAll.duration;
    let applied = 0, skipped = 0;
    const tracks = appState.timeline.visual || [];
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      if (!Array.isArray(track) || track.length < 2) continue;
      const sorted = track.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      for (let i = 1; i < sorted.length; i++) {
        const clip = sorted[i];
        const clipStart = clip.startTime || 0;
        if (clipStart <= 0.01) { skipped++; continue; }
        const prev = sorted[i - 1];
        const prevEnd = (prev.startTime || 0) + (prev.duration || 0);
        if (Math.abs(prevEnd - clipStart) <= 0.5) {
          clip.__transitionIn = { key: key, duration: dur };
          applied++;
        } else skipped++;
      }
    }
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transition:changed'));
    let msg = '⇄ ' + applied + ' transitions';
    if (skipped > 0) msg += ' (' + skipped + ' skipped)';
    _showToast(msg);
    results.push('transitions:' + applied);
  }

  if (state.atTransitions && state.atTransitions.length > 0) {
    let applied = 0, missed = 0;
    const tracks = appState.timeline.visual || [];
    for (let k = 0; k < state.atTransitions.length; k++) {
      const at = state.atTransitions[k];
      let hit = false;
      for (let t = 0; t < tracks.length; t++) {
        const track = tracks[t];
        if (!Array.isArray(track)) continue;
        for (let i = 0; i < track.length; i++) {
          const clip = track[i];
          const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
          if (Math.abs(s - at.time) > 0.2) continue;
          if (s <= 0.01) continue;
          let hasPrev = false;
          for (let j = 0; j < track.length; j++) {
            if (j === i) continue;
            const o = track[j];
            const oStart = Number.isFinite(o.startTime) ? o.startTime : 0;
            if (oStart >= s - 0.01) continue;
            const oEnd = oStart + (Number.isFinite(o.duration) ? o.duration : 0);
            if (Math.abs(oEnd - s) <= 0.5) { hasPrev = true; break; }
          }
          if (hasPrev) { clip.__transitionIn = { key: at.type, duration: at.duration }; applied++; hit = true; }
          break;
        }
        if (hit) break;
      }
      if (!hit) missed++;
    }
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transition:changed'));
    let msg = '⇄ ' + applied + ' transition' + (applied === 1 ? '' : 's') + ' applied';
    if (missed > 0) msg += ' (' + missed + ' time not found)';
    _showToast(msg);
    results.push('transitionsAt:' + applied);
  }

  if (state.clearKeyframes) {
    const clip = getSelectedClip(appState);
    if (clip) {
      clearAllKeyframes(clip);
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('keyframe:changed'));
      document.dispatchEvent(new CustomEvent('transform:changed'));
      _showToast('🗑 Keyframes cleared');
      return { ok: true, results: ['clearKeyframes'] };
    }
    return { ok: false, error: 'Koi clip select nahi' };
  }

  if (state.openGraph) {
    const clip = getSelectedClip(appState);
    if (clip) {
      setTimeout(() => openKeyframeGraph(), 100);
      return { ok: true, results: ['openGraph'] };
    }
    return { ok: false, error: 'Koi clip select nahi' };
  }

  if (state.timestampedLayers) {
    return executeTimestampedLayers(state.timestampedLayers);
  }

  const hasClips = hasAnyClips(appState);

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
  if (!targetClip && _lastCreatedClips.length > 0) targetClip = _lastCreatedClips[_lastCreatedClips.length - 1];

  if (!targetClip && state.textProps) {
    const vTracks = appState.timeline.visual || [];
    let lastText = null;
    for (let t = 0; t < vTracks.length; t++) {
      const track = vTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const clip = track[c];
        if (clip && clip.__textId && clip.textState) lastText = clip;
      }
    }
    if (lastText) targetClip = lastText;
  }

  if (state.textProps && targetClip && targetClip.__textId && targetClip.textState) {
    const tp = state.textProps;
    const ts = targetClip.textState;
    if (tp.alignment != null) ts.alignment = tp.alignment;
    if (tp.fontFamily != null) ts.fontFamily = tp.fontFamily;
    if (tp.fontSize != null) ts.fontSize = tp.fontSize;
    if (tp.fontWeight != null) ts.fontWeight = tp.fontWeight;
    if (tp.fontStyle != null) ts.fontStyle = tp.fontStyle;
    if (tp.color != null) ts.color = tp.color;
    if (tp.shadowEnabled != null) ts.shadowEnabled = tp.shadowEnabled;
    if (tp.positionX != null) ts.positionX = tp.positionX;
    if (tp.positionY != null) ts.positionY = tp.positionY;
    if (tp.anchorX != null) ts.anchorX = tp.anchorX;
    if (tp.anchorY != null) ts.anchorY = tp.anchorY;
    results.push('text-props');
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transform:changed'));
  } else if (state.textProps) {
    warnings.push('Text properties need a text clip');
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

    // 🆕 Auto-keyframe if clip already has keyframes
    const ks = window.__keyframeStore;
    if (ks && typeof ks.autoKeyframeIfActive === 'function' && ks.hasAnyKeyframes(targetClip)) {
      const eng = window.__playbackEngine;
      const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
      tfKeys.forEach(function (prop) {
        ks.autoKeyframeIfActive(targetClip, prop, t, state.transforms[prop]);
      });
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
    if (_autoOpenGraph) setTimeout(() => openKeyframeGraph(), 150);
  }

  if (state.speed != null && targetClip) {
    applySpeedToClip(targetClip, state.speed);
    results.push('speed:' + state.speed + 'x');
  }

  if (state.transition && targetClip) {
    targetClip.__transitionIn = { key: state.transition.type, duration: state.transition.duration };
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
      try {
        // 🆕 Use the correct preset builder (includes motion for shake/pulse/zoom)
        const fxState = buildEffectStateForKey(state.effectPreset);
        const id = createEffectLayer('effect', fxState, capitalize(state.effectPreset));
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
    // 🆕 Attach chroma to SELECTED clip only — no separate effect layer
    const selClip = getSelectedClip(appState);
    if (selClip) {
      if (!selClip.__grading) selClip.__grading = {};
      selClip.__grading.chroma = state.chroma;

      results.push('chroma on "' + (selClip.name || 'clip').slice(0, 20) + '"');

      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('effects:refresh'));
    } else {
      warnings.push('chroma: select a clip first');
    }
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

function _showToast(msg) {
  if (!msg) return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:99999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0','transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 1400);
}