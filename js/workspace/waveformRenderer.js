// ================================================================
//  js/workspace/waveformRenderer.js
//  Renders audio waveform inside each audio clip on the timeline.
//  Supports BOTH:
//    1. Direct audio imports (music, SFX, voice)
//    2. Auto-generated audio linked to video clips
//       (URL points to the video file — Web Audio extracts the audio)
// ================================================================

const CSS_ID = 'waveform-renderer-styles';
const RESOLUTION = 3000;

const CACHE   = new Map(); // url -> { peaks: Float32Array, duration } | null
const PENDING = new Map(); // url -> Promise

// ─── CSS ─────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .clip-audio-waveform {
      position: absolute;
      left: 0; top: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      display: block;
    }
    .clip-audio-waveform-bg {
      fill: rgba(0, 0, 0, 0.35);
    }
    .clip-label {
      position: relative;
      z-index: 2;
      display: block;
      padding: 3px 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
      text-shadow:
        0 1px 2px rgba(0,0,0,0.95),
        0 0 4px rgba(0,0,0,0.85),
        0 0 8px rgba(0,0,0,0.6);
    }
  `;
  document.head.appendChild(s);
}

// ─── Decode audio + extract peaks (cached) ──────────────────
async function decodeWaveform(url) {
  if (CACHE.has(url)) return CACHE.get(url);
  if (PENDING.has(url)) return PENDING.get(url);

  const p = (async () => {
    try {
      const resp = await fetch(url);
      const ab = await resp.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        console.warn('[waveform] no AudioContext');
        return null;
      }

      const ac = new AC();
      let buf;
      try {
        buf = await ac.decodeAudioData(ab);
      } finally {
        try { ac.close(); } catch (_) {}
      }

      const peaks = new Float32Array(RESOLUTION * 2);
      const numCh = buf.numberOfChannels;
      const len = buf.length;
      const chans = [];
      for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));

      for (let i = 0; i < RESOLUTION; i++) {
        const start = Math.floor((i * len) / RESOLUTION);
        const end = Math.floor(((i + 1) * len) / RESOLUTION);
        let min = 1, max = -1;
        for (let c = 0; c < numCh; c++) {
          const data = chans[c];
          for (let j = start; j < end; j++) {
            const v = data[j];
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        peaks[i * 2] = min;
        peaks[i * 2 + 1] = max;
      }

      const result = { peaks, duration: buf.duration };
      CACHE.set(url, result);
      return result;
    } catch (e) {
      console.warn('[waveform] decode failed for', String(url).slice(0, 60), e);
      CACHE.set(url, null);
      return null;
    }
  })();

  PENDING.set(url, p);
  const r = await p;
  PENDING.delete(url);
  return r;
}

// ─── Draw waveform on canvas ────────────────────────────────
function drawWaveform(clipEl, canvas, clipData, waveData) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = clipEl.offsetWidth;
  const cssH = clipEl.offsetHeight;
  if (cssW <= 2 || cssH <= 2) return;

  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  // Subtle dark background so waveform pops
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, cssW, cssH);

  const midY  = cssH / 2;

  // If no wave data → flat line only
  if (!waveData || !waveData.peaks || !waveData.duration) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(cssW, midY);
    ctx.stroke();
    return;
  }

  const clipDur   = Number.isFinite(clipData.duration) ? clipData.duration : 0;
  const sourceIn  = Number.isFinite(clipData.sourceIn) ? clipData.sourceIn : 0;
  if (clipDur <= 0) return;

  const sourceDur = waveData.duration;
  const halfH = (cssH / 2) - 3;
  if (halfH <= 0) return;

  // Center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(cssW, midY);
  ctx.stroke();

  // Waveform bars — green/cyan gradient
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0,   '#60efff');
  grad.addColorStop(0.5, '#00ff87');
  grad.addColorStop(1,   '#60efff');
  ctx.fillStyle = grad;

  ctx.beginPath();
  for (let x = 0; x < cssW; x++) {
    const pct = x / cssW;
    const relTime = sourceIn + pct * clipDur;
    if (relTime < 0 || relTime > sourceDur) continue;

    const bin = Math.floor((relTime / sourceDur) * RESOLUTION);
    if (bin < 0 || bin >= RESOLUTION) continue;

    const minV = waveData.peaks[bin * 2];
    const maxV = waveData.peaks[bin * 2 + 1];
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) continue;

    const yTop = midY - maxV * halfH;
    const yBot = midY - minV * halfH;
    const h = Math.max(1, yBot - yTop);
    ctx.rect(x, yTop, 1, h);
  }
  ctx.fill();
}

// ─── Detect if a clip should show waveform ──────────────────
function isAudioCapableClip(clipData) {
  if (!clipData) return false;
  if (clipData.__audioFxId) return false;    // FX layer → skip
  if (clipData.__soundId) return false;      // Sound FX → skip
  if (!clipData.url) return false;

  const t = clipData.type || '';
  if (t.indexOf('audio/') === 0) return true;
  if (clipData.autoGenerated === true) return true;
  if (clipData.__linkedId) return true;

  return false;
}

// ─── Per-clip processing ────────────────────────────────────
async function processAudioClip(clipEl) {
  const trackLabel = clipEl.dataset.track;
  const clipIdx = Number(clipEl.dataset.clip);
  if (!trackLabel || !Number.isFinite(clipIdx)) return;
  if (trackLabel.charAt(0) !== 'A') return;

  const appState = window.__appState;
  if (!appState) return;
  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const track = appState.timeline.audio[trackIdx];
  if (!Array.isArray(track)) return;
  const clipData = track[clipIdx];
  if (!isAudioCapableClip(clipData)) return;

  // Ensure label is wrapped in a span (so canvas sits behind it)
  if (!clipEl.querySelector('.clip-label')) {
    let textNode = null;
    for (const node of clipEl.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        textNode = node;
        break;
      }
    }
    const span = document.createElement('span');
    span.className = 'clip-label';
    span.textContent = textNode ? textNode.textContent : (clipData.name || '');
    if (textNode) textNode.replaceWith(span);
    else clipEl.insertBefore(span, clipEl.firstChild);
  }

  // Ensure canvas exists
  let canvas = clipEl.querySelector('.clip-audio-waveform');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'clip-audio-waveform';
    clipEl.insertBefore(canvas, clipEl.firstChild);
  }

    // Draw with cached data (or flat line placeholder)
  const cached = CACHE.get(clipData.url);
  drawWaveform(clipEl, canvas, clipData, cached || null);

  // If not cached → decode then redraw
  if (!cached) {
    const wave = await decodeWaveform(clipData.url);
    if (!wave) return;

    // 🆕 Stale DOM check — element may have been replaced
    if (!document.body.contains(clipEl)) return;
    const stillCanvas = clipEl.querySelector('.clip-audio-waveform');
    if (!stillCanvas) return;
    drawWaveform(clipEl, stillCanvas, clipData, wave);
  }
}
// ─── Batch processing ──────────────────────────────────────
let rafScheduled = false;
let retryTimers = [];

function processAllAudioClips() {
  // Cancel pending retries (fresh schedule)
  for (let i = 0; i < retryTimers.length; i++) clearTimeout(retryTimers[i]);
  retryTimers = [];

  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    runProcess();

    // 🆕 Multi-pass retries — catches:
    //   • first-import layout delay
    //   • async audio decode completion
    //   • video loadedmetadata → clip duration update
    [120, 350, 800, 1500, 2500].forEach(delay => {
      retryTimers.push(setTimeout(runProcess, delay));
    });
  });
}

function runProcess() {
  const clips = document.querySelectorAll('.track[data-group="audio"] .clip');
  for (let i = 0; i < clips.length; i++) {
    const el = clips[i];
    if (el.offsetWidth <= 2 || el.offsetHeight <= 2) continue;
    processAudioClip(el);
  }
}
// ─── Public init ────────────────────────────────────────────
export function initWaveformRenderer() {
  injectStyles();

  document.addEventListener('editor:timeline-changed', processAllAudioClips);
  document.addEventListener('timeline:scale-changed', processAllAudioClips);
  document.addEventListener('effects:refresh', processAllAudioClips);

  window.addEventListener('resize', processAllAudioClips);

  // Force full re-decode + redraw (for debugging)
  window.__redrawWaveforms = function () {
    CACHE.clear();
    PENDING.clear();
    processAllAudioClips();
    console.log('[waveform] cache cleared, re-processing all audio clips');
  };

  // Initial pass
  requestAnimationFrame(() => processAllAudioClips());
}