// ================================================================
//  js/codebase/beatsEngine.js
//  Beat detection + beats-driven editing + timeline markers.
//  Supports strength-aware patterns (hard/med/soft/rest).
// ================================================================

const MIN_GAP_SEC   = 0.22;
const FRAME_SIZE    = 1024;
const HOP_SIZE      = 512;
const NOVELTY_WIN   = 6;
const PEAK_PROM     = 0.12;
const SILENCE_RATIO = 0.10;
const LOCAL_PROM    = 1.20;
const NEIGHBOR_LOOK = 5;
const NEIGHBOR_SIM  = 0.35;
const NEIGHBOR_MIN  = 2;

// ═══════════════════════════════════════════════════════════════
//  AUDIO ANALYSIS
// ═══════════════════════════════════════════════════════════════
async function decodeAudioFromUrl(url) {
  const resp = await fetch(url);
  const ab = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('AudioContext not available');
  const ac = new AC();
  let buffer;
  try { buffer = await ac.decodeAudioData(ab); }
  finally { try { ac.close(); } catch (_) {} }
  return buffer;
}

function downmixToMono(audioBuffer) {
  const ch0 = audioBuffer.getChannelData(0);
  if (audioBuffer.numberOfChannels === 1) return ch0;
  const ch1 = audioBuffer.getChannelData(1);
  const out = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) out[i] = (ch0[i] + ch1[i]) * 0.5;
  return out;
}

function computeEnergyFrames(mono) {
  const frameCount = Math.max(1, Math.floor((mono.length - FRAME_SIZE) / HOP_SIZE) + 1);
  const energy = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const start = f * HOP_SIZE;
    let sum = 0;
    for (let i = 0; i < FRAME_SIZE; i++) {
      const s = mono[start + i];
      sum += s * s;
    }
    energy[f] = Math.sqrt(sum / FRAME_SIZE);
  }
  return energy;
}

function computeOnsetFlux(energy) {
  const n = energy.length;
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const d = energy[i] - energy[i - 1];
    flux[i] = d > 0 ? d : 0;
  }
  return flux;
}

function pickPeaks(flux, energy, sampleRate) {
  const n = flux.length;
  if (n < 20) return [];

  let maxNovelty = 0;
  let maxEnergy = 0;
  for (let i = 0; i < n; i++) {
    if (flux[i] > maxNovelty) maxNovelty = flux[i];
    if (energy[i] > maxEnergy) maxEnergy = energy[i];
  }
  if (maxNovelty <= 0 || maxEnergy <= 0) return [];

  const noveltyThr = maxNovelty * PEAK_PROM;
  const silenceThr = maxEnergy * SILENCE_RATIO;

  const peaks = [];

  for (let i = 2; i < n - 2; i++) {
    if (energy[i] < silenceThr) continue;
    if (flux[i] < noveltyThr) continue;

    let isLocalMax = true;
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      if (flux[i + k] > flux[i]) { isLocalMax = false; break; }
    }
    if (!isLocalMax) continue;

    const lStart = Math.max(0, i - 12);
    const lEnd = Math.min(n - 1, i + 12);
    let eSum = 0, eCnt = 0;
    for (let w = lStart; w <= lEnd; w++) { eSum += energy[w]; eCnt++; }
    const localAvg = eCnt > 0 ? eSum / eCnt : 0;
    if (localAvg > 0 && energy[i] < localAvg * LOCAL_PROM) continue;

    peaks.push({
      time: (i * HOP_SIZE) / sampleRate,
      strength: energy[i]
    });
  }

  return peaks;
}

function filterByNeighborSimilarity(peaks) {
  if (peaks.length < 4) return peaks;

  const result = [];
  const n = peaks.length;

  for (let i = 0; i < n; i++) {
    const p = peaks[i];
    let similarCount = 0;

    const lo = Math.max(0, i - NEIGHBOR_LOOK);
    const hi = Math.min(n - 1, i + NEIGHBOR_LOOK);

    for (let k = lo; k <= hi; k++) {
      if (k === i) continue;
      const o = peaks[k];
      const ratio = o.strength / p.strength;
      if (ratio >= NEIGHBOR_SIM && ratio <= 1 / NEIGHBOR_SIM) {
        similarCount++;
      }
    }

    if (similarCount >= NEIGHBOR_MIN) result.push(p);
  }

  return result;
}

function applyMinSpacing(peaks) {
  if (!peaks.length) return peaks;

  peaks.sort((a, b) => a.time - b.time);

  const filtered = [];
  for (const p of peaks) {
    if (!filtered.length) { filtered.push(p); continue; }
    const last = filtered[filtered.length - 1];
    if (p.time - last.time >= MIN_GAP_SEC) {
      filtered.push(p);
    } else if (p.strength > last.strength) {
      filtered[filtered.length - 1] = p;
    }
  }

  const regular = filterByNeighborSimilarity(filtered);

  if (regular.length >= filtered.length * 0.25) return regular;

  if (filtered.length > 0) {
    const sorted = filtered.slice().sort((a, b) => b.strength - a.strength);
    const keepCount = Math.max(3, Math.ceil(sorted.length * 0.6));
    const keepSet = new Set(sorted.slice(0, keepCount));
    const fallback = filtered.filter(p => keepSet.has(p));
    return fallback;
  }

  return regular;
}

export async function detectBeatsFromUrl(url) {
  if (!url) throw new Error('No audio URL');
  const buffer = await decodeAudioFromUrl(url);
  const mono = downmixToMono(buffer);
  const energy = computeEnergyFrames(mono);
  const flux = computeOnsetFlux(energy);

  const raw = pickPeaks(flux, energy, buffer.sampleRate);
  console.log('[beatsEngine] after pickPeaks:', raw.length);

  const spaced = applyMinSpacing(raw);
  console.log('[beatsEngine] after neighbor filter:', spaced.length);

  return spaced;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function findSelectedAudioClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'A') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.audio[trackIdx];
  if (!Array.isArray(track)) return null;
  return track[clipIdx] || null;
}

function findAudioClipWithBeats() {
  const appState = window.__appState;
  if (!appState) return null;
  const sel = findSelectedAudioClip();
  if (sel && Array.isArray(sel.__beats) && sel.__beats.length > 0) return sel;
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && Array.isArray(clip.__beats) && clip.__beats.length > 0) return clip;
    }
  }
  return null;
}

function deepCloneClip(clip) {
  let copy;
  try { copy = JSON.parse(JSON.stringify(clip)); }
  catch (_) { copy = Object.assign({}, clip); }
  const now = Date.now();
  const rnd = Math.random().toString(36).slice(2, 7);
  delete copy.__linkedId;
  delete copy.__beats;
  delete copy.__beatsDetectedAt;
  if (copy.__effectId) { copy.__effectId = 'fx-' + now + '-' + rnd; copy.url = 'effect://' + copy.__effectId; }
  if (copy.__textId)   { copy.__textId   = 'tx-' + now + '-' + rnd; copy.url = 'text://'   + copy.__textId;   }
  if (copy.__stickerId){ copy.__stickerId= 'sk-' + now + '-' + rnd; copy.url = 'sticker://'+ copy.__stickerId;}
  if (copy.__audioFxId){ copy.__audioFxId= 'afx-' + now + '-' + rnd; copy.url = 'audiofx://'+ copy.__audioFxId;}
  if (copy.__soundId)  { copy.__soundId  = 'se-' + now + '-' + rnd; }
  return copy;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════════════════════
//  EFFECT MAPS
// ═══════════════════════════════════════════════════════════════
const MOTION_MAP = {
  shake:     { type: 'shake',     intensity: 90,  speed: 1.2 },
  bounce:    { type: 'bounce',    intensity: 100, speed: 1.4 },
  pulse:     { type: 'pulse',     intensity: 100, speed: 1.2 },
  zoom:      { type: 'zoomPulse', intensity: 100, speed: 1.0 },
  zoomPulse: { type: 'zoomPulse', intensity: 100, speed: 1.0 },
  zoomin:    { type: 'zoomPulse', intensity: 100, speed: 1.0 },
  glitch:    { type: 'glitch',    intensity: 100, speed: 2.0 },
  wobble:    { type: 'rotate',    intensity: 80,  speed: 1.0 },
  rotate:    { type: 'rotate',    intensity: 80,  speed: 1.0 },
  flicker:   { type: 'glitch',    intensity: 60,  speed: 3.0 }
};

const COLOR_MAP = {
  warm:      { brightness: 108, contrast: 105, saturation: 115 },
  cool:      { brightness: 100, contrast: 108, saturation: 95 },
  vivid:     { brightness: 102, contrast: 112, saturation: 145 },
  bw:        { grayscale: 100, contrast: 110 },
  noir:      { grayscale: 100, contrast: 135, brightness: 92 },
  vintage:   { brightness: 98, contrast: 92, saturation: 80, sepia: 25 },
  cinematic: { brightness: 98, contrast: 118, saturation: 90 },
  flash:     { brightness: 180, contrast: 115, saturation: 100 },
  fade:      { brightness: 100, contrast: 85, saturation: 90 },
  dreamy:    { brightness: 105, contrast: 92, saturation: 105, blur: 0.6 },
  // Glow / lighting family
  glow:      { brightness: 125, contrast: 105, saturation: 120, blur: 0.5 },
  lighting:  { brightness: 140, contrast: 110, saturation: 115 },
  sparkle:   { brightness: 130, contrast: 108, saturation: 140 },
  neon:      { brightness: 105, contrast: 125, saturation: 160 }
};

export function buildEffectStateForKey(key) {
  const k = String(key || '').toLowerCase();
  const base = {
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
  };
  if (MOTION_MAP[k]) {
    return { kind: 'effect', presetKey: k, filters: base, motion: MOTION_MAP[k] };
  }
  if (COLOR_MAP[k]) {
    return { kind: 'effect', presetKey: k, filters: Object.assign({}, base, COLOR_MAP[k]), motion: null };
  }
  return { kind: 'effect', presetKey: k, filters: base, motion: MOTION_MAP.shake };
}
// ═══════════════════════════════════════════════════════════════
//  🆕 BEATS FILTER PARSER
//
//  Accepts:
//    "" or "all"                 → no filter (every beat)
//    "hard" / "heavy" / "high"   → only HARD beats (≥66% of max)
//    "med" / "medium" / "mid"    → only MEDIUM beats (33-66%)
//    "soft" / "low" / "quiet"    → only SOFT beats (<33%)
//    "hard,med" / "hard+med"     → multiple levels
//    "0.3-0.5" / "0.3 to 0.5"    → numeric strength range
// ═══════════════════════════════════════════════════════════════
function parseBeatsFilter(raw) {
  if (!raw || !String(raw).trim()) return { mode: 'all' };
  const low = String(raw).trim().toLowerCase();

  // Numeric range: "0.3-0.5" or "0.3 to 0.5"
  const rangeM = low.match(/^([\d.]+)\s*(?:-|to|–|—)\s*([\d.]+)$/);
  if (rangeM) {
    const a = parseFloat(rangeM[1]);
    const b = parseFloat(rangeM[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        mode: 'range',
        min: Math.min(a, b),
        max: Math.max(a, b)
      };
    }
  }

  // Named levels
  const parts = low.split(/[\s,+&]+/).filter(Boolean);
  const levels = new Set();
  for (const p of parts) {
    if (p === 'all' || p === 'every' || p === 'full') return { mode: 'all' };
    if (p === 'hard' || p === 'heavy' || p === 'high' ||
        p === 'strong' || p === 'loud') {
      levels.add('hard');
    } else if (p === 'med' || p === 'medium' || p === 'mid' ||
               p === 'normal') {
      levels.add('med');
    } else if (p === 'soft' || p === 'low' || p === 'quiet' ||
               p === 'light' || p === 'gentle') {
      levels.add('soft');
    }
  }

  if (levels.size === 0 || levels.size === 3) return { mode: 'all' };
  return { mode: 'levels', levels: Array.from(levels) };
}

function formatFilterLabel(filter) {
  if (!filter || filter.mode === 'all') return 'ALL beats';
  if (filter.mode === 'range') {
    return 'Strength ' + filter.min + ' – ' + filter.max;
  }
  const labels = filter.levels.map(l =>
    l === 'hard' ? '🔴 HARD' :
    l === 'med'  ? '🟡 MED'  :
                   '🟢 SOFT'
  );
  return labels.join(' + ') + ' only';
}

// Beats Report
function generateBeatsReport(clip, beats, filter, totalBeforeFilter) {
  const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const clipSourceIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;

  const times = beats
    .map(b => ({
      time: clipStart + (b.time - clipSourceIn),
      strength: Number.isFinite(b.strength) ? b.strength : 0
    }))
    .sort((a, b) => a.time - b.time);

  if (!times.length) return 'No beats.';

  const first = times[0].time;
  const last = times[times.length - 1].time;
  const duration = Math.max(0, last - first);

  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i].time - times[i - 1].time);
  }

  const avgGap = gaps.length
    ? gaps.reduce((a, b) => a + b, 0) / gaps.length
    : 0;

  let minGap = Infinity, maxGap = 0;
  let minIdx = -1, maxIdx = -1;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i] < minGap) { minGap = gaps[i]; minIdx = i; }
    if (gaps[i] > maxGap) { maxGap = gaps[i]; maxIdx = i; }
  }
  if (!gaps.length) { minGap = 0; maxGap = 0; }

  const bpm = avgGap > 0 ? (60 / avgGap) : 0;

  const strengths = times.map(t => t.strength);
  const maxStrength = Math.max(...strengths, 0);
  const minStrength = Math.min(...strengths.filter(s => s > 0), 0);
  const avgStrength = strengths.length
    ? strengths.reduce((a, b) => a + b, 0) / strengths.length
    : 0;

  // Use thresholds based on the FILTERED subset's max strength.
  // This way, if user only asked for HARD beats, all shown beats
  // will classify as HARD relative to each other.
  const HARD_THR = maxStrength * 0.66;
  const SOFT_THR = maxStrength * 0.33;

  let hardCount = 0, mediumCount = 0, softCount = 0;
  for (const t of times) {
    if (t.strength >= HARD_THR) hardCount++;
    else if (t.strength >= SOFT_THR) mediumCount++;
    else softCount++;
  }

  const lines = [];
  lines.push('═══════════════════════════════════════════════');
  lines.push('🥁 BEATS REPORT');
  lines.push('═══════════════════════════════════════════════');
  lines.push('Audio:           "' + (clip.name || 'Untitled').slice(0, 42) + '"');

  // 🆕 Filter info
  if (filter && filter.mode !== 'all') {
    lines.push('Filter:          ' + formatFilterLabel(filter));
    if (Number.isFinite(totalBeforeFilter)) {
      lines.push('Detected total:  ' + totalBeforeFilter + ' beats');
      lines.push('After filter:    ' + times.length + ' beats');
    }
  }

  lines.push('');
  lines.push('Total beats:     ' + times.length);
  lines.push('First beat:      ' + first.toFixed(2) + 's');
  lines.push('Last beat:       ' + last.toFixed(2) + 's');
  lines.push('Total duration:  ' + duration.toFixed(2) + 's');
  lines.push('Average gap:     ' + avgGap.toFixed(3) + 's');
  lines.push('BPM:             ' + bpm.toFixed(1));
  lines.push('Min gap:         ' + minGap.toFixed(3) + 's' +
             (minIdx >= 0 ? '  (between #' + (minIdx + 1) + ' & #' + (minIdx + 2) + ')' : ''));
  lines.push('Max gap:         ' + maxGap.toFixed(3) + 's' +
             (maxIdx >= 0 ? '  (between #' + (maxIdx + 1) + ' & #' + (maxIdx + 2) + ')' : ''));
  lines.push('');
  lines.push('═══════════════════════════════════════════════');
  lines.push('🔊 BEAT STRENGTH');
  lines.push('═══════════════════════════════════════════════');
  lines.push('Max strength:    ' + maxStrength.toFixed(4));
  lines.push('Avg strength:    ' + avgStrength.toFixed(4));
  lines.push('Min strength:    ' + minStrength.toFixed(4));
  lines.push('');
  lines.push('🔴 HARD  (≥66%): ' + hardCount + ' beats');
  lines.push('🟡 MED   (33-66%): ' + mediumCount + ' beats');
  lines.push('🟢 SOFT  (<33%):  ' + softCount + ' beats');
  lines.push('');
  lines.push('═══════════════════════════════════════════════');
  lines.push('BEAT TIMELINE   ( # | time | gap | level | str )');
  lines.push('═══════════════════════════════════════════════');

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const num = String(i + 1).padStart(3, ' ');
    const timeStr = t.time.toFixed(3).padStart(8, ' ');

    const gapStr = i === 0
      ? '      —'
      : ('+' + (times[i].time - times[i - 1].time).toFixed(3)).padStart(7, ' ');

    let level, icon;
    if (t.strength >= HARD_THR) { level = 'HARD'; icon = '🔴'; }
    else if (t.strength >= SOFT_THR) { level = 'MED '; icon = '🟡'; }
    else { level = 'SOFT'; icon = '🟢'; }

    const strVal = t.strength.toFixed(3).padStart(6, ' ');

    lines.push(
      '  #' + num + '  |  ' + timeStr + 's  |  ' + gapStr + 's  |  ' +
      icon + ' ' + level + '  |  ' + strVal
    );
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════');
  lines.push('HOW TO USE THIS REPORT');
  lines.push('═══════════════════════════════════════════════');
  lines.push('1. Count clips you have. If clips < beats, they will loop.');
  lines.push('2. Average gap = typical effect duration.');
  lines.push('3. 🔴 HARD beats → punchy effects (shake, glitch, flash).');
  lines.push('4. 🟡 MED beats → standard effects (zoom, pulse, bounce).');
  lines.push('5. 🟢 SOFT beats → gentle effects (fade, dreamy, warm).');
  lines.push('');
  lines.push('To filter by level next time:');
  lines.push('  detect beats hard');
  lines.push('  detect beats medium');
  lines.push('  detect beats soft');
  lines.push('  detect beats hard,med');
  lines.push('  detect beats 0.3-0.5');
  lines.push('');
  lines.push('Then run:');
  lines.push('  beats edit <effect1>, <effect2>, <effect3>, ...');
  lines.push('');
  lines.push('Strength-aware syntax:');
  lines.push('  beats edit hard: shake+glow ; rest: zoom, pulse, bounce');
  lines.push('═══════════════════════════════════════════════');

  return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
//  STRENGTH-AWARE PARSER
// ═══════════════════════════════════════════════════════════════
function parseBeatsEditString(raw) {
  const result = { hard: null, med: null, soft: null, rest: null };

  const sections = String(raw).split(';').map(s => s.trim()).filter(Boolean);

  for (const sec of sections) {
    let key = 'rest';
    let body = sec;

    const qm = sec.match(/^(hard|med|medium|soft|rest|default|normal|other)\s*[:\-]\s*(.+)$/i);
    if (qm) {
      const q = qm[1].toLowerCase();
      if (q === 'medium') key = 'med';
      else if (q === 'default' || q === 'normal' || q === 'other') key = 'rest';
      else key = q;
      body = qm[2];
    }

    const patterns = body
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => p.split('+').map(e => e.trim().toLowerCase()).filter(Boolean))
      .filter(arr => arr.length > 0);

    if (patterns.length > 0) {
      if (key === 'hard') result.hard = patterns;
      else if (key === 'med') result.med = patterns;
      else if (key === 'soft') result.soft = patterns;
      else result.rest = patterns;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Run detect beats
export async function runDetectBeats(filterRaw) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  const audioClip = findSelectedAudioClip();
  if (!audioClip) return { ok: false, error: 'Select an audio clip first' };
  if (!audioClip.url) return { ok: false, error: 'Audio clip has no URL' };

  let beats;
  try {
    beats = await detectBeatsFromUrl(audioClip.url);
  } catch (e) {
    return { ok: false, error: 'Beat detection failed: ' + (e.message || 'unknown') };
  }

  if (!beats.length) {
    return {
      ok: false,
      error: 'No clear beats detected — audio seems to be speech/ambient sound'
    };
  }

  const totalDetected = beats.length;

  // 🆕 Parse filter
  const filter = parseBeatsFilter(filterRaw);

  // 🆕 Compute thresholds on ALL detected beats (global)
  let maxStrength = 0;
  for (const b of beats) if (b.strength > maxStrength) maxStrength = b.strength;
  const HARD_THR = maxStrength * 0.66;
  const SOFT_THR = maxStrength * 0.33;

  // 🆕 Apply filter
  let filtered = beats;
  if (filter.mode === 'levels') {
    const lv = new Set(filter.levels);
    filtered = beats.filter(b => {
      const isHard = b.strength >= HARD_THR;
      const isSoft = b.strength < SOFT_THR;
      const isMed = !isHard && !isSoft;
      if (lv.has('hard') && isHard) return true;
      if (lv.has('med') && isMed) return true;
      if (lv.has('soft') && isSoft) return true;
      return false;
    });
  } else if (filter.mode === 'range') {
    filtered = beats.filter(b =>
      b.strength >= filter.min && b.strength <= filter.max
    );
  }

  if (!filtered.length) {
    return {
      ok: false,
      error: 'No beats match this filter (' + formatFilterLabel(filter) +
             '). Try "detect beats" for all beats.'
    };
  }

  // Save only the FILTERED beats to the clip
  audioClip.__beats = filtered.map(b => ({ time: b.time, strength: b.strength }));
  audioClip.__beatsDetectedAt = Date.now();
  audioClip.__beatsFilter = filter;
  audioClip.__beatsTotalDetected = totalDetected;

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('beats:changed'));
  scheduleBeatMarkers();

  const report = generateBeatsReport(audioClip, filtered, filter, totalDetected);

  return {
    ok: true,
    beatsCount: filtered.length,
    totalDetected: totalDetected,
    filter: filter,
    clipName: audioClip.name || 'Audio',
    report: report
  };
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Run beats editing
// ═══════════════════════════════════════════════════════════════
export async function runBeatsEditing(input) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  let groups;
  if (typeof input === 'string') {
    groups = parseBeatsEditString(input);
  } else if (Array.isArray(input)) {
    groups = {
      hard: null, med: null, soft: null,
      rest: input.map(k => [String(k).toLowerCase()])
    };
  } else {
    groups = { hard: null, med: null, soft: null, rest: [['shake']] };
  }

  const hasAny = groups.hard || groups.med || groups.soft || groups.rest;
  if (!hasAny) {
    return { ok: false, error: 'No valid beats edit pattern found' };
  }

  const audioClip = findAudioClipWithBeats();
  if (!audioClip) {
    return { ok: false, error: 'No audio with beats. Run "detect beats" first.' };
  }

  const selected = [];
  if (window.__multiSelect && typeof window.__multiSelect.forEachSelectedClip === 'function') {
    window.__multiSelect.forEachSelectedClip(c => selected.push(c));
  }
  if (!selected.length) {
    return { ok: false, error: 'Select visual clips first (⏩ / ⏪ buttons)' };
  }

  const visualClips = selected.filter(c => {
    if (!c || !c.type) return false;
    return c.type.indexOf('video/') === 0 || c.type.indexOf('image/') === 0;
  });
  if (!visualClips.length) return { ok: false, error: 'No video/image clips selected' };

  visualClips.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const vTracks = appState.timeline.visual || [];
  let srcTrackIdx = -1;
  for (let t = 0; t < vTracks.length; t++) {
    if (Array.isArray(vTracks[t]) && vTracks[t].indexOf(visualClips[0]) >= 0) {
      srcTrackIdx = t;
      break;
    }
  }
  if (srcTrackIdx < 0) return { ok: false, error: 'Selected clip not found on any visual track' };

  const srcTrack = vTracks[srcTrackIdx];

  const audioStart = Number.isFinite(audioClip.startTime) ? audioClip.startTime : 0;
  const audioSourceIn = Number.isFinite(audioClip.sourceIn) ? audioClip.sourceIn : 0;
  const audioDur = Number.isFinite(audioClip.duration) ? audioClip.duration : 0;
  const audioEnd = audioStart + audioDur;

  const timelineBeats = [];
  for (const b of audioClip.__beats) {
    const t = audioStart + (b.time - audioSourceIn);
    if (t >= audioStart - 0.001 && t < audioEnd) {
      timelineBeats.push({
        time: t,
        strength: Number.isFinite(b.strength) ? b.strength : 0
      });
    }
  }
  timelineBeats.sort((a, b) => a.time - b.time);

  if (!timelineBeats.length) {
    return { ok: false, error: 'No beats fall inside the audio clip range' };
  }

  let maxStrength = 0;
  for (const b of timelineBeats) if (b.strength > maxStrength) maxStrength = b.strength;
  const HARD_THR = maxStrength * 0.66;
  const SOFT_THR = maxStrength * 0.33;

  const selSet = new Set(visualClips);
  for (let t = 0; t < vTracks.length; t++) {
    const track = vTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = track.length - 1; c >= 0; c--) {
      if (selSet.has(track[c])) track.splice(c, 1);
    }
  }

  const baseClips = visualClips.slice();
  const placed = [];

  const cycleIdx = { hard: 0, med: 0, soft: 0, rest: 0 };

  for (let i = 0; i < timelineBeats.length; i++) {
    const beat = timelineBeats[i];
    const beatTime = beat.time;
    const nextBeatTime = (i + 1 < timelineBeats.length)
      ? timelineBeats[i + 1].time
      : audioEnd;

    let dur = nextBeatTime - beatTime;
    if (!Number.isFinite(dur) || dur <= 0.01) dur = 0.5;
    if (beatTime + dur > audioEnd) dur = Math.max(0.15, audioEnd - beatTime);

    const srcClip = baseClips[i % baseClips.length];
    let clipToPlace;
    if (i < baseClips.length) clipToPlace = srcClip;
    else clipToPlace = deepCloneClip(srcClip);

    clipToPlace.startTime = beatTime;
    clipToPlace.duration = dur;
    clipToPlace.__trimmed = true;

    let level;
    if (beat.strength >= HARD_THR) level = 'hard';
    else if (beat.strength >= SOFT_THR) level = 'med';
    else level = 'soft';

    let group = groups[level];
    let groupKey = level;
    if (!group || !group.length) {
      group = groups.rest;
      groupKey = 'rest';
    }
    if (!group || !group.length) {
      group = [['shake']];
      groupKey = 'fallback';
    }

    if (cycleIdx[groupKey] === undefined) cycleIdx[groupKey] = 0;
    const patternArr = group[cycleIdx[groupKey] % group.length];
    cycleIdx[groupKey]++;

    placed.push({
      clip: clipToPlace,
      beatTime,
      duration: dur,
      beatIndex: i,
      level,
      effects: patternArr
    });

    srcTrack.push(clipToPlace);
  }

  srcTrack.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  let effectTrackIdx = -1;
  for (let t = srcTrackIdx + 1; t < vTracks.length; t++) {
    if (Array.isArray(vTracks[t]) && vTracks[t].length === 0) {
      effectTrackIdx = t;
      break;
    }
  }
  if (effectTrackIdx < 0) {
    vTracks.splice(srcTrackIdx + 1, 0, []);
    effectTrackIdx = srcTrackIdx + 1;
  }
  const effectTrack = vTracks[effectTrackIdx];

  const stamp = Date.now();
  let effectCount = 0;

  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    if (!p.effects || !p.effects.length) continue;

    for (let k = 0; k < p.effects.length; k++) {
      const key = p.effects[k];
      const fxId = 'fx-' + stamp + '-' + i + '-' + k + '-' + Math.random().toString(36).slice(2, 5);
      const fxState = buildEffectStateForKey(key);

      effectTrack.push({
        name: capitalize(key),
        url: 'effect://' + fxId,
        type: 'effect/plain',
        __effectId: fxId,
        effectState: fxState,
        startTime: p.beatTime,
        duration: p.duration,
        sourceIn: 0,
        __trimmed: true,
        __beatLevel: p.level
      });
      effectCount++;
    }
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));

  return {
    ok: true,
    beatsCount: timelineBeats.length,
    clipsPlaced: placed.length,
    effectsApplied: effectCount,
    effectTrack: 'V' + (effectTrackIdx + 1)
  };
}

// ═══════════════════════════════════════════════════════════════
//  BEAT MARKERS
// ═══════════════════════════════════════════════════════════════
const BEAT_CSS_ID = 'beat-marker-styles';
function injectBeatMarkerStyles() {
  if (document.getElementById(BEAT_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = BEAT_CSS_ID;
  s.textContent = `
    .beat-marker-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 24;
    }
    .beat-marker {
      position: absolute;
      bottom: 2px;
      width: 10px;
      height: 10px;
      background: #ff0066;
      border: 1.5px solid #fff;
      border-radius: 50%;
      transform: translateX(-50%);
      box-shadow: 0 0 5px rgba(255, 0, 102, 0.9);
      pointer-events: none;
      box-sizing: border-box;
    }
    .beat-marker-strong {
      background: #ffcc00;
      box-shadow: 0 0 6px rgba(255, 204, 0, 0.95);
    }
    .beat-marker-count {
      position: absolute;
      top: 2px;
      right: 4px;
      background: rgba(255, 0, 102, 0.9);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 8px;
      letter-spacing: 0.02em;
      pointer-events: none;
      z-index: 25;
    }
  `;
  document.head.appendChild(s);
}

let beatMarkerRafPending = false;
function scheduleBeatMarkers() {
  if (beatMarkerRafPending) return;
  beatMarkerRafPending = true;
  requestAnimationFrame(() => {
    beatMarkerRafPending = false;
    renderBeatMarkers();
  });
}

function renderBeatMarkers() {
  injectBeatMarkerStyles();
  document.querySelectorAll('.beat-marker-layer').forEach(n => n.remove());
  document.querySelectorAll('.beat-marker-count').forEach(n => n.remove());

  const appState = window.__appState;
  if (!appState) return;
  const aTracks = appState.timeline.audio || [];

  for (let t = 0; t < aTracks.length; t++) {
    const track = aTracks[t];
    if (!Array.isArray(track)) continue;

    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !Array.isArray(clip.__beats) || !clip.__beats.length) continue;

      const clipEl = document.querySelector(
        '.clip[data-track="A' + (t + 1) + '"][data-clip="' + c + '"]'
      );
      if (!clipEl) continue;

      const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const clipDur = Number.isFinite(clip.duration) ? clip.duration : 0;
      const clipSourceIn = Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0;
      if (clipDur <= 0) continue;

      let maxStrength = 0;
      for (const b of clip.__beats) {
        if (Number.isFinite(b.strength) && b.strength > maxStrength) maxStrength = b.strength;
      }

      const layer = document.createElement('div');
      layer.className = 'beat-marker-layer';

      for (const b of clip.__beats) {
        const relTime = b.time - clipSourceIn;
        if (relTime < 0 || relTime > clipDur) continue;
        const pct = relTime / clipDur;

        const m = document.createElement('span');
        m.className = 'beat-marker';
        if (maxStrength > 0 && Number.isFinite(b.strength)) {
          const norm = b.strength / maxStrength;
          if (norm > 0.75) m.classList.add('beat-marker-strong');
        }
        m.style.left = (pct * 100) + '%';
        m.title = 'Beat @ ' + (clipStart + relTime).toFixed(2) + 's';
        layer.appendChild(m);
      }

      clipEl.appendChild(layer);

      const badge = document.createElement('span');
      badge.className = 'beat-marker-count';
      badge.textContent = '🥁 ' + clip.__beats.length;
      clipEl.appendChild(badge);
    }
  }
}

// Auto-install listeners
(function autoInstallBeatMarkers() {
  if (typeof document === 'undefined') return;
  const install = () => {
    document.addEventListener('editor:timeline-changed', scheduleBeatMarkers);
    document.addEventListener('timeline:scale-changed', scheduleBeatMarkers);
    document.addEventListener('beats:changed', scheduleBeatMarkers);
    requestAnimationFrame(() => scheduleBeatMarkers());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();