// ================================================================
//  js/workspace/audioFxEngine.js
//  Real-time audio routing via Web Audio.
//  Elements are attached ONCE and their chains swap dynamically.
// ================================================================

let audioCtx = null;
const graphs = new Map();     // el → { source, lastOutput, effectKey }
const builders = new Map();   // key → buildFn(ctx, src) → tailNode

export function registerAudioFxBuilder(key, buildFn) {
  if (key && typeof buildFn === 'function') builders.set(key, buildFn);
}

export function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { audioCtx = new AC(); }
  catch (e) { console.warn('AudioContext failed:', e); return null; }
  return audioCtx;
}

export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function attachElement(el) {
  if (!el) return null;
  if (graphs.has(el)) return graphs.get(el);

  const ctx = ensureAudioContext();
  if (!ctx) return null;

  let source;
  try {
    source = ctx.createMediaElementSource(el);
  } catch (e) {
    console.warn('MediaElementSource failed:', e);
    return null;
  }

  source.connect(ctx.destination);

  const entry = { source, lastOutput: source, effectKey: null };
  graphs.set(el, entry);
  return entry;
}

export function setElementEffect(el, effectKey) {
  if (!el) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const entry = attachElement(el);
  if (!entry) return;
  if (entry.effectKey === effectKey) return;

  try { entry.source.disconnect(); } catch (_) {}
  if (entry.lastOutput && entry.lastOutput !== entry.source) {
    try { entry.lastOutput.disconnect(); } catch (_) {}
  }

  if (!effectKey) {
    entry.source.connect(ctx.destination);
    entry.lastOutput = entry.source;
    entry.effectKey = null;
    return;
  }

  const build = builders.get(effectKey);
  if (!build) {
    entry.source.connect(ctx.destination);
    entry.lastOutput = entry.source;
    entry.effectKey = null;
    return;
  }

  let tail;
  try { tail = build(ctx, entry.source); }
  catch (e) { console.warn('FX build failed:', e); tail = null; }

  if (!tail) {
    entry.source.connect(ctx.destination);
    entry.lastOutput = entry.source;
    entry.effectKey = null;
    return;
  }

  tail.connect(ctx.destination);
  entry.lastOutput = tail;
  entry.effectKey = effectKey;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CHAINED EFFECTS — apply MULTIPLE effects in series
//  keys = ['monster', 'reverb']  →  source → monster → reverb → dest
// ═══════════════════════════════════════════════════════════════
export function setElementEffects(el, effectKeys) {
  if (!el) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const entry = attachElement(el);
  if (!entry) return;

  const keys = Array.isArray(effectKeys)
    ? effectKeys.map(k => String(k || '').trim()).filter(Boolean)
    : (effectKeys ? [String(effectKeys)] : []);

  const keyStr = keys.join('+');
  if (entry.effectKey === keyStr) return;

  try { entry.source.disconnect(); } catch (_) {}
  if (entry.lastOutput && entry.lastOutput !== entry.source) {
    try { entry.lastOutput.disconnect(); } catch (_) {}
  }

  if (!keys.length) {
    entry.source.connect(ctx.destination);
    entry.lastOutput = entry.source;
    entry.effectKey = '';
    return;
  }

  let tail = entry.source;
  for (const key of keys) {
    const build = builders.get(key);
    if (!build) continue;
    try {
      const next = build(ctx, tail);
      if (next) tail = next;
    } catch (e) {
      console.warn('FX build failed for', key, e);
    }
  }

  tail.connect(ctx.destination);
  entry.lastOutput = tail;
  entry.effectKey = keyStr;
}

export function setGlobalEffect(effectKeyOrList) {
  const video = document.querySelector('#preview-video');
  const audio = document.querySelector('#preview-audio');
  const isList = Array.isArray(effectKeyOrList);
  if (video) {
    if (isList) setElementEffects(video, effectKeyOrList);
    else setElementEffect(video, effectKeyOrList);
  }
  if (audio) {
    if (isList) setElementEffects(audio, effectKeyOrList);
    else setElementEffect(audio, effectKeyOrList);
  }
}

export function warmUp() {
  const video = document.querySelector('#preview-video');
  const audio = document.querySelector('#preview-audio');
  if (video) attachElement(video);
  if (audio) attachElement(audio);
}

// Auto-resume on user gesture
if (typeof document !== 'undefined') {
  const kick = () => { ensureAudioContext(); resumeAudioContext(); };
  document.addEventListener('click', kick);
  document.addEventListener('touchstart', kick);
}