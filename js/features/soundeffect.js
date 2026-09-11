// ================================================================
//  js/features/soundeffect.js
//  Sound panel (replaces "volume").
//  Sections top→bottom: Volume, Sound Effects, Voice Templates, Footer.
//  Left/right scroll = full-width shelves.
//  Audio graph routes BOTH preview-video and preview-audio.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';

export const featureKey = 'soundeffect';

const EFFECT_ORDER = [
  'bass', 'equalizer', 'deesser', 'vocalEnhancement', 'pitch',
  'noiseReduction', 'distortion', 'compression', 'echo', 'reverb'
];

const EFFECT_DEFS = [
  { key: 'reverb',           label: 'Reverb',      icon: '🏛️' },
  { key: 'echo',             label: 'Echo',        icon: '🔊' },
  { key: 'noiseReduction',   label: 'Noise Red.',  icon: '🔇' },
  { key: 'pitch',            label: 'Pitch',       icon: '🎼' },
  { key: 'compression',      label: 'Compress',    icon: '📊' },
  { key: 'deesser',          label: 'De-esser',    icon: '🔆' },
  { key: 'distortion',       label: 'Distortion',  icon: '⚡' },
  { key: 'vocalEnhancement', label: 'Vocal',       icon: '🎤' },
  { key: 'equalizer',        label: 'Equalizer',   icon: '🎚️' },
  { key: 'bass',             label: 'Bass',        icon: '🔉' }
];

const TEMPLATE_DEFS = [
  { key: 'none',      label: 'None',      icon: '🚫' },
  { key: 'telephone', label: 'Telephone', icon: '☎️' },
  { key: 'infant',    label: 'Infant',    icon: '👶' },
  { key: 'girl',      label: 'Girl',      icon: '👧' },
  { key: 'women',     label: 'Women',     icon: '👩' },
  { key: 'men',       label: 'Men',       icon: '👨' },
  { key: 'boy',       label: 'Boy',       icon: '👦' },
  { key: 'child',     label: 'Child',     icon: '🧒' },
  { key: 'radio',     label: 'Radio',     icon: '📻' },
  { key: 'monster',   label: 'Monster',   icon: '👹' },
  { key: 'cave',      label: 'Cave',      icon: '🕳️' }
];

const st = {
  volume: 100,
  effects: {
    reverb: 0, echo: 0, noiseReduction: 0, pitch: 0,
    compression: 0, deesser: 0, distortion: 0,
    vocalEnhancement: 0, equalizer: 0, bass: 0
  },
  template: 'none',
  templateIntensity: 50
};

// ─── Audio graph ──────────────────────────────────────────────
let audioCtx = null;
let chainInput = null;
let masterGain = null;
let videoSource = null;
let audioSource = null;
let activeEffectNodes = [];
let selectionPollId = null;
let lastSelectedKey = '';
let graphListenersAttached = false;

// ═══════════════════════════════════════════════════════════════
//  Router install
// ═══════════════════════════════════════════════════════════════
(function installRenderer() {
  if (featuresRouter.__soundFxInstalled) return;
  featuresRouter.__soundFxInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'soundFxPanel') {
      this.title.textContent = view.title;
      this.backButton.hidden = view.level === 0;
      this.shelf.classList.remove('circle-shelf');
      this.shelf.style.cssText = '';
      this.shelf.replaceChildren();
      renderTo(this.shelf);
      return;
    }
    return _origRender(view);
  };
})();

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'soundfx-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    /* ─── Panel: escapes the shelf-box padding so shelves go edge-to-edge ─── */
    .sfx-panel{
      display:flex;flex-direction:column;gap:10px;
      width:calc(100% + 20px);
      margin:0 -10px;
      max-width:calc(100vw);
      min-width:0;
      padding:0;
      box-sizing:border-box;
    }
    .sfx-panel *{box-sizing:border-box;}

    /* ─── Section: no side padding, so children can go edge-to-edge ─── */
    .sfx-section{
      display:flex;flex-direction:column;gap:8px;
      width:100%;min-width:0;flex:0 0 auto;
      padding:12px 0;
      background:var(--surface-2);
      border-top:1px solid var(--border);
      border-bottom:1px solid var(--border);
    }
    .sfx-section:first-child{border-top:0;}

    .sfx-section-head{
      display:flex;align-items:center;justify-content:space-between;
      gap:8px;flex-wrap:wrap;
      padding:0 14px;
    }
    .sfx-section-title{
      font-size:11px;font-weight:700;letter-spacing:.08em;
      text-transform:uppercase;color:var(--muted);
    }
    .sfx-hint{font-size:10px;color:var(--muted);letter-spacing:.04em;opacity:.7;}

    /* ─── Volume ─── */
    .sfx-vol-row{display:flex;align-items:center;gap:10px;padding:0 14px;width:100%;min-width:0;}
    .sfx-vol-slider{flex:1;accent-color:var(--accent);height:6px;cursor:pointer;min-width:0;}
    .sfx-vol-value{font-size:14px;font-weight:700;color:var(--accent);min-width:52px;text-align:right;font-variant-numeric:tabular-nums;}

    /* ─── Horizontal shelves: full width ─── */
    .sfx-shelf{
      display:flex;flex-direction:row;gap:8px;
      width:100%;min-width:0;
      overflow-x:auto;overflow-y:hidden;
      padding:2px 14px 10px;
      scroll-snap-type:x proximity;
      -webkit-overflow-scrolling:touch;
      overscroll-behavior-x:contain;
      scrollbar-width:thin;
      touch-action:pan-x;
    }
    .sfx-shelf::-webkit-scrollbar{height:5px;}
    .sfx-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}

    /* ─── Effect card ─── */
    .sfx-fx{
      flex:0 0 100px;width:100px;
      display:flex;flex-direction:column;gap:6px;
      scroll-snap-align:start;
      padding:8px 6px 6px;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:10px;
      transition:border-color .12s ease,box-shadow .12s ease;
    }
    .sfx-fx.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);}
    .sfx-fx-box{
      width:100%;aspect-ratio:1/1;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:4px;
      background:var(--surface-2);
      border:1px solid var(--border);
      border-radius:8px;
      padding:4px;
    }
    .sfx-fx.active .sfx-fx-box{background:var(--surface-3);border-color:var(--accent);}
    .sfx-fx-icon{font-size:24px;line-height:1;}
    .sfx-fx-label{font-size:9.5px;font-weight:700;color:var(--text);text-align:center;letter-spacing:.02em;line-height:1.15;}
    .sfx-fx-slider{width:100%;accent-color:var(--accent);height:4px;cursor:pointer;}
    .sfx-fx-val{font-size:9px;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums;min-height:11px;}

    /* ─── Template card ─── */
    .sfx-tpl{
      flex:0 0 86px;width:86px;
      display:flex;flex-direction:column;align-items:center;gap:6px;
      padding:10px 6px;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:10px;
      cursor:pointer;font-family:inherit;
      scroll-snap-align:start;
      transition:border-color .12s ease,box-shadow .12s ease,background .12s ease;
      color:var(--text);
      -webkit-tap-highlight-color:transparent;
    }
    .sfx-tpl:active{background:var(--surface-2);}
    .sfx-tpl.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:var(--surface-2);}
    .sfx-tpl-icon{font-size:24px;line-height:1;}
    .sfx-tpl-label{font-size:10px;font-weight:600;text-align:center;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;}
    .sfx-tpl.active .sfx-tpl-label{color:var(--text);}

    /* ─── Template intensity ─── */
    .sfx-tpl-row{display:flex;align-items:center;gap:10px;padding:6px 14px 0;}
    .sfx-tpl-row-label{font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;}
    .sfx-tpl-row-slider{flex:1;accent-color:var(--accent);height:5px;cursor:pointer;min-width:0;}
    .sfx-tpl-row-value{font-size:12px;font-weight:700;color:var(--accent);min-width:38px;text-align:right;font-variant-numeric:tabular-nums;}

        /* ─── Reset ─── */
    .sfx-reset-btn{
      width:calc(100% - 28px);
      margin:0 14px;
      padding:12px 16px;
      min-height:46px;
      background:var(--surface);
      color:var(--danger);
      border:1px solid var(--border);
      border-radius:10px;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      font-family:inherit;
      letter-spacing:0.03em;
      -webkit-tap-highlight-color:transparent;
    }
    .sfx-reset-btn:active{
      background:var(--surface-3);
      border-color:var(--danger);
    }

    /* ─── Footer ─── */
    .sfx-footer{
      padding:22px 16px;
      background:var(--surface-2);
      border-top:1px solid var(--border);
      border-bottom:1px solid var(--border);
      text-align:center;
      font-size:12px;color:var(--muted);line-height:1.55;
      flex:0 0 auto;
    }
    .sfx-footer-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;}
    .sfx-footer-sub{font-size:11px;color:var(--muted);}

    /* ─── Empty ─── */
    .sfx-empty{
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:8px;padding:24px 16px;
      background:var(--surface-2);
      border:1px dashed var(--border);
      border-radius:10px;
      text-align:center;color:var(--muted);font-size:12px;line-height:1.5;
      margin:10px;
    }
    .sfx-empty-icon{font-size:28px;opacity:.55;line-height:1;}
    .sfx-empty-title{font-size:13px;font-weight:700;color:var(--text);}
    .sfx-empty-text{font-size:11px;color:var(--muted);max-width:280px;}

    @media (max-width:380px){
      .sfx-fx{flex:0 0 88px;width:88px;}
      .sfx-fx-icon{font-size:20px;}
      .sfx-fx-label{font-size:9px;}
      .sfx-tpl{flex:0 0 74px;width:74px;}
      .sfx-tpl-icon{font-size:21px;}
      .sfx-tpl-label{font-size:9.5px;}
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  Router entry
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('soundeffect', [], {
    title: 'Sound Effects',
    level: 2,
    renderMode: 'soundFxPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  Selection helpers
// ═══════════════════════════════════════════════════════════════
function getSelectionKey() {
  const el = document.querySelector('.clip.selected');
  if (!el) return '';
  return (el.dataset.track || '') + ':' + (el.dataset.clip || '');
}

function isAudioSelected() {
  const el = document.querySelector('.clip.selected');
  if (!el) return false;
  return (el.dataset.track || '').charAt(0) === 'A';
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO GRAPH
// ═══════════════════════════════════════════════════════════════
function resumeCtx() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(function () {});
  }
}

function ensureGraph() {
  if (audioCtx && chainInput && masterGain) {
    resumeCtx();
    return true;
  }

  const videoEl = document.querySelector('#preview-video');
  const audioEl = document.querySelector('#preview-audio');
  if (!videoEl && !audioEl) return false;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { console.warn('Web Audio not supported'); return false; }

  try {
    audioCtx = new Ctx();
  } catch (e) {
    console.warn('AudioContext init failed', e);
    return false;
  }

  chainInput = audioCtx.createGain();
  masterGain = audioCtx.createGain();
  chainInput.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // Route video + audio elements through the chain (once only)
  if (videoEl && !videoSource) {
    try {
      videoSource = audioCtx.createMediaElementSource(videoEl);
      videoSource.connect(chainInput);
    } catch (e) {
      console.warn('Video source failed (likely already routed)', e);
      videoSource = null;
    }
  }
  if (audioEl && !audioSource) {
    try {
      audioSource = audioCtx.createMediaElementSource(audioEl);
      audioSource.connect(chainInput);
    } catch (e) {
      console.warn('Audio source failed (likely already routed)', e);
      audioSource = null;
    }
  }

  attachGraphListeners(videoEl, audioEl);
  resumeCtx();
  return true;
}

function attachGraphListeners(videoEl, audioEl) {
  if (graphListenersAttached) return;
  graphListenersAttached = true;

  // Resume on any user interaction
  document.addEventListener('pointerdown', resumeCtx, { passive: true });
  document.addEventListener('keydown', resumeCtx);

  // Resume on play
  [videoEl, audioEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener('play', resumeCtx);
    el.addEventListener('playing', resumeCtx);
  });
}

function teardownActiveNodes() {
  for (let i = 0; i < activeEffectNodes.length; i++) {
    try { activeEffectNodes[i].disconnect(); } catch (_) {}
  }
  activeEffectNodes = [];
}

function rebuildChain() {
  if (!ensureGraph()) return;
  resumeCtx();

  // Rewire from chainInput forward
  try { chainInput.disconnect(); } catch (_) {}
  teardownActiveNodes();

  let node = chainInput;

  for (let i = 0; i < EFFECT_ORDER.length; i++) {
    const key = EFFECT_ORDER[i];
    const intensity = st.effects[key] || 0;
    if (intensity <= 0) continue;
    const fx = buildEffect(key, intensity);
    if (!fx) continue;
    try {
      node.connect(fx.input);
      node = fx.output;
      if (fx.input !== fx.output) activeEffectNodes.push(fx.input);
      activeEffectNodes.push(fx.output);
    } catch (e) { console.warn('Effect connect failed', key, e); }
  }

  if (st.template && st.template !== 'none') {
    const tpl = buildTemplate(st.template, st.templateIntensity);
    if (tpl) {
      try {
        node.connect(tpl.input);
        node = tpl.output;
        if (tpl.input !== tpl.output) activeEffectNodes.push(tpl.input);
        activeEffectNodes.push(tpl.output);
      } catch (e) { console.warn('Template connect failed', e); }
    }
  }

  masterGain.gain.value = Math.max(0, Math.min(200, st.volume)) / 100;

  try { node.connect(masterGain); } catch (_) {}
}

// ─── Helpers ───────────────────────────────────────────────────
function makeDistortionCurve(amount) {
  const n = 44100;
  const curve = new Float32Array(n);
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) /
               (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeImpulse(ctx, seconds) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const chan = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      chan[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return impulse;
}

// ─── Effects ───────────────────────────────────────────────────
function buildEffect(key, intensity) {
  if (!audioCtx) return null;
  const t = Math.max(0, Math.min(1, intensity / 100));
  const ctx = audioCtx;

  switch (key) {
    case 'bass': {
      const f = ctx.createBiquadFilter();
      f.type = 'lowshelf'; f.frequency.value = 150; f.gain.value = t * 14;
      return { input: f, output: f };
    }
    case 'equalizer': {
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf'; low.frequency.value = 200; low.gain.value = t * 6;
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = t * 6;
      const high = ctx.createBiquadFilter();
      high.type = 'highshelf'; high.frequency.value = 4000; high.gain.value = t * 6;
      low.connect(mid); mid.connect(high);
      return { input: low, output: high };
    }
    case 'deesser': {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking'; f.frequency.value = 7000; f.Q.value = 2.5;
      f.gain.value = -t * 18;
      return { input: f, output: f };
    }
    case 'vocalEnhancement': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 120;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 3000; pk.Q.value = 1.2; pk.gain.value = t * 8;
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf'; hs.frequency.value = 6500; hs.gain.value = t * 5;
      hp.connect(pk); pk.connect(hs);
      return { input: hp, output: hs };
    }
    case 'pitch': {
      const shift = (t - 0.5) * 2;
      const pk1 = ctx.createBiquadFilter();
      pk1.type = 'peaking'; pk1.frequency.value = 900; pk1.Q.value = 1; pk1.gain.value = shift * 12;
      const pk2 = ctx.createBiquadFilter();
      pk2.type = 'peaking'; pk2.frequency.value = 2200; pk2.Q.value = 1; pk2.gain.value = shift * 12;
      pk1.connect(pk2);
      return { input: pk1, output: pk2 };
    }
    case 'noiseReduction': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 90;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 12000 - t * 4500;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20 - t * 20;
      comp.ratio.value = 3;
      hp.connect(lp); lp.connect(comp);
      return { input: hp, output: comp };
    }
    case 'distortion': {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(t * 120);
      shaper.oversample = '2x';
      return { input: shaper, output: shaper };
    }
    case 'compression': {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10 - t * 30;
      comp.ratio.value = 2 + t * 10;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      return { input: comp, output: comp };
    }
    case 'echo': {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.15 + t * 0.5;
      const wet = ctx.createGain();
      wet.gain.value = t * 0.7;
      input.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(output);
      input.connect(output);
      return { input: input, output: output };
    }
    case 'reverb': {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const conv = ctx.createConvolver();
      try { conv.buffer = makeImpulse(ctx, 2.2); } catch (_) {}
      const wet = ctx.createGain();
      wet.gain.value = t * 0.75;
      input.connect(conv);
      conv.connect(wet);
      wet.connect(output);
      input.connect(output);
      return { input: input, output: output };
    }
  }
  return null;
}

// ─── Templates ─────────────────────────────────────────────────
function buildTemplate(key, intensity) {
  if (!audioCtx) return null;
  const t = Math.max(0, Math.min(1, intensity / 100));
  const ctx = audioCtx;

  switch (key) {
    case 'telephone': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 300;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3400;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 1800; pk.Q.value = 0.7; pk.gain.value = t * 9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 5;
      hp.connect(lp); lp.connect(pk); pk.connect(comp);
      return { input: hp, output: comp };
    }
    case 'radio': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 200;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5000;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 6;
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(t * 30);
      hp.connect(lp); lp.connect(comp); comp.connect(shaper);
      return { input: hp, output: shaper };
    }
    case 'monster': {
      const ls = ctx.createBiquadFilter();
      ls.type = 'lowshelf'; ls.frequency.value = 200; ls.gain.value = t * 14;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 300; pk.Q.value = 1; pk.gain.value = t * 7;
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(t * 50);
      ls.connect(pk); pk.connect(shaper);
      return { input: ls, output: shaper };
    }
    case 'cave': {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const conv = ctx.createConvolver();
      try { conv.buffer = makeImpulse(ctx, 4.0); } catch (_) {}
      const wet = ctx.createGain();
      wet.gain.value = 0.5 + t * 0.4;
      input.connect(conv);
      conv.connect(wet);
      wet.connect(output);
      input.connect(output);
      return { input: input, output: output };
    }
    case 'infant': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 400;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 2400; pk.Q.value = 1; pk.gain.value = t * 10;
      hp.connect(pk);
      return { input: hp, output: pk };
    }
    case 'girl': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 200;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 1800; pk.Q.value = 1; pk.gain.value = t * 7;
      hp.connect(pk);
      return { input: hp, output: pk };
    }
    case 'women': {
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 1400; pk.Q.value = 1; pk.gain.value = t * 5;
      return { input: pk, output: pk };
    }
    case 'men': {
      const ls = ctx.createBiquadFilter();
      ls.type = 'lowshelf'; ls.frequency.value = 250; ls.gain.value = t * 8;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 500; pk.Q.value = 1; pk.gain.value = t * 4;
      ls.connect(pk);
      return { input: ls, output: pk };
    }
    case 'boy': {
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 1700; pk.Q.value = 1; pk.gain.value = t * 6;
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf'; hs.frequency.value = 5000; hs.gain.value = t * 4;
      pk.connect(hs);
      return { input: pk, output: hs };
    }
    case 'child': {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 300;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = 2200; pk.Q.value = 1; pk.gain.value = t * 8;
      hp.connect(pk);
      return { input: hp, output: pk };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION POLLING
// ═══════════════════════════════════════════════════════════════
function startSelectionPoll(container) {
  stopSelectionPoll();
  lastSelectedKey = getSelectionKey();
  selectionPollId = setInterval(function () {
    const key = getSelectionKey();
    if (key !== lastSelectedKey) {
      lastSelectedKey = key;
      renderTo(container);
    }
  }, 500);
}

function stopSelectionPoll() {
  if (selectionPollId) clearInterval(selectionPollId);
  selectionPollId = null;
}

function watchPanelRemoval(container, panel) {
  if (typeof MutationObserver === 'undefined') return;
  const obs = new MutationObserver(function () {
    if (!container.contains(panel)) {
      obs.disconnect();
      stopSelectionPoll();
    }
  });
  obs.observe(container, { childList: true });
}

// ═══════════════════════════════════════════════════════════════
//  Render
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'sfx-panel';
  container.appendChild(panel);

  watchPanelRemoval(container, panel);

  if (!isAudioSelected()) {
    panel.appendChild(buildEmptyState({
      icon: '🎧',
      title: 'Select an audio layer',
      text: 'Tap an audio clip (A1, A2, …) on the timeline. This screen updates automatically.'
    }));
    startSelectionPoll(container);
    return;
  }

  stopSelectionPoll();

    panel.appendChild(buildVolumeSection());
  panel.appendChild(buildEffectsSection());
  panel.appendChild(buildTemplatesSection());
  panel.appendChild(buildResetSection());
  panel.appendChild(buildFooter());

  rebuildChain();
}

// ─── Volume ────────────────────────────────────────────────────
function buildVolumeSection() {
  const sec = document.createElement('div');
  sec.className = 'sfx-section';

  const head = document.createElement('div');
  head.className = 'sfx-section-head';
  const title = document.createElement('div');
  title.className = 'sfx-section-title';
  title.textContent = 'Volume';
  head.appendChild(title);
  sec.appendChild(head);

  const row = document.createElement('div');
  row.className = 'sfx-vol-row';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'sfx-vol-slider';
  slider.min = '0';
  slider.max = '200';
  slider.step = '1';
  slider.value = String(st.volume);

  const val = document.createElement('span');
  val.className = 'sfx-vol-value';
  val.textContent = st.volume + '%';

  slider.addEventListener('input', function () {
    st.volume = parseInt(slider.value, 10);
    val.textContent = st.volume + '%';
    rebuildChain();
  });

  row.append(slider, val);
  sec.appendChild(row);
  return sec;
}

// ─── Effects ───────────────────────────────────────────────────
function buildEffectsSection() {
  const sec = document.createElement('div');
  sec.className = 'sfx-section';

  const head = document.createElement('div');
  head.className = 'sfx-section-head';
  const title = document.createElement('div');
  title.className = 'sfx-section-title';
  title.textContent = 'Sound Effects';
  const hint = document.createElement('div');
  hint.className = 'sfx-hint';
  hint.textContent = '← Swipe →';
  head.append(title, hint);
  sec.appendChild(head);

  const shelf = document.createElement('div');
  shelf.className = 'sfx-shelf';

  EFFECT_DEFS.forEach(function (def) {
    const card = document.createElement('div');
    card.className = 'sfx-fx';
    if ((st.effects[def.key] || 0) > 0) card.classList.add('active');

    const box = document.createElement('div');
    box.className = 'sfx-fx-box';
    const icon = document.createElement('div');
    icon.className = 'sfx-fx-icon';
    icon.textContent = def.icon;
    const label = document.createElement('div');
    label.className = 'sfx-fx-label';
    label.textContent = def.label;
    box.append(icon, label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sfx-fx-slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(st.effects[def.key] || 0);

    const valEl = document.createElement('div');
    valEl.className = 'sfx-fx-val';
    valEl.textContent = (st.effects[def.key] || 0) > 0 ? (st.effects[def.key] + '%') : '';

    slider.addEventListener('input', function () {
      const v = parseInt(slider.value, 10);
      st.effects[def.key] = v;
      valEl.textContent = v > 0 ? (v + '%') : '';
      card.classList.toggle('active', v > 0);
      rebuildChain();
    });

    card.append(box, slider, valEl);
    shelf.appendChild(card);
  });

  sec.appendChild(shelf);
  return sec;
}

// ─── Templates ─────────────────────────────────────────────────
function buildTemplatesSection() {
  const sec = document.createElement('div');
  sec.className = 'sfx-section';

  const head = document.createElement('div');
  head.className = 'sfx-section-head';
  const title = document.createElement('div');
  title.className = 'sfx-section-title';
  title.textContent = 'Voice Templates';
  const hint = document.createElement('div');
  hint.className = 'sfx-hint';
  hint.textContent = '← Swipe →';
  head.append(title, hint);
  sec.appendChild(head);

  const shelf = document.createElement('div');
  shelf.className = 'sfx-shelf';

  const cards = {};

  TEMPLATE_DEFS.forEach(function (def) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sfx-tpl';
    if (st.template === def.key) card.classList.add('active');

    const icon = document.createElement('div');
    icon.className = 'sfx-tpl-icon';
    icon.textContent = def.icon;

    const label = document.createElement('div');
    label.className = 'sfx-tpl-label';
    label.textContent = def.label;

    card.append(icon, label);

    card.addEventListener('click', function () {
      st.template = def.key;
      Object.values(cards).forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      rebuildChain();
    });

    cards[def.key] = card;
    shelf.appendChild(card);
  });

  sec.appendChild(shelf);

  const row = document.createElement('div');
  row.className = 'sfx-tpl-row';

  const rowLabel = document.createElement('span');
  rowLabel.className = 'sfx-tpl-row-label';
  rowLabel.textContent = 'Intensity';

  const rowSlider = document.createElement('input');
  rowSlider.type = 'range';
  rowSlider.className = 'sfx-tpl-row-slider';
  rowSlider.min = '0';
  rowSlider.max = '100';
  rowSlider.step = '1';
  rowSlider.value = String(st.templateIntensity);

  const rowValue = document.createElement('span');
  rowValue.className = 'sfx-tpl-row-value';
  rowValue.textContent = st.templateIntensity + '%';

  rowSlider.addEventListener('input', function () {
    st.templateIntensity = parseInt(rowSlider.value, 10);
    rowValue.textContent = st.templateIntensity + '%';
    if (st.template !== 'none') rebuildChain();
  });

  row.append(rowLabel, rowSlider, rowValue);
  sec.appendChild(row);
  return sec;
}

// ─── Reset section ─────────────────────────────────────────────
function buildResetSection() {
  const sec = document.createElement('div');
  sec.className = 'sfx-section';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sfx-reset-btn';
  btn.textContent = '↺ Reset All';

  btn.addEventListener('click', function () {
    // Reset state
    st.volume = 100;
    EFFECT_ORDER.forEach(function (k) { st.effects[k] = 0; });
    st.template = 'none';
    st.templateIntensity = 50;

    // Rebuild the audio chain (now just pass-through + 100% volume)
    rebuildChain();

    // Re-render the panel so sliders/chips reflect the reset
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  });

  sec.appendChild(btn);
  return sec;
}
// ─── Footer ────────────────────────────────────────────────────
function buildFooter() {
  const f = document.createElement('div');
  f.className = 'sfx-footer';

  const t = document.createElement('div');
  t.className = 'sfx-footer-title';
  t.textContent = '🎚️ Use this panel to make your audio better';

  const s = document.createElement('div');
  s.className = 'sfx-footer-sub';
  s.textContent = 'Fine-tune volume, add effects, or pick a voice template. Changes apply live.';

  f.append(t, s);
  return f;
}

function buildEmptyState(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'sfx-empty';

  const ic = document.createElement('div');
  ic.className = 'sfx-empty-icon';
  ic.textContent = opts.icon;

  const t = document.createElement('div');
  t.className = 'sfx-empty-title';
  t.textContent = opts.title;

  const d = document.createElement('div');
  d.className = 'sfx-empty-text';
  d.textContent = opts.text;

  wrap.append(ic, t, d);
  return wrap;
}