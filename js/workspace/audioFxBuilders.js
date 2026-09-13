// ================================================================
//  js/workspace/audioFxBuilders.js
//  Pure Audio FX builder functions (ctx, src) → tailNode
//  Shared by audioeffect.js (UI) and export.js (offline render).
// ================================================================

export const BUILDERS = {
  // ─── Enhance ──────────────────────────────────────────────
  studio: buildStudio,
  warm: buildWarm,
  bright: buildBright,
  vocal: buildVocal,
  podcast: buildPodcast,

  // ─── Voice ────────────────────────────────────────────────
  deep: buildDeep,
  monster: buildMonster,
  chipmunk: buildChipmunk,
  baby: buildBaby,
  robot: buildRobot,

  // ─── Space ────────────────────────────────────────────────
  echo: buildEcho,
  reverb: buildReverb,
  cave: buildCave,
  stadium: buildStadium,
  telephone: buildTelephone,

  // ─── Creative ─────────────────────────────────────────────
  underwater: buildUnderwater,
  whisper: buildWhisper,
  radio: buildRadio
};

export function getBuilder(key) {
  return BUILDERS[key] || null;
}

// ═══════════════════════════════════════════════════════════════
//  Enhance
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  Voice
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  Space
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  Creative
// ═══════════════════════════════════════════════════════════════
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
//  Helpers
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