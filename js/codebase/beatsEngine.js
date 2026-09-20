// ================================================================
//  js/codebase/beatsEngine.js
//  Beat detection + beats-driven layer editing + beat markers.
//
//  Commands:
//    detect beats        → analyze selected audio clip, save beat times
//    beats edit <fx...>  → place selected visual clips on beats +
//                          apply effect pattern cyclically
// ================================================================

const MIN_GAP_SEC = 0.25;
const FRAME_SIZE  = 1024;
const HOP_SIZE    = 512;
const PEAK_WINDOW = 20;
const PEAK_K      = 1.5;

// ═══════════════════════════════════════════════════════════════
//  AUDIO DECODE + BEAT ANALYSIS
// ═══════════════════════════════════════════════════════════════
async function decodeAudioFromUrl(url) {
  const resp = await fetch(url);
  const ab = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('AudioContext not available');
  const ac = new AC();
  let buffer;
  try {
    buffer = await ac.decodeAudioData(ab);
  } finally {
    try { ac.close(); } catch (_) {}
  }
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
  const flux = new Float32Array(energy.length);
  for (let f = 1; f < energy.length; f++) {
    const d = energy[f] - energy[f - 1];
    flux[f] = d > 0 ? d : 0;
  }
  return flux;
}

function pickPeaks(flux, sampleRate) {
  const peaks = [];
  const n = flux.length;
  if (n < PEAK_WINDOW * 2 + 1) return peaks;

  for (let f = PEAK_WINDOW; f < n - PEAK_WINDOW; f++) {
    let sum = 0, sum2 = 0;
    for (let w = f - PEAK_WINDOW; w <= f + PEAK_WINDOW; w++) {
      sum += flux[w];
      sum2 += flux[w] * flux[w];
    }
    const cnt = 2 * PEAK_WINDOW + 1;
    const mean = sum / cnt;
    const variance = sum2 / cnt - mean * mean;
    const std = Math.sqrt(Math.max(0, variance));
    const threshold = mean + PEAK_K * std;

    let isPeak = true;
    for (let k = -2; k <= 2; k++) {
      if (flux[f + k] > flux[f]) { isPeak = false; break; }
    }

    if (isPeak && flux[f] > threshold && flux[f] > 1e-4) {
      peaks.push({ time: (f * HOP_SIZE) / sampleRate, strength: flux[f] });
    }
  }
  return peaks;
}

function applyMinSpacing(peaks) {
  peaks.sort((a, b) => a.time - b.time);
  const filtered = [];
  for (const p of peaks) {
    if (!filtered.length) { filtered.push(p); continue; }
    const last = filtered[filtered.length - 1];
    if (p.time - last.time >= MIN_GAP_SEC) filtered.push(p);
    else if (p.strength > last.strength) filtered[filtered.length - 1] = p;
  }
  return filtered;
}

export async function detectBeatsFromUrl(url) {
  if (!url) throw new Error('No audio URL');
  const buffer = await decodeAudioFromUrl(url);
  const mono = downmixToMono(buffer);
  const energy = computeEnergyFrames(mono);
  const flux = computeOnsetFlux(energy);
  const peaks = pickPeaks(flux, buffer.sampleRate);
  return applyMinSpacing(peaks);
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION HELPERS
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

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Run detect beats
// ═══════════════════════════════════════════════════════════════
export async function runDetectBeats() {
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

  if (!beats.length) return { ok: false, error: 'No beats detected in audio' };

  audioClip.__beats = beats.map(b => ({ time: b.time, strength: b.strength }));
  audioClip.__beatsDetectedAt = Date.now();

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('beats:changed'));

  // Force marker re-render
  scheduleBeatMarkers();

  return {
    ok: true,
    beatsCount: beats.length,
    clipName: audioClip.name || 'Audio'
  };
}

// ═══════════════════════════════════════════════════════════════
//  DEEP CLONE
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  EFFECT STATE BUILDER
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
  dreamy:    { brightness: 105, contrast: 92, saturation: 105, blur: 0.6 }
};

function buildEffectStateForKey(key) {
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
//  PUBLIC — Run beats editing
// ═══════════════════════════════════════════════════════════════
export async function runBeatsEditing(patternKeys) {
  const appState = window.__appState;
  if (!appState) return { ok: false, error: 'App state missing' };

  const audioClip = findAudioClipWithBeats();
  if (!audioClip) {
    return { ok: false, error: 'No audio with beats. Run "detect beats" on an audio clip first.' };
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
  if (!visualClips.length) {
    return { ok: false, error: 'No video/image clips selected' };
  }

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
    if (t >= audioStart - 0.001 && t < audioEnd) timelineBeats.push(t);
  }
  timelineBeats.sort((a, b) => a - b);

  if (!timelineBeats.length) {
    return { ok: false, error: 'No beats fall inside the audio clip range' };
  }

  let avgGap;
  if (timelineBeats.length > 1) {
    let sum = 0;
    for (let i = 1; i < timelineBeats.length; i++) sum += timelineBeats[i] - timelineBeats[i - 1];
    avgGap = sum / (timelineBeats.length - 1);
  } else {
    avgGap = audioDur || 3;
  }
  const clipDur = Math.max(0.15, avgGap);

  // Remove selected visual clips from ALL visual tracks
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
  for (let i = 0; i < timelineBeats.length; i++) {
    const beatTime = timelineBeats[i];
    const srcClip = baseClips[i % baseClips.length];

    let clipToPlace;
    if (i < baseClips.length) clipToPlace = srcClip;
    else clipToPlace = deepCloneClip(srcClip);

    clipToPlace.startTime = beatTime;
    let dur = clipDur;
    if (beatTime + dur > audioEnd) dur = Math.max(0.15, audioEnd - beatTime);
    clipToPlace.duration = dur;
    clipToPlace.__trimmed = true;

    placed.push({ clip: clipToPlace, beatTime: beatTime, beatIndex: i });
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

  const pattern = (Array.isArray(patternKeys) && patternKeys.length > 0)
    ? patternKeys
    : ['shake'];

  const stamp = Date.now();
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const key = pattern[i % pattern.length];

    const fxId = 'fx-' + stamp + '-' + i + '-' + Math.random().toString(36).slice(2, 6);
    const fxState = buildEffectStateForKey(key);

    effectTrack.push({
      name: capitalize(key),
      url: 'effect://' + fxId,
      type: 'effect/plain',
      __effectId: fxId,
      effectState: fxState,
      startTime: p.beatTime,
      duration: p.clip.duration,
      sourceIn: 0,
      __trimmed: true
    });
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));

  return {
    ok: true,
    beatsCount: timelineBeats.length,
    clipsPlaced: placed.length,
    effectsApplied: placed.length,
    effectTrack: 'V' + (effectTrackIdx + 1)
  };
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════════════════════
//  🆕 BEAT MARKERS (on audio clip in timeline)
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
      box-shadow: 0 0 5px rgba(255, 0, 102, 0.9), 0 0 2px rgba(255,0,102,1);
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

  // Remove old
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

      // Find max strength for normalization
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

      // Count badge
      const badge = document.createElement('span');
      badge.className = 'beat-marker-count';
      badge.textContent = '🥁 ' + clip.__beats.length;
      clipEl.appendChild(badge);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  🆕 AUTO-INSTALL BEAT MARKER LISTENERS
//  Runs on module import — no app.js change needed.
// ═══════════════════════════════════════════════════════════════
(function autoInstallBeatMarkers() {
  if (typeof document === 'undefined') return;

  const install = () => {
    document.addEventListener('editor:timeline-changed', scheduleBeatMarkers);
    document.addEventListener('timeline:scale-changed', scheduleBeatMarkers);
    document.addEventListener('beats:changed', scheduleBeatMarkers);
    // Initial render
    requestAnimationFrame(() => scheduleBeatMarkers());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();