// ================================================================
//  js/features/export.js
//  Full-screen export panel + REAL render via WebCodecs.
//
//  Pipeline (fast, no realtime):
//    Source MP4 → mp4box demux → VideoDecoder → draw crop →
//      VideoEncoder → mp4-muxer → MP4 blob
//    Audio: AudioContext decode → AudioEncoder → mp4-muxer
//
//  Fallback (Firefox/Safari): MediaRecorder realtime.
// ================================================================

export const featureKey = 'export';

const FORMATS = [
  { key: 'mp4', label: 'MP4', ext: '.mp4', kind: 'video', hint: 'H.264 + AAC — fast render' },
  { key: 'mov', label: 'MOV', ext: '.mov', kind: 'video', hint: 'QuickTime (recorder fallback)' },
  { key: 'png', label: 'PNG', ext: '.png', kind: 'image', hint: 'Single frame snapshot' },
  { key: 'mp3', label: 'MP3', ext: '.mp3', kind: 'audio', hint: 'Audio layer only' }
];

const QUALITY_TIERS = [
  { key: '480p',  label: '480p (SD)',       ref: 480  },
  { key: '720p',  label: '720p (HD)',       ref: 720  },
  { key: '1080p', label: '1080p (Full HD)', ref: 1080 },
  { key: '2k',    label: '2K (QHD)',        ref: 1440 },
  { key: '4k',    label: '4K (UHD)',        ref: 2160 }
];

const FPS_OPTIONS = [24, 25, 30, 60];

const settings = {
  fileName: 'My Export',
  format: 'mp4',
  quality: '1080p',
  bitrateKbps: 10000,
  fps: 30
};

let overlayEl = null;
let isExporting = false;

// ═══════════════════════════════════════════════════════════════
//  RATIO / RESOLUTION
// ═══════════════════════════════════════════════════════════════
function getTimelineRatio() {
  const r = window.__offlineEditorRatio;
  if (r && Number.isFinite(r.w) && Number.isFinite(r.h) && r.w > 0 && r.h > 0) {
    return { key: r.key || 'custom', w: r.w, h: r.h };
  }
  return { key: 'original', w: 16, h: 9 };
}

function computeResolution(refMin, ratioW, ratioH) {
  const ar = ratioW / ratioH;
  let w, h;
  if (ar >= 1) { h = refMin; w = Math.round(refMin * ar); }
  else { w = refMin; h = Math.round(refMin / ar); }
  w = w + (w % 2);
  h = h + (h % 2);
  return { width: w, height: h };
}

function getQualityOptions() {
  const r = getTimelineRatio();
  return QUALITY_TIERS.map(function (t) {
    const res = computeResolution(t.ref, r.w, r.h);
    return {
      key: t.key,
      label: t.label,
      text: t.label + ': ' + res.width + ' × ' + res.height,
      width: res.width,
      height: res.height
    };
  });
}

function getBitrateRange(width, height) {
  const min = Math.min(width, height);
  const isPortrait = height > width;
  if (min <= 480) return [1000, 2000];
  if (min <= 720) return [3500, 5000];
  if (min <= 1080) return isPortrait ? [10000, 15000] : [8000, 12000];
  if (min <= 1440) return [16000, 24000];
  if (min <= 2160) return [35000, 55000];
  return [45000, 68000];
}

function getFormatDef(key) {
  for (let i = 0; i < FORMATS.length; i++) {
    if (FORMATS[i].key === key) return FORMATS[i];
  }
  return FORMATS[0];
}

function getCurrentQuality() {
  const opts = getQualityOptions();
  for (let i = 0; i < opts.length; i++) {
    if (opts[i].key === settings.quality) return opts[i];
  }
  return opts[2];
}

function fmtRate(kbps) {
  if (kbps >= 1000) return (kbps / 1000).toFixed(kbps % 1000 === 0 ? 0 : 1) + ' Mbps';
  return kbps + ' Kbps';
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(message, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:100000',
    'pointer-events:none','opacity:0',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit','max-width:80vw','white-space:nowrap',
    'overflow:hidden','text-overflow:ellipsis'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(function () {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(function () { el.remove(); }, 300);
  }, 1800);
}

// ═══════════════════════════════════════════════════════════════
//  COVER-FIT DRAW (works for video element OR VideoFrame)
// ═══════════════════════════════════════════════════════════════
function drawCoverFit(ctx, source, W, H) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (!source) return;

  const sw = source.displayWidth || source.videoWidth || source.naturalWidth || source.width;
  const sh = source.displayHeight || source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;

  const srcAR = sw / sh;
  const dstAR = W / H;

  let sx, sy, cw, ch;
  if (srcAR > dstAR) {
    ch = sh;
    cw = sh * dstAR;
    sx = (sw - cw) / 2;
    sy = 0;
  } else {
    cw = sw;
    ch = sw / dstAR;
    sx = 0;
    sy = (sh - ch) / 2;
  }

  try { ctx.drawImage(source, sx, sy, cw, ch, 0, 0, W, H); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'export-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = [
    '.exp-overlay{position:fixed;inset:0;z-index:99998;background:#0d0d0d;color:#fff;display:flex;flex-direction:column;font-family:inherit;overflow:hidden;}',
    '.exp-header{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#0d0d0d;border-bottom:1px solid #262626;}',
    '.exp-title{flex:1;min-width:0;font-size:16px;font-weight:700;letter-spacing:.02em;text-align:center;padding-right:44px;}',
    '.exp-close{width:40px;height:40px;border:1px solid #303030;border-radius:10px;background:#181818;color:#fff;display:grid;place-items:center;cursor:pointer;font-size:20px;flex:0 0 auto;}',
    '.exp-close:active{background:#222;}',
    '.exp-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:14px 14px 24px;box-sizing:border-box;}',
    '.exp-body *{box-sizing:border-box;}',
    '.exp-field{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:1px solid #262626;}',
    '.exp-field:last-child{border-bottom:0;}',
    '.exp-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;}',
    '.exp-help{font-size:11px;color:#6a6a6a;line-height:1.4;margin-top:-2px;}',
    '.exp-input{width:100%;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:14px;font-family:inherit;outline:none;}',
    '.exp-input:focus{border-color:#fff;}',
    '.exp-select{width:100%;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:14px;font-family:inherit;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:36px;}',
    '.exp-select:focus{border-color:#fff;}',
    '.exp-chips{display:flex;gap:8px;flex-wrap:wrap;}',
    '.exp-chip{flex:1 1 0;min-width:70px;padding:12px 10px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:background .12s ease,border-color .12s ease;}',
    '.exp-chip:active{background:#222;}',
    '.exp-chip.active{background:#fff;color:#000;border-color:#fff;}',
    '.exp-bitrate-row{display:flex;align-items:center;gap:12px;}',
    '.exp-slider{flex:1;accent-color:#fff;height:6px;cursor:pointer;min-width:0;}',
    '.exp-bitrate-value{font-size:13px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;min-width:80px;text-align:right;}',
    '.exp-bitrate-range{font-size:10px;color:#6a6a6a;font-variant-numeric:tabular-nums;display:flex;justify-content:space-between;}',
    '.exp-ratio-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;}',
    '.exp-ratio-name{font-size:14px;font-weight:700;}',
    '.exp-ratio-dims{font-size:11px;color:#8a8a8a;font-variant-numeric:tabular-nums;}',
    '.exp-footer{flex:0 0 auto;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));background:#0d0d0d;border-top:1px solid #262626;}',
    '.exp-export-btn{width:100%;padding:16px;min-height:56px;background:#fff;color:#000;border:0;border-radius:12px;font-size:15px;font-weight:800;letter-spacing:.02em;cursor:pointer;font-family:inherit;transition:opacity .15s ease;}',
    '.exp-export-btn:active{opacity:.85;}',
    '.exp-export-btn:disabled{opacity:.4;cursor:not-allowed;}',
    '.exp-progress{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;}',
    '.exp-progress-bar{width:220px;height:6px;background:#262626;border-radius:3px;overflow:hidden;}',
    '.exp-progress-fill{height:100%;background:#fff;width:0%;transition:width .15s linear;}',
    '.exp-progress-text{font-size:14px;font-weight:600;color:#fff;}',
    '.exp-progress-sub{font-size:11px;color:#8a8a8a;letter-spacing:.04em;}',
    '@media (min-width:640px){.exp-overlay{max-width:600px;margin:0 auto;border-left:1px solid #262626;border-right:1px solid #262626;}}'
  ].join('\n');
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════
export function openExportPanel() {
  if (overlayEl) return;
  injectStyles();
  overlayEl = document.createElement('div');
  overlayEl.className = 'exp-overlay';
  document.body.appendChild(overlayEl);
  renderPanel();
}

function closeExportPanel() {
  if (isExporting) return;
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
}

// ═══════════════════════════════════════════════════════════════
//  RENDER PANEL
// ═══════════════════════════════════════════════════════════════
function renderPanel() {
  if (!overlayEl) return;
  overlayEl.replaceChildren();

  const header = document.createElement('div');
  header.className = 'exp-header';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'exp-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', closeExportPanel);
  const title = document.createElement('div');
  title.className = 'exp-title';
  title.textContent = 'Export';
  header.append(closeBtn, title);
  overlayEl.appendChild(header);

  const body = document.createElement('div');
  body.className = 'exp-body';
  body.appendChild(buildFileNameField());
  body.appendChild(buildFormatField());

  const fmt = getFormatDef(settings.format);
  if (fmt.kind === 'video') {
    body.appendChild(buildQualityField());
    body.appendChild(buildBitrateField());
    body.appendChild(buildFpsField());
  } else if (fmt.kind === 'audio') {
    body.appendChild(buildAudioInfoField());
  } else if (fmt.kind === 'image') {
    body.appendChild(buildPngInfoField());
  }
  body.appendChild(buildRatioField());
  overlayEl.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'exp-footer';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'exp-export-btn';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', onExportClick);
  footer.appendChild(exportBtn);
  overlayEl.appendChild(footer);
}

function buildFileNameField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'File Name';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'exp-input';
  input.value = settings.fileName;
  input.addEventListener('input', function () { settings.fileName = input.value; });
  field.append(label, input);
  return field;
}

function buildFormatField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Format';
  const chips = document.createElement('div');
  chips.className = 'exp-chips';
  FORMATS.forEach(function (f) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exp-chip' + (settings.format === f.key ? ' active' : '');
    btn.textContent = f.label;
    btn.addEventListener('click', function () {
      if (settings.format === f.key) return;
      settings.format = f.key;
      renderPanel();
    });
    chips.appendChild(btn);
  });
  const hint = document.createElement('div');
  hint.className = 'exp-help';
  hint.textContent = getFormatDef(settings.format).hint;
  field.append(label, chips, hint);
  return field;
}

function buildQualityField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Quality';
  const select = document.createElement('select');
  select.className = 'exp-select';
  const opts = getQualityOptions();
  opts.forEach(function (q) {
    const option = document.createElement('option');
    option.value = q.key;
    option.textContent = q.text;
    if (settings.quality === q.key) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', function () {
    settings.quality = select.value;
    const q = getCurrentQuality();
    const range = getBitrateRange(q.width, q.height);
    settings.bitrateKbps = Math.round((range[0] + range[1]) / 2);
    renderPanel();
  });
  field.append(label, select);
  return field;
}

function buildBitrateField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const q = getCurrentQuality();
  const range = getBitrateRange(q.width, q.height);
  if (settings.bitrateKbps < range[0]) settings.bitrateKbps = range[0];
  if (settings.bitrateKbps > range[1]) settings.bitrateKbps = range[1];

  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Bitrate';

  const row = document.createElement('div');
  row.className = 'exp-bitrate-row';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'exp-slider';
  slider.min = String(range[0]);
  slider.max = String(range[1]);
  slider.step = '100';
  slider.value = String(settings.bitrateKbps);
  const value = document.createElement('div');
  value.className = 'exp-bitrate-value';
  value.textContent = fmtRate(settings.bitrateKbps);
  slider.addEventListener('input', function () {
    settings.bitrateKbps = parseInt(slider.value, 10);
    value.textContent = fmtRate(settings.bitrateKbps);
  });
  row.append(slider, value);

  const rangeHint = document.createElement('div');
  rangeHint.className = 'exp-bitrate-range';
  const minSpan = document.createElement('span');
  minSpan.textContent = fmtRate(range[0]);
  const maxSpan = document.createElement('span');
  maxSpan.textContent = fmtRate(range[1]);
  rangeHint.append(minSpan, maxSpan);

  field.append(label, row, rangeHint);
  return field;
}

function buildFpsField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Frame Rate';
  const chips = document.createElement('div');
  chips.className = 'exp-chips';
  FPS_OPTIONS.forEach(function (fps) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exp-chip' + (settings.fps === fps ? ' active' : '');
    btn.textContent = fps + ' fps';
    btn.addEventListener('click', function () {
      settings.fps = fps;
      const all = chips.querySelectorAll('.exp-chip');
      for (let i = 0; i < all.length; i++) all[i].classList.remove('active');
      btn.classList.add('active');
    });
    chips.appendChild(btn);
  });
  field.append(label, chips);
  return field;
}

function buildAudioInfoField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Audio Export';
  const help = document.createElement('div');
  help.className = 'exp-help';
  help.textContent = 'Exports only the audio layer (A1, A2, …) from the timeline.';
  field.append(label, help);
  return field;
}

function buildPngInfoField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Frame Snapshot';
  const help = document.createElement('div');
  help.className = 'exp-help';
  help.textContent = 'Exports the current frame at the selected ratio and resolution.';
  field.append(label, help);
  return field;
}

function buildRatioField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Aspect Ratio';

  const r = getTimelineRatio();
  const g = gcd(r.w, r.h);
  const q = getCurrentQuality();

  const box = document.createElement('div');
  box.className = 'exp-ratio-box';
  const left = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'exp-ratio-name';
  name.textContent = (r.w / g) + ':' + (r.h / g);
  const dims = document.createElement('div');
  dims.className = 'exp-ratio-dims';
  dims.textContent = q.width + ' × ' + q.height + ' px';
  left.append(name, dims);
  const right = document.createElement('div');
  right.style.cssText = 'font-size:11px;color:#8a8a8a;letter-spacing:.04em;text-transform:uppercase;';
  right.textContent = 'From timeline';
  box.append(left, right);

  const help = document.createElement('div');
  help.className = 'exp-help';
  help.textContent = 'Rendered at this ratio — anything outside is cropped.';

  field.append(label, box, help);
  return field;
}

// ═══════════════════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════════════════
let progressEl = null;

function showProgress(progress, text, sub) {
  if (!progressEl) {
    progressEl = document.createElement('div');
    progressEl.className = 'exp-progress';
    progressEl.innerHTML =
      '<div class="exp-progress-text"></div>' +
      '<div class="exp-progress-bar"><div class="exp-progress-fill"></div></div>' +
      '<div class="exp-progress-sub"></div>';
    document.body.appendChild(progressEl);
  }
  isExporting = true;
  progressEl.querySelector('.exp-progress-text').textContent = text || '';
  progressEl.querySelector('.exp-progress-sub').textContent = sub || '';
  progressEl.querySelector('.exp-progress-fill').style.width = Math.round(progress * 100) + '%';
}

function hideProgress() {
  isExporting = false;
  if (progressEl) { progressEl.remove(); progressEl = null; }
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT ROUTER
// ═══════════════════════════════════════════════════════════════
function onExportClick() {
  if (isExporting) return;
  const fmt = getFormatDef(settings.format);
  const name = (settings.fileName || 'Export').replace(/[\\/:*?"<>|]+/g, '_');
  if (fmt.kind === 'image') return exportPng(name + fmt.ext);
  if (fmt.kind === 'audio') return exportAudio(name + fmt.ext);
  return exportVideo(name + fmt.ext, fmt);
}

// ─── PNG ───────────────────────────────────────────────────────
async function exportPng(filename) {
  const videoEl = document.querySelector('#preview-video');
  if (!videoEl || !videoEl.src) { showToast('Load a video first', false); return; }

  const q = getCurrentQuality();
  showProgress(0, 'Capturing frame…');

  const canvas = document.createElement('canvas');
  canvas.width = q.width;
  canvas.height = q.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  drawCoverFit(ctx, videoEl, q.width, q.height);

  try {
    const blob = await new Promise(function (res, rej) {
      canvas.toBlob(function (b) { b ? res(b) : rej(new Error('null')); }, 'image/png');
    });
    hideProgress();
    const saved = await saveBlob(blob, filename);
    if (saved) showToast('Saved ' + filename);
  } catch (e) {
    hideProgress();
    showToast('Export failed', false);
  }
}

// ─── AUDIO ─────────────────────────────────────────────────────
async function exportAudio(filename) {
  const audioEl = document.querySelector('#preview-audio');
  if (!audioEl || !audioEl.src) { showToast('No audio layer found', false); return; }
  if (!audioEl.captureStream) { showToast('Audio capture not supported', false); return; }

  const duration = Number.isFinite(audioEl.duration) ? audioEl.duration : 10;
  const stream = audioEl.captureStream();

  let mime = '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
  else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';

  const chunks = [];
  let recorder;
  try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
  catch (e) { showToast('Audio recording failed', false); return; }
  recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };

  showProgress(0, 'Recording audio…');
  const startedAt = performance.now();
  try { audioEl.currentTime = 0; } catch (_) {}
  try { await audioEl.play(); } catch (_) {}
  recorder.start(200);

  const tick = function () {
    const elapsed = (performance.now() - startedAt) / 1000;
    const p = Math.min(1, elapsed / Math.max(0.5, duration));
    showProgress(p, 'Recording audio… ' + Math.round(p * 100) + '%');
    if (audioEl.ended || elapsed >= duration + 0.3) {
      if (recorder.state === 'recording') recorder.stop();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  recorder.onstop = async function () {
    try { audioEl.pause(); } catch (_) {}
    const blob = new Blob(chunks, { type: mime || 'audio/webm' });
    hideProgress();
    const saved = await saveBlob(blob, filename);
    if (saved) showToast('Saved ' + filename);
  };
}

// ═══════════════════════════════════════════════════════════════
//  VIDEO — Fast render via WebCodecs, fallback to recorder
// ═══════════════════════════════════════════════════════════════
async function exportVideo(filename, fmt) {
  const videoEl = document.querySelector('#preview-video');
  if (!videoEl || !videoEl.src) { showToast('Load a video first', false); return; }

  // Only MP4 gets fast render. MOV falls back to recorder.
  if (fmt.key !== 'mp4') {
    return exportVideoRecorder(filename, fmt);
  }

  // WebCodecs support check
  const hasWebCodecs = typeof VideoEncoder !== 'undefined' &&
                       typeof VideoDecoder !== 'undefined' &&
                       typeof AudioEncoder !== 'undefined' &&
                       typeof AudioData !== 'undefined';

  if (!hasWebCodecs) {
    showToast('Using recorder (WebCodecs unavailable)');
    return exportVideoRecorder(filename, fmt);
  }

  try {
    await exportVideoFast(filename);
  } catch (e) {
    console.error('Fast render failed:', e);
    showToast('Falling back to recorder…', false);
    await sleep(400);
    return exportVideoRecorder(filename, fmt);
  }
}

// ─── FAST: mp4box + VideoDecoder + VideoEncoder + mp4-muxer ───
async function exportVideoFast(filename) {
  // 1. Load libraries
  const MP4Box = await loadMP4Box();
  const muxerMod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm');
  const Muxer = muxerMod.Muxer;
  const ArrayBufferTarget = muxerMod.ArrayBufferTarget;

  const videoEl = document.querySelector('#preview-video');
  const q = getCurrentQuality();
  const W = q.width;
  const H = q.height;
  const fps = Number(settings.fps) || 30;
  const bitrateBps = (settings.bitrateKbps || 10000) * 1000;

  // 2. Fetch source MP4
  showProgress(0.02, 'Reading source…', 'Fetching file');
  const resp = await fetch(videoEl.src);
  const sourceAB = await resp.arrayBuffer();
  sourceAB.fileStart = 0;

  // 3. Parse container
  const mp4box = MP4Box.createFile();
  let videoTrackInfo = null;
  let audioTrackInfo = null;
  let duration = 0;

  const setupPromise = new Promise(function (resolve, reject) {
    mp4box.onError = function (e) { reject(new Error('mp4box: ' + e)); };
    mp4box.onReady = function (info) {
      duration = info.duration / info.timescale;
      videoTrackInfo = info.videoTracks[0] || null;
      audioTrackInfo = info.audioTracks[0] || null;
      if (!videoTrackInfo) { reject(new Error('No video track')); return; }
      resolve();
    };
    mp4box.appendBuffer(sourceAB);
    mp4box.flush();
  });
  await setupPromise;

  // 4. Get AVC description (avcC) for the decoder
  const decoderConfig = {
    codec: videoTrackInfo.codec,
    codedWidth: videoTrackInfo.track_width,
    codedHeight: videoTrackInfo.track_height,
    description: getDecoderDescription(mp4box, videoTrackInfo.id, MP4Box),
    optimizeForLatency: true
  };

  // 5. Setup muxer
  const target = new ArrayBufferTarget();
  const muxerOpts = {
    target: target,
    fastStart: 'in-memory',
    video: { codec: 'avc', width: W, height: H },
    firstTimestampBehavior: 'offset'
  };
  const hasAudio = !!audioTrackInfo;
  if (hasAudio) {
    muxerOpts.audio = {
      codec: 'aac',
      numberOfChannels: 2,
      sampleRate: 48000
    };
  }
  const muxer = new Muxer(muxerOpts);

  // 6. Setup video encoder
  let frameCount = 0;
  const keyFrameEvery = Math.max(1, Math.round(fps * 2));
  let encoderError = null;

  const videoEncoder = new VideoEncoder({
    output: function (chunk, meta) {
      try { muxer.addVideoChunk(chunk, meta); } catch (e) { console.warn(e); }
    },
    error: function (e) { encoderError = e; console.error('VideoEncoder', e); }
  });
  videoEncoder.configure({
    codec: 'avc1.4d0028',
    width: W,
    height: H,
    bitrate: bitrateBps,
    framerate: fps,
    latencyMode: 'quality'
  });

  // 7. Setup canvas
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  // 8. Setup video decoder
  let decodeQueueCount = 0;
  const decoder = new VideoDecoder({
    output: function (frame) {
      decodeQueueCount--;
      try {
        drawCoverFit(ctx, frame, W, H);
        const exportFrame = new VideoFrame(canvas, {
          timestamp: frame.timestamp,
          duration: frame.duration || Math.round(1e6 / fps)
        });
        const needKey = (frameCount % keyFrameEvery) === 0;
        videoEncoder.encode(exportFrame, { keyFrame: needKey });
        exportFrame.close();
        frameCount++;

        const p = Math.min(1, (frame.timestamp / 1e6) / Math.max(0.1, duration));
        showProgress(0.05 + p * 0.9, 'Rendering… ' + Math.round(p * 100) + '%',
                     'Frame ' + frameCount);
      } catch (e) { console.warn(e); }
    },
    error: function (e) { console.error('VideoDecoder', e); }
  });

  try {
    decoder.configure(decoderConfig);
  } catch (e) {
    // Try without description (some codecs don't need it)
    delete decoderConfig.description;
    decoder.configure(decoderConfig);
  }

  // 9. Extract video samples and feed decoder
  const videoSamples = [];
  const samplesDone = new Promise(function (resolve) {
    mp4box.onSamples = function (trackId, user, samples) {
      if (trackId !== videoTrackInfo.id) return;
      for (let i = 0; i < samples.length; i++) videoSamples.push(samples[i]);
    };
    // Signal completion after we've flushed everything
    // (mp4box flushes all onSamples synchronously on start+flush)
    setTimeout(resolve, 0);
  });

  mp4box.setExtractionOptions(videoTrackInfo.id, null, { nbSamples: 1000 });
  mp4box.start();
  await samplesDone;

  // Feed video samples in DTS order (mp4box gives them in sample order = DTS)
  for (let i = 0; i < videoSamples.length; i++) {
    const s = videoSamples[i];
    if (decoder.state === 'closed') break;
    try {
      decoder.decode(new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: Math.round((s.cts * 1e6) / s.timescale),
        duration: Math.round((s.duration * 1e6) / s.timescale),
        data: s.data
      }));
      decodeQueueCount++;
    } catch (e) { console.warn('decode error', e); }
  }

  // 10. Audio (decode via AudioContext)
  if (hasAudio) {
    try {
      await encodeAudioFromURL(videoEl.src, muxer, audioTrackInfo);
    } catch (e) {
      console.warn('Audio pipeline failed, exporting silent video:', e);
    }
  }

  // 11. Wait for decoder to drain
  showProgress(0.96, 'Finalizing…', 'Flushing decoders');
  try { await decoder.flush(); } catch (_) {}
  try { decoder.close(); } catch (_) {}

  // 12. Wait for encoder to drain
  try { await videoEncoder.flush(); } catch (_) {}
  try { videoEncoder.close(); } catch (_) {}

  if (encoderError) throw encoderError;

  // 13. Finalize muxer
  showProgress(0.99, 'Writing file…', 'Muxing');
  muxer.finalize();
  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });

  hideProgress();
  const saved = await saveBlob(blob, filename);
  if (saved) showToast('Saved ' + filename);
}

// ─── Audio: decode source → AudioEncoder → muxer ──────────────
async function encodeAudioFromURL(url, muxer, audioTrackInfo) {
  const resp = await fetch(url);
  const ab = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let audioBuffer;
  try {
    audioBuffer = await ac.decodeAudioData(ab);
  } catch (e) {
    try { ac.close(); } catch (_) {}
    throw e;
  }
  try { ac.close(); } catch (_) {}

  const targetRate = 48000;
  const numCh = Math.min(2, audioBuffer.numberOfChannels || 1);
  const srcRate = audioBuffer.sampleRate;

  const audioEncoder = new AudioEncoder({
    output: function (chunk, meta) {
      try { muxer.addAudioChunk(chunk, meta); } catch (e) { console.warn(e); }
    },
    error: function (e) { console.warn('AudioEncoder', e); }
  });
  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: targetRate,
    numberOfChannels: numCh,
    bitrate: 128000
  });

  // Feed PCM in 1024-frame chunks
  const chunkFrames = 1024;
  const total = audioBuffer.length;
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));

  let offset = 0;
  while (offset < total) {
    const len = Math.min(chunkFrames, total - offset);
    const planar = new Float32Array(len * numCh);

    for (let c = 0; c < numCh; c++) {
      const src = channels[c];
      const dstOffset = c * len;
      for (let i = 0; i < len; i++) {
        if (srcRate === targetRate) {
          planar[dstOffset + i] = src[offset + i] || 0;
        } else {
          // Linear resample
          const srcIdx = (offset + i) * (srcRate / targetRate);
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(total - 1, i0 + 1);
          const frac = srcIdx - i0;
          planar[dstOffset + i] = (src[i0] || 0) * (1 - frac) + (src[i1] || 0) * frac;
        }
      }
    }

    try {
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate: targetRate,
        numberOfFrames: len,
        numberOfChannels: numCh,
        timestamp: Math.round((offset / srcRate) * 1e6),
        data: planar
      });
      audioEncoder.encode(ad);
      ad.close();
    } catch (e) { console.warn('audio chunk', e); }

    offset += len;
  }

  try { await audioEncoder.flush(); } catch (_) {}
  try { audioEncoder.close(); } catch (_) {}
}

// ─── Get AVC/HVC codec description from mp4box ────────────────
function getDecoderDescription(mp4box, trackId, MP4Box) {
  try {
    const trak = mp4box.getTrackById(trackId);
    if (!trak || !trak.mdia || !trak.mdia.minf || !trak.mdia.minf.stbl) return undefined;
    const stsd = trak.mdia.minf.stbl.stsd;
    for (let i = 0; i < stsd.entries.length; i++) {
      const entry = stsd.entries[i];
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const DS = MP4Box.DataStream || (MP4Box.default && MP4Box.default.DataStream);
        if (!DS) return undefined;
        const stream = new DS(undefined, 0, DS.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer.slice(8));
      }
    }
  } catch (e) { console.warn('description extraction failed', e); }
  return undefined;
}

// ─── Load mp4box.js from CDN (UMD) ────────────────────────────
let mp4boxLoadPromise = null;
function loadMP4Box() {
  if (window.MP4Box) return Promise.resolve(window.MP4Box);
  if (mp4boxLoadPromise) return mp4boxLoadPromise;
  mp4boxLoadPromise = new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
    s.onload = function () {
      if (window.MP4Box) resolve(window.MP4Box);
      else reject(new Error('MP4Box not found after load'));
    };
    s.onerror = function () { reject(new Error('MP4Box load failed')); };
    document.head.appendChild(s);
  });
  return mp4boxLoadPromise;
}

// ─── FALLBACK: MediaRecorder realtime ─────────────────────────
async function exportVideoRecorder(filename, fmt) {
  const videoEl = document.querySelector('#preview-video');
  const audioEl = document.querySelector('#preview-audio');
  if (!videoEl || !videoEl.src) { showToast('Load a video first', false); return; }

  const q = getCurrentQuality();
  const W = q.width;
  const H = q.height;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = W;
  exportCanvas.height = H;
  const ectx = exportCanvas.getContext('2d', { alpha: false });
  drawCoverFit(ectx, videoEl, W, H);

  const fps = Number(settings.fps) || 30;
  const stream = exportCanvas.captureStream(fps);

  let audioTracks = [];
  try {
    if (videoEl.captureStream) audioTracks = audioTracks.concat(videoEl.captureStream().getAudioTracks());
  } catch (_) {}
  if (audioEl && audioEl.src && audioEl.captureStream) {
    try { audioTracks = audioTracks.concat(audioEl.captureStream().getAudioTracks()); } catch (_) {}
  }
  for (let i = 0; i < audioTracks.length; i++) {
    try { stream.addTrack(audioTracks[i]); } catch (_) {}
  }

  let mime = '';
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (let i = 0; i < candidates.length; i++) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported(candidates[i])) { mime = candidates[i]; break; }
  }

  let recorder;
  try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
  catch (e) { showToast('Recording failed', false); return; }

  const chunks = [];
  recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };

  try { videoEl.pause(); } catch (_) {}
  try { videoEl.currentTime = 0; } catch (_) {}
  try { videoEl.playbackRate = 1; } catch (_) {}

  showProgress(0, 'Preparing…');
  await new Promise(function (r) {
    const onSeek = function () { videoEl.removeEventListener('seeked', onSeek); r(); };
    videoEl.addEventListener('seeked', onSeek, { once: true });
    setTimeout(r, 500);
  });

  let drawRaf = null;
  const drawLoop = function () { drawCoverFit(ectx, videoEl, W, H); drawRaf = requestAnimationFrame(drawLoop); };
  drawRaf = requestAnimationFrame(drawLoop);

  recorder.start(200);
  try { await videoEl.play(); } catch (_) {}

  const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : 10;
  const startedAt = performance.now();

  const tick = function () {
    const elapsed = (performance.now() - startedAt) / 1000;
    const p = Math.min(1, elapsed / Math.max(0.5, duration));
    showProgress(p, 'Recording… ' + Math.round(p * 100) + '%');
    if (videoEl.ended || elapsed >= duration + 0.5) {
      if (recorder.state === 'recording') recorder.stop();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  recorder.onstop = async function () {
    if (drawRaf) { cancelAnimationFrame(drawRaf); drawRaf = null; }
    try { videoEl.pause(); } catch (_) {}
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    hideProgress();
    const saved = await saveBlob(blob, filename);
    if (saved) showToast('Saved ' + filename);
  };
}

// ═══════════════════════════════════════════════════════════════
//  SAVE BLOB
// ═══════════════════════════════════════════════════════════════
async function saveBlob(blob, filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: buildPickerTypes(filename)
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  } catch (e) { console.warn(e); return false; }
}

function buildPickerTypes(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) return [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }];
  if (lower.endsWith('.mov')) return [{ description: 'QuickTime video', accept: { 'video/quicktime': ['.mov'] } }];
  if (lower.endsWith('.png')) return [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }];
  if (lower.endsWith('.mp3')) return [{ description: 'MP3 audio', accept: { 'audio/mpeg': ['.mp3'] } }];
  return undefined;
}