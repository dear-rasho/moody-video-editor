// ================================================================
//  js/features/audioeffect.js
//  Audio FX — creates effect LAYERS on the audio timeline.
//  Trim/drag/move just like any other layer.
//  Real-time processing during playback via audioFxEngine.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  createAudioFxLayer,
  getSelectedAudioFxLayer,
  removeAudioFxLayer,
  selectAudioFxLayerByUrl
} from '../workspace/audioEffectLayer.js';
import { registerAudioFxBuilder, resumeAudioContext } from '../workspace/audioFxEngine.js';

export const featureKey = 'audioeffect';
export const featureLabel = 'Audio FX';
export const featureIcon = '🎙️';

// ═══════════════════════════════════════════════════════════════
//  EFFECTS + BUILDERS
// ═══════════════════════════════════════════════════════════════
const EFFECTS = [
  { key: 'studio',    label: 'Studio',     icon: '🎙️', group: 'Enhance', build: buildStudio },
  { key: 'warm',      label: 'Warm',       icon: '☕',  group: 'Enhance', build: buildWarm },
  { key: 'bright',    label: 'Bright',     icon: '✨', group: 'Enhance', build: buildBright },
  { key: 'vocal',     label: 'Vocal',      icon: '🎤', group: 'Enhance', build: buildVocal },
  { key: 'podcast',   label: 'Podcast',    icon: '🎧', group: 'Enhance', build: buildPodcast },

  { key: 'deep',      label: 'Deep',       icon: '🐻', group: 'Voice',   build: buildDeep },
  { key: 'monster',   label: 'Monster',    icon: '👹', group: 'Voice',   build: buildMonster },
  { key: 'chipmunk',  label: 'Chipmunk',   icon: '🐿️', group: 'Voice',   build: buildChipmunk },
  { key: 'baby',      label: 'Baby',       icon: '👶', group: 'Voice',   build: buildBaby },
  { key: 'robot',     label: 'Robot',      icon: '🤖', group: 'Voice',   build: buildRobot },

  { key: 'echo',      label: 'Echo',       icon: '🔊', group: 'Space',   build: buildEcho },
  { key: 'reverb',    label: 'Reverb',     icon: '🏛️', group: 'Space',   build: buildReverb },
  { key: 'cave',      label: 'Cave',       icon: '🕳️', group: 'Space',   build: buildCave },
  { key: 'stadium',   label: 'Stadium',    icon: '🏟️', group: 'Space',   build: buildStadium },
  { key: 'telephone', label: 'Telephone',  icon: '☎️', group: 'Space',   build: buildTelephone },

  { key: 'underwater', label: 'Underwater', icon: '🌊', group: 'Creative', build: buildUnderwater },
  { key: 'whisper',    label: 'Whisper',    icon: '🤫', group: 'Creative', build: buildWhisper },
  { key: 'radio',      label: 'Old Radio',  icon: '📻', group: 'Creative', build: buildRadio }
];

const EFFECT_MAP = {};
EFFECTS.forEach(e => { EFFECT_MAP[e.key] = e; });

// Register builders with the engine once
EFFECTS.forEach(e => {
  if (e.build) registerAudioFxBuilder(e.key, e.build);
});

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installAudioEffectRenderer() {
  if (featuresRouter.__audioEffectInstalled) return;
  featuresRouter.__audioEffectInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'audioeffectPanel') {
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
const CSS_ID = 'audioeffect-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .ax-panel{display:flex;flex-direction:column;gap:8px;width:100%;padding:10px 8px 14px;box-sizing:border-box;}
    .ax-panel *{box-sizing:border-box;}
    .ax-hint{font-size:10px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;opacity:.65;padding:0 4px;line-height:1.4;}
    .ax-info{padding:8px 12px;background:rgba(255,209,102,.15);border:1px solid #ffd166;border-radius:8px;font-size:11px;color:#ffd166;font-weight:700;letter-spacing:.02em;}
    .ax-group-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 2px 2px;}
    .ax-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;width:100%;}
    .ax-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:86px;padding:10px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:inherit;transition:all .12s ease;-webkit-tap-highlight-color:transparent;}
    .ax-item:active{background:var(--surface-3);}
    .ax-icon{width:38px;height:38px;border-radius:50%;border:1px solid var(--border);display:grid;place-items:center;font-size:18px;background:var(--surface);}
    .ax-label{font-size:11px;font-weight:600;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}
    .ax-revert-btn{width:100%;padding:11px 16px;min-height:44px;background:var(--surface);color:var(--danger);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px;}
    .ax-revert-btn:active{background:var(--surface-3);}
    @media (max-width:380px){.ax-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px;}.ax-item{min-height:78px;padding:8px 3px;}.ax-icon{width:32px;height:32px;font-size:15px;}.ax-label{font-size:10px;}}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('audioeffect', [], {
    title: 'Audio FX',
    level: 2,
    renderMode: 'audioeffectPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  // Resume audio context on any panel interaction
  try { resumeAudioContext(); } catch (_) {}

  const panel = document.createElement('div');
  panel.className = 'ax-panel';

  const hint = document.createElement('div');
  hint.className = 'ax-hint';
  hint.textContent = 'Tap an effect to add an Audio FX layer at the playhead';
  panel.appendChild(hint);

  // Currently selected FX layer
  const sel = getSelectedAudioFxLayer();
  if (sel) {
    const info = document.createElement('div');
    info.className = 'ax-info';
    const eff = EFFECT_MAP[sel.clip.__audioFxKey] || {};
    info.textContent = '🎙️ Selected: ' + (eff.label || sel.clip.__audioFxKey) +
                       ' — trim/drag on timeline to adjust range';
    panel.appendChild(info);
  }

  // Groups
  const GROUPS = ['Enhance', 'Voice', 'Space', 'Creative'];

  GROUPS.forEach(groupName => {
    const title = document.createElement('div');
    title.className = 'ax-group-title';
    title.textContent = groupName;
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'ax-grid';

    EFFECTS.filter(e => e.group === groupName).forEach(effect => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ax-item';

      const ic = document.createElement('span');
      ic.className = 'ax-icon';
      ic.textContent = effect.icon;

      const lb = document.createElement('span');
      lb.className = 'ax-label';
      lb.textContent = effect.label;

      item.append(ic, lb);

      item.addEventListener('click', () => {
        try { resumeAudioContext(); } catch (_) {}
        const id = createAudioFxLayer(effect.key, effect.icon + ' ' + effect.label);
        if (id) showToast('Added ' + effect.label);
        // rerender panel
        const c = document.querySelector('#feature-shelf');
        if (c) renderTo(c);
      });

      grid.appendChild(item);
    });

    panel.appendChild(grid);
  });

  // Remove button
  if (sel) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ax-revert-btn';
    removeBtn.textContent = '🗑 Remove Selected FX Layer';
    removeBtn.addEventListener('click', () => {
      removeAudioFxLayer(sel.clip);
      showToast('FX layer removed');
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });
    panel.appendChild(removeBtn);
  }

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  BUILDERS (ctx, src) → tailNode
// ═══════════════════════════════════════════════════════════════

// ─── Enhance ──────────────────────────────────────────────────
function buildStudio(ac, src) {
  const low = ac.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 200; low.gain.value = 3;
  const mid = ac.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 400; mid.Q.value = 1; mid.gain.value = -3;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 4500; high.gain.value = 4;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 3;
  comp.attack.value = 0.005; comp.release.value = 0.2;
  src.connect(low).connect(mid).connect(high).connect(comp);
  return comp;
}

function buildWarm(ac, src) {
  const bass = ac.createBiquadFilter();
  bass.type = 'lowshelf'; bass.frequency.value = 250; bass.gain.value = 8;
  const mid = ac.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 2000; mid.Q.value = 1; mid.gain.value = -2;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 6000; high.gain.value = -3;
  src.connect(bass).connect(mid).connect(high);
  return high;
}

function buildBright(ac, src) {
  const mid = ac.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 1500; mid.Q.value = 1; mid.gain.value = 2;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 3500; high.gain.value = 7;
  src.connect(mid).connect(high);
  return high;
}

function buildVocal(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 120;
  const mid = ac.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 2500; mid.Q.value = 1.2; mid.gain.value = 6;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -22; comp.ratio.value = 3;
  src.connect(hp).connect(mid).connect(comp);
  return comp;
}

function buildPodcast(ac, src) {
  const bass = ac.createBiquadFilter();
  bass.type = 'lowshelf'; bass.frequency.value = 180; bass.gain.value = 3;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 5500; high.gain.value = 3;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 25;
  comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
  src.connect(bass).connect(high).connect(comp);
  return comp;
}

// ─── Voice ────────────────────────────────────────────────────
function buildDeep(ac, src) {
  const bass = ac.createBiquadFilter();
  bass.type = 'lowshelf'; bass.frequency.value = 220; bass.gain.value = 8;
  const mid = ac.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 3000; mid.Q.value = 1; mid.gain.value = -4;
  src.connect(bass).connect(mid);
  return mid;
}

function buildMonster(ac, src) {
  const bass = ac.createBiquadFilter();
  bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = 10;
  const shaper = ac.createWaveShaper();
  shaper.curve = makeDistortionCurve(40);
  shaper.oversample = '4x';
  src.connect(bass).connect(shaper);
  return shaper;
}

function buildChipmunk(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 500;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 3000; high.gain.value = 6;
  src.connect(hp).connect(high);
  return high;
}

function buildBaby(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 700;
  const high = ac.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 2500; high.gain.value = 8;
  src.connect(hp).connect(high);
  return high;
}

function buildRobot(ac, src) {
  const mod = ac.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = 55;
  const modGain = ac.createGain();
  modGain.gain.value = 0.5;
  const ringMod = ac.createGain();
  ringMod.gain.value = 0;
  mod.connect(modGain).connect(ringMod.gain);
  const out = ac.createGain();
  out.gain.value = 1;
  src.connect(ringMod);
  ringMod.connect(out);
  mod.start(0);
  return out;
}

// ─── Space ────────────────────────────────────────────────────
function buildEcho(ac, src) {
  const out = ac.createGain(); out.gain.value = 1;
  const delay = ac.createDelay(2); delay.delayTime.value = 0.25;
  const fb = ac.createGain(); fb.gain.value = 0.4;
  const wet = ac.createGain(); wet.gain.value = 0.55;
  src.connect(out);
  src.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(out);
  return out;
}

function buildReverb(ac, src) {
  const out = ac.createGain(); out.gain.value = 1;
  const conv = ac.createConvolver();
  conv.buffer = createImpulse(ac, 2.0, 3);
  const wet = ac.createGain(); wet.gain.value = 0.5;
  src.connect(out);
  src.connect(conv);
  conv.connect(wet);
  wet.connect(out);
  return out;
}

function buildCave(ac, src) {
  const out = ac.createGain(); out.gain.value = 1;
  const low = ac.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 400; low.gain.value = 4;
  const conv = ac.createConvolver();
  conv.buffer = createImpulse(ac, 2.5, 2.5);
  const wet = ac.createGain(); wet.gain.value = 0.7;
  src.connect(low).connect(out);
  low.connect(conv);
  conv.connect(wet);
  wet.connect(out);
  return out;
}

function buildStadium(ac, src) {
  const out = ac.createGain(); out.gain.value = 1;
  const conv = ac.createConvolver();
  conv.buffer = createImpulse(ac, 3.0, 1.6);
  const wet = ac.createGain(); wet.gain.value = 0.65;
  src.connect(out);
  src.connect(conv);
  conv.connect(wet);
  wet.connect(out);
  return out;
}

function buildTelephone(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 300;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3400;
  const peak = ac.createBiquadFilter();
  peak.type = 'peaking'; peak.frequency.value = 1800; peak.Q.value = 1; peak.gain.value = 6;
  const shaper = ac.createWaveShaper();
  shaper.curve = makeDistortionCurve(15);
  shaper.oversample = '2x';
  src.connect(hp).connect(lp).connect(peak).connect(shaper);
  return shaper;
}

// ─── Creative ─────────────────────────────────────────────────
function buildUnderwater(ac, src) {
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 4;
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 1.5;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start(0);
  src.connect(lp);
  return lp;
}

function buildWhisper(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1200;
  const g = ac.createGain();
  g.gain.value = 1.6;
  src.connect(hp).connect(g);
  return g;
}

function buildRadio(ac, src) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 500;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3000;
  const shaper = ac.createWaveShaper();
  shaper.curve = makeDistortionCurve(8);
  src.connect(hp).connect(lp).connect(shaper);
  return shaper;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function makeDistortionCurve(amount) {
  const n = 8192;
  const curve = new Float32Array(n);
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) /
               (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function createImpulse(ac, duration, decay) {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * duration);
  const impulse = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return impulse;
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)','background:rgba(0,0,0,0.9)',
    'color:#fff','padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}