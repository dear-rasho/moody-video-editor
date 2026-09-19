// ================================================================
//  js/codebase/timelineLayers.js
//  Multi-layer timestamped prompt support.
//  [MM:SS - MM:SS] blocks → text layers with exact duration.
//  Non-timestamped commands → fallback to first layer's duration.
// ================================================================

import { placeClipAtTime } from '../layers/layersManager.js';

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════
export function hasTimestampedLayers(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') return false;
  return /\[\s*\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]/.test(rawPrompt);
}
export function parsePrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { ok: false, error: 'Empty prompt' };
  }

  _resetUnknown();
  const ratio = detectRatio(rawPrompt);

  if (hasTimestampedLayers(rawPrompt)) {

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
  let trailingCommands = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isLast = (i === blocks.length - 1);
    const parsed = parseBlock(block, isLast);
    if (parsed) layers.push(parsed);
    if (parsed && parsed.trailingCommands) {
      trailingCommands.push.apply(trailingCommands, parsed.trailingCommands);
    }
  }

  return { layers, trailingCommands };
}

// ═══════════════════════════════════════════════════════════════
//  EXECUTE
// ═══════════════════════════════════════════════════════════════
export function executeTimestampedLayers(parsed) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  const results = [];
  const warnings = [];

  const layers = parsed.layers || [];

  // First layer's duration = fallback for effects
  let firstLayerDuration = 0;
  for (let i = 0; i < layers.length; i++) {
    const d = layers[i].end - layers[i].start;
    if (d > 0) { firstLayerDuration = d; break; }
  }

  // ─── Create each text layer ───────────────────────────────
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const duration = layer.end - layer.start;
    if (duration <= 0) continue;

    const clipData = buildTextClip(layer, duration);
    if (!clipData) continue;

    placeClipAtTime(appState.timeline.visual, clipData, layer.start);
    // Force exact startTime & duration (placeClipAtTime may adjust)
    clipData.startTime = layer.start;
    clipData.duration = duration;

    results.push('text@' + fmtSec(layer.start) + ' (' + fmtSec(duration) + 's)');
  }

  // ─── Handle trailing non-timestamped commands ────────────
  if (parsed.trailingCommands && parsed.trailingCommands.length > 0) {
    const fallbackDur = firstLayerDuration > 0 ? firstLayerDuration : 3;

    for (let i = 0; i < parsed.trailingCommands.length; i++) {
      const cmd = parsed.trailingCommands[i];
      try {
        const r = executeTrailingCommand(cmd, fallbackDur);
        if (r) results.push(r);
      } catch (e) {
        warnings.push(cmd + ': ' + (e.message || 'failed'));
      }
    }
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));

  return {
    ok: results.length > 0,
    results,
    warnings,
    error: results.length === 0 ? (warnings[0] || 'No layers created') : undefined
  };
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function parseTimeStr(str) {
  const parts = str.split(':').map(function (n) { return parseInt(n, 10) || 0; });
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

function truncate(str, n) {
  if (!str) return '';
  str = String(str);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// ═══════════════════════════════════════════════════════════════
//  PARSE BLOCK
// ═══════════════════════════════════════════════════════════════
function parseBlock(block, isLast) {
  let content = block.content || '';
  if (!content) return null;

  // Split lines
  const lines = content.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (lines.length === 0) return null;

  // The FIRST line contains: "text" + properties
  const firstLine = lines[0];

  // Extract quoted text
  let text = '';
  let propStr = '';

  const qm = firstLine.match(/^["']([^"']+)["']\s*(.*)$/);
  if (qm) {
    text = qm[1];
    propStr = qm[2] || '';
  } else {
    // No quotes — whole line is text, no properties
    text = firstLine;
    propStr = '';
  }

  // Additional lines after first = more properties
  for (let i = 1; i < lines.length; i++) {
    propStr += (propStr ? ', ' : '') + lines[i];
  }

  // Detect trailing commands (last block only): non-property commands
  // Like "brightness 110" or "saturation 130"
  let trailingCommands = [];
  if (isLast) {
    const split = splitPropsAndCommands(propStr);
    propStr = split.props;
    trailingCommands = split.commands;
  }

  const props = parseLayerProps(propStr);

  // Text content: convert "|" and literal "\n" to actual newlines
  let finalText = text.replace(/\|\s*/g, '\n').replace(/\\n/g, '\n');

  // If lines specified but fewer lines in text, we keep as-is
  return {
    start: block.start,
    end: block.end,
    text: finalText,
    props: props,
    trailingCommands: trailingCommands,
    type: 'text'
  };
}

// ═══════════════════════════════════════════════════════════════
//  SPLIT PROPS vs TRAILING COMMANDS
//
//  "animation typewriter, position center, brightness 110"
//   →  props: "animation typewriter, position center"
//   →  commands: ["brightness 110"]
// ═══════════════════════════════════════════════════════════════
const PROP_KEYWORDS = [
  'animation', 'position', 'color', 'colour', 'gradient', 'ramp',
  'shadow', 'font', 'fontsize', 'font-size', 'size', 'lines', 'line',
  'align', 'alignment', 'scale', 'rotation', 'opacity', 'start', 'duration'
];

function splitPropsAndCommands(propStr) {
  if (!propStr) return { props: '', commands: [] };

  const parts = propStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const props = [];
  const commands = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const firstWord = (part.split(/\s+/)[0] || '').toLowerCase();

    if (PROP_KEYWORDS.indexOf(firstWord) >= 0) {
      props.push(part);
    } else {
      commands.push(part);
    }
  }

  return { props: props.join(', '), commands: commands };
}

// ═══════════════════════════════════════════════════════════════
//  PARSE LAYER PROPERTIES
// ═══════════════════════════════════════════════════════════════
function parseLayerProps(str) {
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
    alignment: 'center',
    scale: 100,
    rotation: 0,
    opacity: 100,
    linesData: null
  };

  if (!str) return props;

  const parts = str.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const linesData = {};

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let m;

    // animation typewriter
    m = part.match(/^animation\s+(\w+)/i);
    if (m) { props.animation = m[1].toLowerCase(); continue; }

    // position top|bottom|center|middle
    m = part.match(/^position\s+(top|bottom|center|middle|left|right)/i);
    if (m) {
      const p = m[1].toLowerCase();
      if (p === 'top') props.positionY = 20;
      else if (p === 'bottom') props.positionY = 80;
      else if (p === 'center' || p === 'middle') props.positionY = 50;
      else if (p === 'left') props.positionX = 20;
      else if (p === 'right') props.positionX = 80;
      continue;
    }
    // position X Y
    m = part.match(/^position\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
    if (m) {
      props.positionX = parseFloat(m[1]);
      props.positionY = parseFloat(m[2]);
      continue;
    }

    // color ramp #A to #B   /   gradient #A to #B
    m = part.match(/^(?:color\s+ramp|colour\s+ramp|gradient|ramp)\s+(#[0-9a-fA-F]{3,8})\s+to\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) {
      props.gradientEnabled = true;
      props.gradientColor1 = m[1];
      props.gradientColor2 = m[2];
      continue;
    }
    // gradient #A #B (alt)
    m = part.match(/^(?:color\s+ramp|gradient|ramp)\s+(#[0-9a-fA-F]{3,8})\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) {
      props.gradientEnabled = true;
      props.gradientColor1 = m[1];
      props.gradientColor2 = m[2];
      continue;
    }

    // color #hex
    m = part.match(/^colou?r\s+(#[0-9a-fA-F]{3,8})/i);
    if (m) { props.color = m[1]; continue; }
    // color white
    m = part.match(/^colou?r\s+([a-z]+)/i);
    if (m) { props.color = colorNameToHex(m[1]); continue; }

    // shadow
    if (/^shadow/i.test(part)) { props.shadowEnabled = true; continue; }

    // font X size N
    m = part.match(/^font\s+([A-Za-z0-9 _-]+?)(?:\s+size\s+(\d+))?$/i);
    if (m && !/^size/i.test(m[1])) {
      props.fontFamily = m[1].trim();
      if (m[2]) props.fontSize = parseInt(m[2], 10);
      continue;
    }

    // font size N   /   fontSize N
    m = part.match(/^font\s*[- ]?size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    // size N
    m = part.match(/^size\s+(\d+)/i);
    if (m) { props.fontSize = parseInt(m[1], 10); continue; }

    // lines N
    m = part.match(/^(?:lines|num\s*lines)\s+(\d+)/i);
    if (m) { props.numLines = parseInt(m[1], 10); continue; }

    // lineN font X size Y
       // 🆕 Fixed: lineN font with keyword boundary
    m = part.match(/^line\s*(\d+)\s+font\s+([A-Za-z][A-Za-z0-9_-]*(?:\s+(?!(?:size|position|color|colour|animation|shadow|bold|italic|align|scale|rotation|opacity|stroke|line\d)\b)[A-Za-z][A-Za-z0-9_-]*)*)(?:\s+size\s+(\d+))?/i);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (!linesData[idx]) linesData[idx] = {};
      linesData[idx].fontFamily = m[2].trim();
      if (m[3]) linesData[idx].fontSize = parseInt(m[3], 10);
      continue;
    }

    // lineN size N
    m = part.match(/^line\s*(\d+)\s+size\s+(\d+)/i);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (!linesData[idx]) linesData[idx] = {};
      linesData[idx].fontSize = parseInt(m[2], 10);
      continue;
    }

    // align left|center|right
    m = part.match(/^align(?:ment)?\s+(left|center|right)/i);
    if (m) { props.alignment = m[1].toLowerCase(); continue; }

    // scale N
    m = part.match(/^scale\s+(\d+)/i);
    if (m) { props.scale = parseInt(m[1], 10); continue; }

    // rotation N
    m = part.match(/^rot(?:ation)?\s+(-?\d+)/i);
    if (m) { props.rotation = parseInt(m[1], 10); continue; }

    // opacity N
    m = part.match(/^opacity\s+(\d+)/i);
    if (m) { props.opacity = parseInt(m[1], 10); continue; }
  }

  if (Object.keys(linesData).length > 0) props.linesData = linesData;

  return props;
}

// ═══════════════════════════════════════════════════════════════
//  COLOR NAME → HEX
// ═══════════════════════════════════════════════════════════════
function colorNameToHex(name) {
  const map = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#00ff00',
    blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
    pink: '#ff88aa', orange: '#ff8800', purple: '#8800ff', gray: '#888888',
    grey: '#888888', lime: '#00ff00', gold: '#ffcc00', silver: '#cccccc',
    brown: '#8b4513', navy: '#000080', teal: '#008080', olive: '#808000',
    maroon: '#800000', aqua: '#00ffff'
  };
  const k = String(name || '').toLowerCase();
  return map[k] || '#ffffff';
}

// ═══════════════════════════════════════════════════════════════
//  BUILD TEXT CLIP (with per-line styles if provided)
// ═══════════════════════════════════════════════════════════════
function buildTextClip(layer, duration) {
  const id = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const text = layer.text || '';
  if (!text) return null;

  const p = layer.props || {};

  const clipData = {
    name: text.slice(0, 30),
    url: 'text://' + id,
    type: 'text/plain',
    __textId: id,
    textState: {
      content: text,
      fontFamily: p.fontFamily || 'Arial',
      fontSize: p.fontSize || 36,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: p.color || '#ffffff',
      strokeWidth: 0,
      strokeColor: '#000000',
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
    startTime: layer.start,
    duration: duration
  };

  // Per-line styles (renderer support required)
  if (p.linesData && Object.keys(p.linesData).length > 0) {
    clipData.textState.__lines = p.linesData;
    clipData.textState.__multiLine = true;
  }

  return clipData;
}

// ═══════════════════════════════════════════════════════════════
//  TRAILING COMMAND EXECUTOR
//  Fallback duration = first layer's duration
// ═══════════════════════════════════════════════════════════════
function executeTrailingCommand(cmd, fallbackDuration) {
  const appState = window.__appState;
  if (!appState) return null;

  const low = cmd.toLowerCase().trim();

  // brightness 110, saturation 130, etc.
  const adjM = low.match(/^([a-z]+)\s+(-?\d+(?:\.\d+)?)/);
  if (!adjM) return null;

  const key = adjM[1];
  const val = parseFloat(adjM[2]);

  const ADJUSTMENT_KEYS = [
    'brightness', 'contrast', 'exposure', 'whites', 'blacks',
    'shadows', 'highlights', 'clarity', 'saturation', 'vibrance',
    'temperature', 'tint', 'noise', 'sharpen', 'vignette',
    'reds', 'oranges', 'yellows', 'greens', 'cyans',
    'blues', 'purples', 'magentas', 'skintones'
  ];

  if (ADJUSTMENT_KEYS.indexOf(key) >= 0) {
    createEffectWithDuration('adjustment',
      { adjustments: { [key]: val } },
      'Adj: ' + key, 0, fallbackDuration);
    return 'adjustment:' + key + '=' + val + ' (' + fallbackDuration + 's)';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  CREATE EFFECT WITH CUSTOM DURATION
//  (Bypasses effectLayer.js full-timeline default)
// ═══════════════════════════════════════════════════════════════
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
  clipData.startTime = startTime || 0;
  clipData.duration = duration > 0 ? duration : 3;

  return id;
}