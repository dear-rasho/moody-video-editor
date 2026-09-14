// ================================================================
//  js/features/speed.js
//  Speed panel. Changes playbackRate + updates duration.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { registerSpeed, getEasedValue } from './keyframeEngine.js';

export const featureKey = 'speed';

(function installSpeedRenderer() {
  if (featuresRouter.__speedInstalled) return;
  featuresRouter.__speedInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'speedPanel') {
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

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];

const st = {
  currentSpeed: 1.0,
  baseDuration: 3
};

const CSS_ID = 'speed-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .sp-panel{display:flex;flex-direction:column;gap:10px;width:100%;padding:0;}
    .sp-panel *{box-sizing:border-box;}
    .sp-info{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--muted);}
    .sp-info-row{display:flex;align-items:center;gap:6px;min-width:0;}
    .sp-info-row b{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums;}
    .sp-card{display:flex;flex-direction:column;gap:10px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;}
    .sp-card-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
    .sp-row{display:flex;flex-direction:column;gap:4px;}
    .sp-row-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .sp-label{font-size:12px;font-weight:600;color:var(--text);}
    .sp-value{font-size:14px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;}
    .sp-slider{width:100%;accent-color:var(--accent);height:5px;cursor:pointer;}
    .sp-presets{display:flex;gap:6px;flex-wrap:wrap;}
    .sp-chip{padding:7px 12px;min-height:34px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:18px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}
    .sp-chip.active{background:var(--accent);color:#000;border-color:var(--accent);}
    .sp-reset{padding:11px 16px;min-height:44px;background:var(--surface);color:var(--danger);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;}
    .sp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 16px;background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;text-align:center;color:var(--muted);font-size:12px;}
    .sp-empty-icon{font-size:26px;opacity:.55;}
    .sp-empty-title{font-size:13px;font-weight:700;color:var(--text);}
    .sp-empty-text{font-size:11px;color:var(--muted);max-width:280px;}
  `;
  document.head.appendChild(s);
}

export function open({ router }) {
  router.openLevel('speed', [], {
    title: 'Speed',
    level: 2,
    renderMode: 'speedPanel'
  });
}

function getSelectedClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const trackLabel = el.dataset.track;
  if (!trackLabel) return null;
  const group = trackLabel[0] === 'A' ? 'audio' : 'visual';
  const trackIndex = Number(trackLabel.slice(1)) - 1;
  const clipIndex = Number(el.dataset.clip);
  if (!Number.isFinite(trackIndex) || !Number.isFinite(clipIndex)) return null;
  const list = appState.timeline[group];
  if (!Array.isArray(list)) return null;
  const track = list[trackIndex];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIndex];
  if (!clip) return null;
  return { group, trackIndex, clipIndex, clip, track };
}

function isSpeedCapable(clip) {
  const t = clip && clip.type ? clip.type : '';
  return t.indexOf('video/') === 0 || t.indexOf('audio/') === 0;
}

function commit() {
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

function ensureBase(clip) {
  if (!Number.isFinite(clip.__speedBase) || clip.__speedBase <= 0) {
    clip.__speedBase = Number.isFinite(clip.duration) ? clip.duration : 3;
  }
  return clip.__speedBase;
}

// 🆕 Apply speed: change duration AND update playback rate on video el
function applySpeed(clip, speed) {
  const base = ensureBase(clip);
  clip.__speed = speed;
  clip.duration = base / speed;
  clip.__trimmed = true;

  // Update live video/audio playback rate if this clip is currently playing
  applyToMediaElements(clip, speed);
}

function applyToMediaElements(clip, speed) {
  const video = document.querySelector('#preview-video');
  const audio = document.querySelector('#preview-audio');
  const eng = window.__playbackEngine;
  const time = eng ? eng.getTime() : 0;
  const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const e = s + (Number.isFinite(clip.duration) ? clip.duration : 0);
  const active = time >= s && time < e;

  if (active) {
    try { video.playbackRate = speed; } catch (_) {}
    try { audio.playbackRate = speed; } catch (_) {}
  }
}

function autoSelectFirstClip() {
  if (document.querySelector('.clip.selected')) return true;
  const clips = document.querySelectorAll('.clip');
  if (clips.length) {
    try {
      clips[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      return true;
    } catch (_) {}
  }
  return false;
}

function showToast(message, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.88)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  if (!document.querySelector('.clip.selected')) autoSelectFirstClip();

  const panel = document.createElement('div');
  panel.className = 'sp-panel';

  const sel = getSelectedClip();

  if (!sel) {
    panel.appendChild(buildEmptyState({
      icon: '👆',
      title: 'No clip selected',
      text: 'Tap a video or audio clip on the timeline first.'
    }));
    container.appendChild(panel);
    return;
  }

  if (!isSpeedCapable(sel.clip)) {
    panel.appendChild(buildEmptyState({
      icon: '🚫',
      title: 'Speed not available',
      text: 'Speed only works on video and audio clips.'
    }));
    container.appendChild(panel);
    return;
  }

  const base = ensureBase(sel.clip);
  const speed = Number.isFinite(sel.clip.__speed) ? sel.clip.__speed : 1.0;
  st.baseDuration = base;
  st.currentSpeed = speed;

  registerSpeed(sel.clip);

  // Info
  const info = document.createElement('div');
  info.className = 'sp-info';
  const nameRow = document.createElement('div');
  nameRow.className = 'sp-info-row';
  nameRow.innerHTML = 'Clip: <b>' + escapeHtml(sel.clip.name || 'Clip') + '</b>';
  const durRow = document.createElement('div');
  durRow.className = 'sp-info-row';
  durRow.innerHTML = 'Duration: <b class="sp-dur">' + (base / speed).toFixed(2) + 's</b>';
  info.append(nameRow, durRow);
  panel.appendChild(info);

  const card = document.createElement('div');
  card.className = 'sp-card';

  const cardTitle = document.createElement('div');
  cardTitle.className = 'sp-card-title';
  cardTitle.textContent = 'Playback Speed';
  card.appendChild(cardTitle);

  const rowHead = document.createElement('div');
  rowHead.className = 'sp-row-head';
  const lbl = document.createElement('span');
  lbl.className = 'sp-label';
  lbl.textContent = 'Speed';
  const val = document.createElement('span');
  val.className = 'sp-value';
  val.textContent = speed.toFixed(2) + 'x';
  rowHead.append(lbl, val);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'sp-slider';
  slider.min = '0.25';
  slider.max = '4';
  slider.step = '0.05';
  slider.value = String(speed);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'sp-row';
  sliderRow.append(rowHead, slider);
  card.appendChild(sliderRow);

  const presets = document.createElement('div');
  presets.className = 'sp-presets';
  const chipRefs = [];

  PRESETS.forEach(function (p) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sp-chip' + (Math.abs(p - speed) < 0.01 ? ' active' : '');
    chip.textContent = p + 'x';
    chip.addEventListener('click', function () {
      slider.value = String(p);
      applySpeedValue(sel.clip, p, true);
    });
    chipRefs.push(chip);
    presets.appendChild(chip);
  });
  card.appendChild(presets);

  function applySpeedValue(clip, v, doCommit) {
    st.currentSpeed = v;
    val.textContent = v.toFixed(2) + 'x';
    applySpeed(clip, v);
    const durEl = panel.querySelector('.sp-dur');
    if (durEl) durEl.textContent = (base / v).toFixed(2) + 's';
    registerSpeed(clip);
    chipRefs.forEach(function (c) {
      const cp = parseFloat(c.textContent);
      c.classList.toggle('active', Math.abs(cp - v) < 0.01);
    });
    if (doCommit) commit();
  }

  slider.addEventListener('input', function () {
    applySpeedValue(sel.clip, parseFloat(slider.value), false);
  });
  slider.addEventListener('change', function () {
    applySpeedValue(sel.clip, parseFloat(slider.value), true);
  });

  panel.appendChild(card);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'sp-reset';
  resetBtn.textContent = '↺ Reset Speed';
  resetBtn.addEventListener('click', function () {
    applySpeed(sel.clip, 1.0);
    registerSpeed(sel.clip);
    commit();
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
    showToast('Speed reset');
  });
  panel.appendChild(resetBtn);

  container.appendChild(panel);
}

function buildEmptyState(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'sp-empty';
  const ic = document.createElement('div');
  ic.className = 'sp-empty-icon';
  ic.textContent = opts.icon;
  const t = document.createElement('div');
  t.className = 'sp-empty-title';
  t.textContent = opts.title;
  const d = document.createElement('div');
  d.className = 'sp-empty-text';
  d.textContent = opts.text;
  wrap.append(ic, t, d);
  return wrap;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}