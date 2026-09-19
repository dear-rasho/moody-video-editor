

import { renderFrameToCanvas, preloadAllImages } from '../workspace/exportRenderer.js';
import { showError, showInfo } from '../workspace/errorNotifier.js';
import { getBuilder } from '../workspace/audioFxBuilders.js';
import { isTransitionActive } from '../workspace/transitionEngine.js';

export const featureKey = 'export';

const FORMATS = [
  { key: 'mp4', label: 'MP4', ext: '.mp4', kind: 'video', hint: 'H.264 + AAC — fast render' },
  { key: 'mov', label: 'MOV', ext: '.mov', kind: 'video', hint: 'QuickTime (recorder fallback)' },
  { key: 'png', label: 'PNG Seq', ext: '.png', kind: 'pngseq', hint: 'Numbered PNG frames' },
  { key: 'm4a', label: 'M4A', ext: '.m4a', kind: 'audio', hint: 'Audio layer only' }
];

const QUALITY_TIERS = [
  { key: '480p',  label: '480p (SD)',       ref: 480  },
  { key: '720p',  label: '720p (HD)',       ref: 720  },
  { key: '1080p', label: '1080p (Full HD)', ref: 1080 },
  { key: '2k',    label: '2K (QHD)',        ref: 1440 },
  { key: '4k',    label: '4K (UHD)',        ref: 2160 }
];

const FPS_OPTIONS = [24, 25, 30, 60];

const STORAGE_KEY = 'offline-editor-export-settings';

const settings = {
  fileName: 'My Export',
  format: 'mp4',
  quality: '1080p',
  bitrateKbps: 10000,
  fps: 30
};

let defaultDirHandle = null;

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const s = JSON.parse(saved);
    if (s.fileName) settings.fileName = s.fileName;
    if (s.format) settings.format = s.format;
    if (s.quality) settings.quality = s.quality;
    if (s.bitrateKbps) settings.bitrateKbps = s.bitrateKbps;
    if (s.fps) settings.fps = s.fps;
  }
} catch (_) {}

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
}

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
  return QUALITY_TIERS.map(t => {
    const res = computeResolution(t.ref, r.w, r.h);
    return {
      key: t.key, label: t.label,
      text: t.label + ': ' + res.width + ' × ' + res.height,
      width: res.width, height: res.height
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
//  TOAST
function showToast(message, ok) {
  if (ok === undefined) ok = true;
  // 🆕 Route errors through copyable notifier
  if (!ok) {
    showError('Export Error', message, '');
    return;
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:rgba(0,0,0,0.9)',
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:100000',
    'pointer-events:none','opacity:0',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit','max-width:80vw','white-space:nowrap'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 1800);
}
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'export-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .exp-overlay{position:fixed;inset:0;z-index:99998;background:#0d0d0d;color:#fff;display:flex;flex-direction:column;font-family:inherit;overflow:hidden;}
    .exp-header{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#0d0d0d;border-bottom:1px solid #262626;}
    .exp-title{flex:1;min-width:0;font-size:16px;font-weight:700;letter-spacing:.02em;text-align:center;padding-right:44px;}
    .exp-close{width:40px;height:40px;border:1px solid #303030;border-radius:10px;background:#181818;color:#fff;display:grid;place-items:center;cursor:pointer;font-size:20px;flex:0 0 auto;}
    .exp-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 14px 24px;box-sizing:border-box;}
    .exp-body *{box-sizing:border-box;}
    .exp-field{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:1px solid #262626;}
    .exp-field:last-child{border-bottom:0;}
    .exp-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;}
    .exp-help{font-size:11px;color:#6a6a6a;line-height:1.4;}
    .exp-input{width:100%;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:14px;font-family:inherit;outline:none;}
    .exp-input:focus{border-color:#fff;}
    .exp-select{width:100%;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:14px;font-family:inherit;outline:none;appearance:none;cursor:pointer;}
    .exp-chips{display:flex;gap:8px;flex-wrap:wrap;}
    .exp-chip{flex:1 1 0;min-width:70px;padding:12px 10px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;}
    .exp-chip.active{background:#fff;color:#000;border-color:#fff;}
    .exp-bitrate-row{display:flex;align-items:center;gap:12px;}
    .exp-slider{flex:1;accent-color:#fff;height:6px;cursor:pointer;}
    .exp-bitrate-value{font-size:13px;font-weight:700;min-width:80px;text-align:right;font-variant-numeric:tabular-nums;}
    .exp-ratio-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#181818;border:1px solid #303030;border-radius:10px;}
    .exp-ratio-name{font-size:14px;font-weight:700;}
    .exp-ratio-dims{font-size:11px;color:#8a8a8a;}
    .exp-footer{flex:0 0 auto;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));background:#0d0d0d;border-top:1px solid #262626;}
    .exp-export-btn{width:100%;padding:16px;min-height:56px;background:#fff;color:#000;border:0;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}
    .exp-export-btn:disabled{opacity:.4;cursor:not-allowed;}

    .exp-dir-row{display:flex;align-items:center;gap:10px;}
    .exp-dir-btn{flex:0 0 auto;padding:10px 14px;min-height:42px;background:#181818;border:1px solid #303030;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
    .exp-dir-path{flex:1;min-width:0;font-size:12px;color:#8a8a8a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:8px 10px;background:#181818;border:1px solid #303030;border-radius:10px;font-family:monospace;}

    .exp-progress{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;}
    .exp-progress-bar{width:220px;height:6px;background:#262626;border-radius:3px;overflow:hidden;}
    .exp-progress-fill{height:100%;background:#fff;width:0%;transition:width .15s linear;}
    .exp-progress-text{font-size:14px;font-weight:600;color:#fff;}
    .exp-progress-sub{font-size:11px;color:#8a8a8a;}
    @media (min-width:640px){.exp-overlay{max-width:600px;margin:0 auto;border-left:1px solid #262626;border-right:1px solid #262626;}}
  `;
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

function renderPanel() {
  if (!overlayEl) return;
  overlayEl.replaceChildren();

  const header = document.createElement('div');
  header.className = 'exp-header';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'exp-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeExportPanel);
  const title = document.createElement('div');
  title.className = 'exp-title';
  title.textContent = 'Export';
  header.append(closeBtn, title);
  overlayEl.appendChild(header);

  const body = document.createElement('div');
  body.className = 'exp-body';

  body.appendChild(buildLocationField());
  body.appendChild(buildFileNameField());
  body.appendChild(buildFormatField());

  const fmt = getFormatDef(settings.format);
  if (fmt.kind === 'video') {
    body.appendChild(buildQualityField());
    body.appendChild(buildBitrateField());
    body.appendChild(buildFpsField());
  } else if (fmt.kind === 'audio') {
    body.appendChild(buildAudioInfoField());
  } else if (fmt.kind === 'pngseq') {
    body.appendChild(buildQualityField());
    body.appendChild(buildFpsField());
    body.appendChild(buildPngSeqInfoField());
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

function buildLocationField() {
  const field = document.createElement('div');
  field.className = 'exp-field';

  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'Save Location';

  const row = document.createElement('div');
  row.className = 'exp-dir-row';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'exp-dir-btn';
  btn.textContent = defaultDirHandle ? '↺ Change' : '📁 Choose Folder';

  const pathEl = document.createElement('div');
  pathEl.className = 'exp-dir-path';
  pathEl.textContent = defaultDirHandle ? defaultDirHandle.name : 'Default (Downloads)';

  btn.addEventListener('click', async () => {
    if (!window.showDirectoryPicker) {
      showToast('Folder picker needs Chrome or Edge', false);
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      defaultDirHandle = handle;
      pathEl.textContent = handle.name;
      btn.textContent = '↺ Change';
      showToast('Save location: ' + handle.name);
    } catch (e) {
      if (e && e.name !== 'AbortError') showToast('Folder selection failed', false);
    }
  });

  row.append(btn, pathEl);

  const help = document.createElement('div');
  help.className = 'exp-help';
  help.textContent = defaultDirHandle
    ? 'Files will be saved to this folder'
    : 'Leave as default for downloads folder, or pick a folder';

  field.append(label, row, help);
  return field;
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
  input.addEventListener('input', () => {
    settings.fileName = input.value;
    saveSettings();
  });
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
  FORMATS.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exp-chip' + (settings.format === f.key ? ' active' : '');
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      if (settings.format === f.key) return;
      settings.format = f.key;
      saveSettings();
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
  getQualityOptions().forEach(q => {
    const option = document.createElement('option');
    option.value = q.key;
    option.textContent = q.text;
    if (settings.quality === q.key) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    settings.quality = select.value;
    const q = getCurrentQuality();
    const range = getBitrateRange(q.width, q.height);
    settings.bitrateKbps = Math.round((range[0] + range[1]) / 2);
    saveSettings();
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
  slider.addEventListener('input', () => {
    settings.bitrateKbps = parseInt(slider.value, 10);
    value.textContent = fmtRate(settings.bitrateKbps);
    saveSettings();
  });
  row.append(slider, value);

  field.append(label, row);
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
  FPS_OPTIONS.forEach(fps => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exp-chip' + (settings.fps === fps ? ' active' : '');
    btn.textContent = fps + ' fps';
    btn.addEventListener('click', () => {
      settings.fps = fps;
      saveSettings();
      chips.querySelectorAll('.exp-chip').forEach(c => c.classList.remove('active'));
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
  help.textContent = 'Exports audio from the video clip, trimmed to the same range.';
  field.append(label, help);
  return field;
}

function buildPngSeqInfoField() {
  const field = document.createElement('div');
  field.className = 'exp-field';
  const label = document.createElement('div');
  label.className = 'exp-label';
  label.textContent = 'PNG Sequence';
  const help = document.createElement('div');
  help.className = 'exp-help';
  help.textContent = 'Numbered PNG files (1.png, 2.png, …) will be written to the chosen folder.';
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

  field.append(label, box);
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
  progressEl.querySelector('.exp-progress-fill').style.width =
    Math.round(progress * 100) + '%';
}

function hideProgress() {
  isExporting = false;
  if (progressEl) { progressEl.remove(); progressEl = null; }
}

// ═══════════════════════════════════════════════════════════════
//  TIMELINE HELPERS
// ═══════════════════════════════════════════════════════════════
function computeTimelineEnd() {
  const appState = window.__appState;
  if (!appState) return 0;
  let maxEnd = 0;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip) continue;
      if (clip.__audioFxId) continue;
      if (clip.__soundId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      const end = s + d;
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

function canonicalize(u) {
  if (!u) return '';
  const s = String(u);
  const m = s.match(/blob:[^/]+\/(.+)$/);
  return m ? m[1] : s;
}

function findVideoClip(videoEl) {
  const appState = window.__appState;
  if (!appState || !videoEl) return null;
  const srcCanon = canonicalize(videoEl.currentSrc || videoEl.src || '');
  if (!srcCanon) return null;
  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip) continue;
      if (!clip.type || clip.type.indexOf('video/') !== 0) continue;
      if (canonicalize(clip.url) !== srcCanon) continue;
      return clip;
    }
  }
  return null;
}

function findClipAtTimelineTime(time) {
  const appState = window.__appState;
  if (!appState) return null;
  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.type) continue;
      if (clip.type.indexOf('video/') !== 0 && clip.type.indexOf('image/') !== 0) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) return clip;
    }
  }
  return null;
}

function hasAnyVideoSource() {
  const appState = window.__appState;
  if (!appState) return false;
  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip.type && clip.type.indexOf('video/') === 0) return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  LINKED AUDIO HELPERS
// ═══════════════════════════════════════════════════════════════
function findLinkedAudioClipForVideo(videoEl) {
  const appState = window.__appState;
  if (!appState || !videoEl) return null;

  const videoClip = findVideoClip(videoEl);
  if (!videoClip || !videoClip.__linkedId) return null;

  const linkedId = videoClip.__linkedId;
  const tracks = appState.timeline.audio || [];

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip.__linkedId === linkedId) {
        return { clip: clip, trackIndex: t };
      }
    }
  }
  return null;
}

function isLinkedAudioMuted(videoEl) {
  const appState = window.__appState;
  if (!appState) return false;

  const linked = findLinkedAudioClipForVideo(videoEl);
  if (!linked) return true;

  const mutedSet = appState.timeline.mutedAudioTracks || new Set();
  return mutedSet.has(linked.trackIndex);
}

function getAudioFxLayersInRange(rangeStart, rangeEnd) {
  const appState = window.__appState;
  if (!appState) return [];
  const result = [];
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__audioFxId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      const e = s + d;
      if (e <= rangeStart || s >= rangeEnd) continue;
      result.push({
        start: Math.max(s, rangeStart),
        end: Math.min(e, rangeEnd),
        key: clip.__audioFxKey
      });
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  CODEC CANDIDATES
// ═══════════════════════════════════════════════════════════════
function getCodecCandidates(W, H) {
  const maxDim = Math.max(W, H);
  if (maxDim <= 1920) return ['avc1.640028', 'avc1.4d0028', 'avc1.42E01E'];
  if (maxDim <= 2560) return ['avc1.640032', 'avc1.64002A', 'avc1.4d0032', 'avc1.4d0028'];
  if (maxDim <= 3840) return ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.4d0033'];
  return ['avc1.640034', 'avc1.640033'];
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT ROUTER  🆕 with image preload
// ═══════════════════════════════════════════════════════════════
async function onExportClick() {
  if (isExporting) return;
  const timelineEnd = computeTimelineEnd();
  if (timelineEnd <= 0) {
    showToast('Timeline is empty — nothing to export', false);
    return;
  }

  // 🆕 Preload images BEFORE export
  try {
    showProgress(0.01, 'Loading images…', '');
    await preloadAllImages();
  } catch (e) {
    console.warn('[export] image preload failed:', e);
  }

  const fmt = getFormatDef(settings.format);
  const name = (settings.fileName || 'Export').replace(/[\\/:*?"<>|]+/g, '_');
  if (fmt.kind === 'pngseq') return exportPngSequence(name);
  if (fmt.kind === 'audio') return exportAudio(name + fmt.ext);
  return exportVideo(name + fmt.ext, fmt);
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO ONLY
// ═══════════════════════════════════════════════════════════════
async function exportAudio(filename) {
  const videoEl = document.querySelector('#preview-video');
  if (!videoEl || !videoEl.src) { showToast('Load a video first', false); return; }

  if (isLinkedAudioMuted(videoEl)) {
    showToast('Audio track is muted — nothing to export', false);
    return;
  }

  const hasAE = typeof AudioEncoder !== 'undefined' &&
                typeof AudioData !== 'undefined' &&
                typeof AudioContext !== 'undefined';
  if (hasAE) {
    try { await exportAudioFast(filename); return; }
    catch (e) { console.warn('Audio fast failed:', e); }
  }
  showToast('Audio export needs WebCodecs', false);
}

async function exportAudioFast(filename) {
  const videoEl = document.querySelector('#preview-video');
  const clip = findVideoClip(videoEl);
  const sourceIn = clip ? (Number.isFinite(clip.sourceIn) ? clip.sourceIn : 0) : 0;
  const clipDur  = clip && Number.isFinite(clip.duration) ? clip.duration : 0;
  const clipStart = clip && Number.isFinite(clip.startTime) ? clip.startTime : 0;

  showProgress(0.05, 'Decoding audio…', '');
  const resp = await fetch(videoEl.src);
  const ab = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let rawBuffer;
  try { rawBuffer = await ac.decodeAudioData(ab); }
  finally { try { ac.close(); } catch (_) {} }

  const fxLayers = getAudioFxLayersInRange(clipStart, clipStart + clipDur);
  let processedBuffer = rawBuffer;
  if (fxLayers.length) {
    try {
      processedBuffer = await applyAudioFxLayers(rawBuffer, fxLayers, sourceIn, clipDur, clipStart);
    } catch (e) { processedBuffer = rawBuffer; }
  }

  const targetRate = 48000;
  const numCh = Math.min(2, processedBuffer.numberOfChannels || 1);
  const srcRate = processedBuffer.sampleRate;
  const startSample = Math.floor(sourceIn * srcRate);
  const endSample = clipDur > 0
    ? Math.min(processedBuffer.length, Math.floor((sourceIn + clipDur) * srcRate))
    : processedBuffer.length;
  const totalFrames = Math.max(0, endSample - startSample);
  if (totalFrames === 0) throw new Error('Empty audio range');

  const muxerMod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm');
  const Muxer = muxerMod.Muxer;
  const ArrayBufferTarget = muxerMod.ArrayBufferTarget;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory',
    audio: { codec: 'aac', numberOfChannels: numCh, sampleRate: targetRate },
    firstTimestampBehavior: 'offset'
  });

  const audioEncoder = new AudioEncoder({
    output: (c, m) => { try { muxer.addAudioChunk(c, m); } catch (_) {} },
    error: (e) => console.warn('AudioEncoder', e)
  });
  audioEncoder.configure({
    codec: 'mp4a.40.2', sampleRate: targetRate,
    numberOfChannels: numCh, bitrate: 128000
  });

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(processedBuffer.getChannelData(c));

  const chunkFrames = 1024;
  let offset = 0;
  while (offset < totalFrames) {
    const len = Math.min(chunkFrames, totalFrames - offset);
    const planar = new Float32Array(len * numCh);
    for (let c = 0; c < numCh; c++) {
      const src = channels[c];
      const dstOff = c * len;
      const srcStart = startSample + offset;
      for (let i = 0; i < len; i++) {
        if (srcRate === targetRate) {
          planar[dstOff + i] = src[srcStart + i] || 0;
        } else {
          const srcIdx = srcStart + i * (srcRate / targetRate);
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(processedBuffer.length - 1, i0 + 1);
          const frac = srcIdx - i0;
          planar[dstOff + i] = (src[i0] || 0) * (1 - frac) + (src[i1] || 0) * frac;
        }
      }
    }
    try {
      const ad = new AudioData({
        format: 'f32-planar', sampleRate: targetRate,
        numberOfFrames: len, numberOfChannels: numCh,
        timestamp: Math.round((offset / targetRate) * 1e6),
        data: planar
      });
      audioEncoder.encode(ad);
      ad.close();
    } catch (_) {}
    offset += len;
  }

  try { await audioEncoder.flush(); } catch (_) {}
  try { audioEncoder.close(); } catch (_) {}
  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'audio/mp4' });
  hideProgress();
  const saved = await saveBlob(blob, filename);
  if (saved) showToast('Saved ' + filename);
}

async function applyAudioFxLayers(inputBuffer, fxRanges, sourceIn, clipDur, timelineStart) {
  const sr = inputBuffer.sampleRate;
  const numCh = Math.min(2, inputBuffer.numberOfChannels || 1);
  const outLen = Math.max(1, Math.ceil(clipDur * sr));
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext not available');
  const ac = new OAC(numCh, outLen, sr);
  const points = new Set([timelineStart, timelineStart + clipDur]);
  for (const fx of fxRanges) { points.add(fx.start); points.add(fx.end); }
  const sorted = [...points].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i], e = sorted[i + 1];
    if (e <= s) continue;
    let key = null;
    for (const fx of fxRanges) {
      if (fx.start <= s && fx.end >= e) { key = fx.key; break; }
    }
    segments.push({ start: s, end: e, key });
  }

  const FADE_SAMPLES = Math.max(1, Math.floor(0.01 * sr));

  for (const seg of segments) {
    const segDur = seg.end - seg.start;
    if (segDur <= 0.001) continue;
    const localStart = sourceIn + (seg.start - timelineStart);
    const sSamp = Math.max(0, Math.floor(localStart * sr));
    const eSamp = Math.min(inputBuffer.length, Math.floor((localStart + segDur) * sr));
    const samples = Math.max(1, eSamp - sSamp);
    const segBuf = ac.createBuffer(numCh, samples, sr);
    for (let c = 0; c < numCh; c++) {
      const srcCh = inputBuffer.getChannelData(Math.min(c, inputBuffer.numberOfChannels - 1));
      const dstCh = segBuf.getChannelData(c);
      for (let i = 0; i < samples; i++) {
        let v = srcCh[sSamp + i] || 0;
        if (i < FADE_SAMPLES) v *= i / FADE_SAMPLES;
        const rem = samples - i;
        if (rem < FADE_SAMPLES) v *= rem / FADE_SAMPLES;
        dstCh[i] = v;
      }
    }
    const src = ac.createBufferSource();
    src.buffer = segBuf;
    let tail = src;
    if (seg.key) {
      const build = getBuilder(seg.key);
      if (build) {
        try { tail = build(ac, src) || src; }
        catch (_) { tail = src; }
      }
    }
    tail.connect(ac.destination);
    const startAtOutput = seg.start - timelineStart;
    src.start(Math.max(0, startAtOutput));
  }
  return await ac.startRendering();
}

// ═══════════════════════════════════════════════════════════════
//  VIDEO EXPORT
// ═══════════════════════════════════════════════════════════════
async function exportVideo(filename, fmt) {
  const timelineEnd = computeTimelineEnd();
  if (timelineEnd <= 0) { showToast('Timeline is empty', false); return; }
  const hasSource = hasAnyVideoSource();

  if (fmt.key !== 'mp4') {
    showToast('Only MP4 is supported for fast export', false);
    return;
  }

  const hasWebCodecs =
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined';

  if (!hasWebCodecs) {
    showToast('Export needs WebCodecs (Chrome/Edge)', false);
    return;
  }

  try {
    if (hasSource) {
      await exportVideoFast(filename);
    } else {
      await exportVideoCanvasOnly(filename);
    }
  } catch (e) {
    console.error('Export failed:', e);
    const msg = 'Export failed: ' + (e && e.message ? e.message : 'unknown');
    const details = [
      'Error name:    ' + (e && e.name ? e.name : 'n/a'),
      'Error message: ' + (e && e.message ? e.message : 'n/a'),
      'Stack:',
      (e && e.stack) ? e.stack : '(no stack)',
      '',
      'Export settings:',
      '  format:  ' + settings.format,
      '  quality: ' + settings.quality,
      '  fps:     ' + settings.fps,
      '  bitrate: ' + settings.bitrateKbps + ' kbps',
      '  filename:' + settings.fileName
    ].join('\n');
    showError('Export Failed', msg, details);
    hideProgress();
  }
}

// ─── Canvas-only ──────────────────────────────────────────────
async function exportVideoCanvasOnly(filename) {
  const muxerMod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm');
  const Muxer = muxerMod.Muxer;
  const ArrayBufferTarget = muxerMod.ArrayBufferTarget;
  const q = getCurrentQuality();
  const W = q.width, H = q.height;
  const fps = Number(settings.fps) || 30;
  const frameInterval = 1 / fps;
  const bitrateBps = (settings.bitrateKbps || 10000) * 1000;
  const timelineEnd = computeTimelineEnd();
  if (timelineEnd <= 0) throw new Error('Timeline is empty');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory',
    video: { codec: 'avc', width: W, height: H },
    firstTimestampBehavior: 'offset'
  });

  let encoderError = null;
  let encoderMetaSeen = false;
  let frameCount = 0;
  const keyFrameEvery = Math.max(1, Math.round(fps * 2));

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (encoderError) return;
      try {
        if (meta && meta.decoderConfig) {
          encoderMetaSeen = true;
          muxer.addVideoChunk(chunk, meta);
        } else if (encoderMetaSeen) muxer.addVideoChunk(chunk);
        else muxer.addVideoChunk(chunk, meta || undefined);
      } catch (_) {}
    },
    error: (e) => { encoderError = e; }
  });

  let encoderConfigured = false;
  const codecCandidates = getCodecCandidates(W, H);
  for (const codecStr of codecCandidates) {
    const config = {
      codec: codecStr, width: W, height: H,
      bitrate: bitrateBps, framerate: fps,
      avc: { format: 'avc' }
    };
    try {
      if (typeof VideoEncoder.isConfigSupported === 'function') {
        const support = await VideoEncoder.isConfigSupported(config);
        if (!support || !support.supported) continue;
      }
      videoEncoder.configure(config);
      encoderConfigured = true;
      break;
    } catch (_) {}
  }
  if (!encoderConfigured) throw new Error('No encoder for ' + W + 'x' + H);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

  const prevFrameBuffer = document.createElement('canvas');
  prevFrameBuffer.width = W; prevFrameBuffer.height = H;
  const prevCtx = prevFrameBuffer.getContext('2d', { willReadFrequently: true });
  let prevFrameValid = false;

  function captureToBuffer() {
    prevCtx.setTransform(1, 0, 0, 1, 0, 0);
    prevCtx.clearRect(0, 0, W, H);
    try { prevCtx.drawImage(canvas, 0, 0); } catch (_) {}
    prevFrameValid = true;
  }

  const totalFrames = Math.max(1, Math.round(timelineEnd * fps));

  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) break;
    const timelineTime = i * frameInterval;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const clipAtTime = findClipAtTimelineTime(timelineTime);
    const transitionActive = clipAtTime && isTransitionActive(clipAtTime, timelineTime);

    try {
      renderFrameToCanvas(ctx, W, H, null, timelineTime, timelineTime,
                          (transitionActive && prevFrameValid) ? prevFrameBuffer : null);
    } catch (_) {}

    if (!transitionActive) captureToBuffer();

    const exportFrame = new VideoFrame(canvas, {
      timestamp: Math.round(timelineTime * 1e6),
      duration: Math.round(frameInterval * 1e6)
    });
    const needKey = (i % keyFrameEvery) === 0;
    try { videoEncoder.encode(exportFrame, { keyFrame: needKey }); }
    catch (_) {}
    exportFrame.close();
    frameCount++;

    if (i % 4 === 0 || i === totalFrames - 1) {
      const p = (i + 1) / totalFrames;
      showProgress(0.05 + p * 0.9,
        'Rendering… ' + Math.round(p * 100) + '%',
        'Frame ' + frameCount + ' / ' + totalFrames);
      await sleep(0);
    }
  }

  try { await videoEncoder.flush(); } catch (_) {}
  try { videoEncoder.close(); } catch (_) {}
  if (encoderError) throw encoderError;
  if (frameCount === 0) throw new Error('No frames encoded');

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  hideProgress();
  const saved = await saveBlob(blob, filename);
  if (saved) showToast('Saved ' + filename);
}

// ─── Fast render (with video) ─────────────────────────────────
async function exportVideoFast(filename) {
  const MP4Box = await loadMP4Box();
  const muxerMod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm');
  const Muxer = muxerMod.Muxer;
  const ArrayBufferTarget = muxerMod.ArrayBufferTarget;

  const videoEl = document.querySelector('#preview-video');
  const q = getCurrentQuality();
  const W = q.width, H = q.height;
  const fps = Number(settings.fps) || 30;
  const frameInterval = 1 / fps;
  const bitrateBps = (settings.bitrateKbps || 10000) * 1000;
  const timelineEnd = computeTimelineEnd();
  if (timelineEnd <= 0) throw new Error('Timeline is empty');

  const matchedClip = findVideoClip(videoEl);
  let clipSourceIn = 0, clipStartTime = 0, clipDuration = 0, clipEnd = 0;
  if (matchedClip) {
    clipSourceIn = Number.isFinite(matchedClip.sourceIn) ? matchedClip.sourceIn : 0;
    clipStartTime = Number.isFinite(matchedClip.startTime) ? matchedClip.startTime : 0;
    clipDuration = Number.isFinite(matchedClip.duration) ? matchedClip.duration : 0;
    clipEnd = clipStartTime + clipDuration;
  }

  showProgress(0.02, 'Reading source…', '');
  const resp = await fetch(videoEl.src);
  const sourceAB = await resp.arrayBuffer();
  sourceAB.fileStart = 0;

  const mp4box = MP4Box.createFile();
  let videoTrackInfo = null;
  let audioTrackInfo = null;
  let fileDuration = 0;
  const videoSamples = [];

  await new Promise((resolve, reject) => {
    let ready = false, lastCount = 0, stableChecks = 0;
    mp4box.onError = (e) => { if (!ready) reject(new Error('mp4box: ' + e)); };
    mp4box.onSamples = (trackId, user, samples) => {
      if (!videoTrackInfo || trackId !== videoTrackInfo.id) return;
      for (let i = 0; i < samples.length; i++) videoSamples.push(samples[i]);
    };
    mp4box.onReady = (info) => {
      fileDuration = info.duration / info.timescale;
      videoTrackInfo = info.videoTracks[0] || null;
      audioTrackInfo = info.audioTracks[0] || null;
      if (!videoTrackInfo) { reject(new Error('No video track')); return; }
      try {
        mp4box.setExtractionOptions(videoTrackInfo.id, null, { nbSamples: 1000 });
        mp4box.start();
        ready = true;
      } catch (e) { reject(e); return; }
      const check = () => {
        if (videoSamples.length === lastCount) {
          stableChecks++;
          if (stableChecks >= 3) { resolve(); return; }
        } else { stableChecks = 0; lastCount = videoSamples.length; }
        setTimeout(check, 30);
      };
      setTimeout(check, 80);
    };
    mp4box.appendBuffer(sourceAB);
    mp4box.flush();
  });

  if (!videoTrackInfo) throw new Error('No video track');
  if (!videoSamples.length) throw new Error('No samples');

  if (!matchedClip || clipDuration <= 0) {
    clipSourceIn = 0; clipStartTime = 0;
    clipDuration = fileDuration; clipEnd = fileDuration;
  }

  const description = getDecoderDescription(mp4box, videoTrackInfo.id, MP4Box, sourceAB);
  if (!description) throw new Error('Missing avcC');

  const decoderConfig = {
    codec: videoTrackInfo.codec,
    codedWidth: videoTrackInfo.track_width,
    codedHeight: videoTrackInfo.track_height,
    description
  };

  const audioMuted = isLinkedAudioMuted(videoEl);

  const target = new ArrayBufferTarget();
  const muxerOpts = {
    target, fastStart: 'in-memory',
    video: { codec: 'avc', width: W, height: H },
    firstTimestampBehavior: 'offset'
  };
  const hasAudio = !!audioTrackInfo && !audioMuted;
  if (hasAudio) muxerOpts.audio = { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 };
  const muxer = new Muxer(muxerOpts);

  let frameCount = 0;
  const keyFrameEvery = Math.max(1, Math.round(fps * 2));
  let encoderError = null;
  let encoderMetaSeen = false;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (encoderError) return;
      try {
        if (meta && meta.decoderConfig) {
          encoderMetaSeen = true;
          muxer.addVideoChunk(chunk, meta);
        } else if (encoderMetaSeen) muxer.addVideoChunk(chunk);
        else muxer.addVideoChunk(chunk, meta || undefined);
      } catch (_) {}
    },
    error: (e) => { encoderError = e; }
  });

  let encoderConfigured = false;
  const codecCandidates = getCodecCandidates(W, H);
  for (const codecStr of codecCandidates) {
    const config = {
      codec: codecStr, width: W, height: H,
      bitrate: bitrateBps, framerate: fps,
      avc: { format: 'avc' }
    };
    try {
      if (typeof VideoEncoder.isConfigSupported === 'function') {
        const support = await VideoEncoder.isConfigSupported(config);
        if (!support || !support.supported) continue;
      }
      videoEncoder.configure(config);
      encoderConfigured = true;
      break;
    } catch (_) {}
  }
  if (!encoderConfigured) throw new Error('No encoder for ' + W + 'x' + H);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

  const prevFrameBuffer = document.createElement('canvas');
  prevFrameBuffer.width = W; prevFrameBuffer.height = H;
  const prevCtx = prevFrameBuffer.getContext('2d', { willReadFrequently: true });
  let prevFrameValid = false;

  function captureToBuffer() {
    prevCtx.setTransform(1, 0, 0, 1, 0, 0);
    prevCtx.clearRect(0, 0, W, H);
    try { prevCtx.drawImage(canvas, 0, 0); } catch (_) {}
    prevFrameValid = true;
  }

  function emitBlackFrame(timelineTime) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    try { renderFrameToCanvas(ctx, W, H, null, timelineTime, timelineTime); }
    catch (_) {}
    const exportFrame = new VideoFrame(canvas, {
      timestamp: Math.round(timelineTime * 1e6),
      duration: Math.round(frameInterval * 1e6)
    });
    const needKey = (frameCount % keyFrameEvery) === 0;
    videoEncoder.encode(exportFrame, { keyFrame: needKey });
    exportFrame.close();
    frameCount++;
    captureToBuffer();
  }

  if (clipStartTime > 0.005) {
    let t = 0;
    while (t < clipStartTime - 0.001) { emitBlackFrame(t); t += frameInterval; }
  }

  let decoderError = null;
  const decoder = new VideoDecoder({
    output: (frame) => {
      if (decoderError) { try { frame.close(); } catch (_) {} return; }
      try {
        const sourceTime = frame.timestamp / 1e6;
        const timelineTime = sourceTime - clipSourceIn + clipStartTime;
        if (timelineTime < clipStartTime - 0.03) { frame.close(); return; }
        if (timelineTime >= clipEnd) { frame.close(); return; }

        const clipAtTime = findClipAtTimelineTime(timelineTime);
        const transitionActive = clipAtTime && isTransitionActive(clipAtTime, timelineTime);

        renderFrameToCanvas(ctx, W, H, frame, sourceTime, timelineTime,
                            (transitionActive && prevFrameValid) ? prevFrameBuffer : null);

        if (!transitionActive) captureToBuffer();

        const exportFrame = new VideoFrame(canvas, {
          timestamp: Math.round(timelineTime * 1e6),
          duration: frame.duration || Math.round(1e6 / fps)
        });
        const needKey = (frameCount % keyFrameEvery) === 0;
        videoEncoder.encode(exportFrame, { keyFrame: needKey });
        exportFrame.close();
        frame.close();
        frameCount++;

        const p = timelineEnd > 0 ? Math.max(0, Math.min(1, timelineTime / timelineEnd)) : 0;
        showProgress(0.05 + p * 0.9,
                     'Rendering… ' + Math.round(p * 100) + '%',
                     'Frame ' + frameCount);
      } catch (_) {
        try { frame.close(); } catch (_) {}
      }
    },
    error: (e) => { decoderError = e; }
  });

  try { decoder.configure(decoderConfig); }
  catch (e) { throw new Error('Decoder configure failed: ' + e.message); }

  let startIdx = -1;
  for (let i = 0; i < videoSamples.length; i++) {
    if (videoSamples[i].is_sync) { startIdx = i; break; }
  }
  if (startIdx < 0) throw new Error('No keyframe');

  for (let i = startIdx; i < videoSamples.length; i++) {
    if (decoder.state === 'closed') break;
    if (decoderError) break;
    while (decoder.decodeQueueSize > 25 && decoder.state === 'configured') await sleep(5);
    const s = videoSamples[i];
    try {
      decoder.decode(new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: Math.round((s.cts * 1e6) / s.timescale),
        duration: Math.round((s.duration * 1e6) / s.timescale),
        data: s.data
      }));
    } catch (_) {}
  }

  try { await decoder.flush(); } catch (_) {}
  try { decoder.close(); } catch (_) {}

  if (clipEnd < timelineEnd - 0.005) {
    let t = clipEnd;
    while (t < timelineEnd - 0.001) { emitBlackFrame(t); t += frameInterval; }
  }

  if (hasAudio) {
    try {
      await encodeAudioFromURL(videoEl.src, muxer, audioTrackInfo,
                               clipSourceIn, clipDuration, clipStartTime);
    } catch (_) {}
  }

  try { await videoEncoder.flush(); } catch (_) {}
  try { videoEncoder.close(); } catch (_) {}

  if (encoderError) throw encoderError;
  if (decoderError) throw decoderError;
  if (frameCount === 0) throw new Error('No frames encoded');

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  hideProgress();
  const saved = await saveBlob(blob, filename);
  if (saved) showToast('Saved ' + filename);
}

async function encodeAudioFromURL(url, muxer, audioTrackInfo, sourceIn, clipDur, timelineStart) {
  const resp = await fetch(url);
  const ab = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let rawBuffer;
  try { rawBuffer = await ac.decodeAudioData(ab); }
  catch (e) { try { ac.close(); } catch (_) {} throw e; }
  try { ac.close(); } catch (_) {}

  const fxLayers = getAudioFxLayersInRange(timelineStart, timelineStart + clipDur);
  let processedBuffer = rawBuffer;
  if (fxLayers.length) {
    try {
      processedBuffer = await applyAudioFxLayers(rawBuffer, fxLayers, sourceIn, clipDur, timelineStart);
    } catch (_) {}
  }

  const targetRate = 48000;
  const numCh = Math.min(2, processedBuffer.numberOfChannels || 1);
  const srcRate = processedBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor((sourceIn || 0) * srcRate));
  const endSample = (clipDur && clipDur > 0)
    ? Math.min(processedBuffer.length, Math.floor(((sourceIn || 0) + clipDur) * srcRate))
    : processedBuffer.length;
  const totalFrames = Math.max(0, endSample - startSample);
  if (totalFrames === 0) return;

  const audioEncoder = new AudioEncoder({
    output: (c, m) => { try { muxer.addAudioChunk(c, m); } catch (_) {} },
    error: (e) => console.warn('AudioEncoder', e)
  });
  audioEncoder.configure({
    codec: 'mp4a.40.2', sampleRate: targetRate,
    numberOfChannels: numCh, bitrate: 128000
  });

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(processedBuffer.getChannelData(c));

  const chunkFrames = 1024;
  const timeOffset = Number.isFinite(timelineStart) ? timelineStart : 0;
  let offset = 0;
  while (offset < totalFrames) {
    const len = Math.min(chunkFrames, totalFrames - offset);
    const planar = new Float32Array(len * numCh);
    for (let c = 0; c < numCh; c++) {
      const src = channels[c];
      const dstOff = c * len;
      const srcStart = startSample + offset;
      for (let i = 0; i < len; i++) {
        if (srcRate === targetRate) {
          planar[dstOff + i] = src[srcStart + i] || 0;
        } else {
          const srcIdx = srcStart + i * (srcRate / targetRate);
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(processedBuffer.length - 1, i0 + 1);
          const frac = srcIdx - i0;
          planar[dstOff + i] = (src[i0] || 0) * (1 - frac) + (src[i1] || 0) * frac;
        }
      }
    }
    try {
      const ad = new AudioData({
        format: 'f32-planar', sampleRate: targetRate,
        numberOfFrames: len, numberOfChannels: numCh,
        timestamp: Math.round((timeOffset + offset / targetRate) * 1e6),
        data: planar
      });
      audioEncoder.encode(ad);
      ad.close();
    } catch (_) {}
    offset += len;
  }

  try { await audioEncoder.flush(); } catch (_) {}
  try { await audioEncoder.close(); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  PNG SEQUENCE
// ═══════════════════════════════════════════════════════════════
async function exportPngSequence(baseName) {
  const timelineEnd = computeTimelineEnd();
  if (timelineEnd <= 0) { showToast('Timeline is empty', false); return; }
  if (!defaultDirHandle) {
    showToast('Please choose a save folder first', false);
    return;
  }

  const fps = Number(settings.fps) || 30;
  const totalFrames = Math.max(1, Math.round(timelineEnd * fps));

  try {
    await exportPngSequenceCanvasOnly(defaultDirHandle, totalFrames, fps);
  } catch (e) {
    console.error('PNG seq failed:', e);
    showError(
      'PNG Export Failed',
      'PNG sequence export failed: ' + (e && e.message ? e.message : 'unknown'),
      (e && e.stack) ? e.stack : '(no stack)'
    );
    hideProgress();
  }
}

async function exportPngSequenceCanvasOnly(dirHandle, totalFrames, fps) {
  const q = getCurrentQuality();
  const W = q.width, H = q.height;
  const frameInterval = 1 / fps;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

  const padLen = Math.max(1, String(totalFrames).length);
  let pendingWrites = 0;
  let writeChain = Promise.resolve();
  const MAX_PENDING = 8;

  function queueWrite(blobPromise, frameIdx) {
    pendingWrites++;
    writeChain = writeChain.then(async function () {
      try {
        const blob = await blobPromise;
        if (!blob) return;
        const name = String(frameIdx + 1).padStart(padLen, '0') + '.png';
        const fh = await dirHandle.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      } catch (_) {}
      finally { pendingWrites--; }
    });
  }

  for (let i = 0; i < totalFrames; i++) {
    const timelineTime = i * frameInterval;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    try { renderFrameToCanvas(ctx, W, H, null, timelineTime, timelineTime); }
    catch (_) {}

    const blobPromise = new Promise(resolve => {
      try { canvas.toBlob(b => resolve(b), 'image/png'); }
      catch (_) { resolve(null); }
    });
    queueWrite(blobPromise, i);

    if (i % 4 === 0 || i === totalFrames - 1) {
      const p = (i + 1) / totalFrames;
      showProgress(0.05 + p * 0.9,
        'Rendering frame ' + (i + 1) + ' / ' + totalFrames,
        'PNG sequence');
      await sleep(0);
    }
    while (pendingWrites > MAX_PENDING) await sleep(10);
  }

  showProgress(0.98, 'Writing files…', totalFrames + ' files');
  await writeChain;
  hideProgress();
  showToast('Saved ' + totalFrames + ' PNG files');
}

// ═══════════════════════════════════════════════════════════════
//  Raw MP4 atom parser
// ═══════════════════════════════════════════════════════════════
function getDecoderDescription(mp4box, trackId, MP4Box, sourceBuffer) {
  try {
    if (sourceBuffer && sourceBuffer.byteLength > 0) {
      const avcC = extractBoxPayload(sourceBuffer, 'avcC');
      if (avcC && avcC.length > 4) return avcC;
      const hvcC = extractBoxPayload(sourceBuffer, 'hvcC');
      if (hvcC && hvcC.length > 4) return hvcC;
    }
  } catch (_) {}
  return undefined;
}

function extractBoxPayload(arrayBuffer, targetType) {
  const view = new DataView(arrayBuffer);
  const result = { found: null };
  walkBoxes(arrayBuffer, view, 0, arrayBuffer.byteLength, targetType, result);
  return result.found;
}

function walkBoxes(buffer, view, start, end, targetType, result) {
  if (result.found) return;
  let offset = start;
  while (offset + 8 <= end) {
    if (result.found) return;
    const size32 = view.getUint32(offset, false);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7)
    );
    let boxSize = size32;
    let payloadStart = offset + 8;
    if (size32 === 1) {
      if (offset + 16 > end) break;
      const hi = view.getUint32(offset + 8, false);
      const lo = view.getUint32(offset + 12, false);
      boxSize = hi * 4294967296 + lo;
      payloadStart = offset + 16;
    } else if (size32 === 0) { boxSize = end - offset; }
    if (boxSize < 8 || offset + boxSize > end) break;
    if (type === targetType) {
      result.found = new Uint8Array(buffer, payloadStart, offset + boxSize - payloadStart);
      return;
    }
    if (type === 'moov' || type === 'trak' || type === 'mdia' ||
        type === 'minf' || type === 'stbl' || type === 'dinf' ||
        type === 'edts' || type === 'udta' || type === 'mvex') {
      walkBoxes(buffer, view, payloadStart, offset + boxSize, targetType, result);
    } else if (type === 'stsd') {
      walkBoxes(buffer, view, payloadStart + 8, offset + boxSize, targetType, result);
    } else if (type === 'avc1' || type === 'avc3' ||
               type === 'hvc1' || type === 'hev1' ||
               type === 'mp4v' || type === 'encv' ||
               type === 'vp09' || type === 'av01') {
      walkBoxes(buffer, view, payloadStart + 78, offset + boxSize, targetType, result);
    } else if (type === 'mp4a' || type === 'enca' ||
               type === 'samr' || type === 'sawb') {
      walkBoxes(buffer, view, payloadStart + 36, offset + boxSize, targetType, result);
    }
    offset += boxSize;
  }
}

// ═══════════════════════════════════════════════════════════════
//  mp4box.js loader
// ═══════════════════════════════════════════════════════════════
let mp4boxLoadPromise = null;
function loadMP4Box() {
  if (window.MP4Box) return Promise.resolve(window.MP4Box);
  if (mp4boxLoadPromise) return mp4boxLoadPromise;
  mp4boxLoadPromise = new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
    s.onload = function () {
      if (window.MP4Box) resolve(window.MP4Box);
      else reject(new Error('MP4Box not found'));
    };
    s.onerror = function () { reject(new Error('MP4Box load failed')); };
    document.head.appendChild(s);
  });
  return mp4boxLoadPromise;
}

// ═══════════════════════════════════════════════════════════════
//  SAVE BLOB
// ═══════════════════════════════════════════════════════════════
async function saveBlob(blob, filename) {
  if (defaultDirHandle) {
    try {
      const fh = await defaultDirHandle.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        defaultDirHandle = null;
      }
    }
  }

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
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  } catch (_) { return false; }
}

function buildPickerTypes(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) return [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }];
  if (lower.endsWith('.png')) return [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }];
  if (lower.endsWith('.m4a')) return [{ description: 'Audio', accept: { 'audio/mp4': ['.m4a', '.mp4'] } }];
  return undefined;
}