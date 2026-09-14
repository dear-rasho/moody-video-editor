// ================================================================
//  js/workspace/keyframeUI.js
//  Keyframe button + clickable markers + selection state.
// ================================================================

import {
  ANIMATABLE_PROPS, getPropKeys, getKeyframes,
  setKeyframe, removeKeyframe, hasAnyKeyframeAt,
  getPropsWithKeyframeAt, removeAllKeyframesAtTime
} from './keyframeStore.js';

const CSS_ID = 'keyframe-ui-styles';

let btnEl = null;
let selectedKf = null;

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    #keyframe-btn {
      position: relative;
      font-size: 18px;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    #keyframe-btn.has-kf {
      color: #4f9dff;
      border-color: #4f9dff;
      background: rgba(79,157,255,0.12);
    }
    #keyframe-btn.no-kf {
      color: #eaeaea;
    }
    #keyframe-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    #keyframe-btn .kf-sign {
      position: absolute;
      right: 4px;
      bottom: 2px;
      font-size: 10px;
      line-height: 1;
      font-weight: 700;
      pointer-events: none;
    }
    #keyframe-btn.has-kf .kf-sign { color: #4f9dff; }
    #keyframe-btn.no-kf  .kf-sign { color: #eaeaea; }

    .kf-marker-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 25;
    }
    .kf-marker {
      position: absolute;
      top: 2px;
      width: 12px;
      height: 12px;
      background: #4f9dff;
      border: 1.5px solid #fff;
      transform: translateX(-50%) rotate(45deg);
      box-shadow: 0 0 4px rgba(79,157,255,0.6);
      pointer-events: auto;
      cursor: pointer;
      touch-action: none;
      transition: background 0.12s ease, transform 0.12s ease;
    }
    .kf-marker:hover {
      background: #7ab5ff;
    }
    .kf-marker.active {
      background: #ffd166;
      border-color: #000;
    }
    .kf-marker.selected {
      background: #ff3b3b;
      border-color: #fff;
      box-shadow: 0 0 0 2px #ff3b3b, 0 0 12px rgba(255,59,59,0.9);
      transform: translateX(-50%) rotate(45deg) scale(1.15);
      z-index: 30;
    }
  `;
  document.head.appendChild(s);
}

export function initKeyframeUI(buttonEl) {
  injectStyles();
  btnEl = buttonEl || document.querySelector('#keyframe-btn');
  if (!btnEl) return;

  btnEl.addEventListener('click', onButtonClick);

   document.addEventListener('playback:tick', refresh);
  document.addEventListener('playback:state', refresh);
  document.addEventListener('editor:timeline-changed', refresh);
  document.addEventListener('keyframe:changed', refresh);
  document.addEventListener('transform:changed', refresh);

  // 🆕 Selection change pe bhi ◆ button ka state update karo
  document.addEventListener('editor:clip-selected', refresh);

  document.addEventListener('playback:tick', scheduleMarkers);
  document.addEventListener('editor:timeline-changed', scheduleMarkers);
  document.addEventListener('keyframe:changed', scheduleMarkers);

  // ═══════════════════════════════════════════════════════════
  //  🆕 FIX: Clip select/deselect hone pe markers redraw karo
  //
  //  Pehle: clip pe click karne se markers wapas nahi aate the
  //         (kyunki koi event fire nahi hota tha)
  //
  //  Ab:    editor:clip-selected fire hota hai → markers redraw
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('editor:clip-selected', scheduleMarkers);

  refresh();
  scheduleMarkers();
}

export function getSelectedKeyframe() {
  return selectedKf;
}

export function clearKeyframeSelection() {
  selectedKf = null;
  document.querySelectorAll('.kf-marker.selected').forEach(n => n.classList.remove('selected'));
  window.__selectedKeyframe = null;
  document.dispatchEvent(new CustomEvent('keyframe:selected', { detail: null }));
}

function getSelectedClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'V') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return { clip, trackIdx, clipIdx, el };
}

function getPlayheadTime() {
  const eng = window.__playbackEngine;
  return eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
}

function captureProperties(clip) {
  const base = clip.__transform || {};
  const props = {};
  ANIMATABLE_PROPS.forEach(p => {
    let v = base[p];
    if (v == null) {
      if (p === 'x' || p === 'y' || p === 'anchorX' || p === 'anchorY') v = 50;
      else if (p === 'scale') v = 100;
      else v = 0;
    }
    props[p] = v;
  });
  return props;
}

function onButtonClick() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a visual layer first', false); return; }

  const t = getPlayheadTime();
  const clip = sel.clip;

  if (hasAnyKeyframeAt(clip, t)) {
    removeAllKeyframesAtTime(clip, t);
    if (selectedKf && selectedKf.clip === clip &&
        Math.abs(selectedKf.time - t) < 0.05) {
      clearKeyframeSelection();
    }
    showToast('Keyframe removed');
  } else {
    const props = captureProperties(clip);
    ANIMATABLE_PROPS.forEach(p => {
      setKeyframe(clip, p, t, props[p]);
    });
    showToast('Keyframe added');
  }

  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  refresh();
  scheduleMarkers();
}

function refresh() {
  if (!btnEl) return;
  const sel = getSelectedClip();
  if (!sel) {
    btnEl.disabled = true;
    btnEl.classList.remove('has-kf', 'no-kf');
    setSign(btnEl, '');
    return;
  }
  btnEl.disabled = false;
  const t = getPlayheadTime();
  const has = hasAnyKeyframeAt(sel.clip, t);
  btnEl.classList.toggle('has-kf', has);
  btnEl.classList.toggle('no-kf', !has);
  setSign(btnEl, has ? '−' : '+');
}

function setSign(btn, sign) {
  let el = btn.querySelector('.kf-sign');
  if (!sign) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('span');
    el.className = 'kf-sign';
    btn.appendChild(el);
  }
  el.textContent = sign;
}

let rafMarkers = false;
function scheduleMarkers() {
  if (rafMarkers) return;
  rafMarkers = true;
  requestAnimationFrame(() => {
    rafMarkers = false;
    drawMarkers();
  });
}

function drawMarkers() {
  document.querySelectorAll('.kf-marker-layer').forEach(n => n.remove());

  const sel = getSelectedClip();
  if (!sel) return;

  const clip = sel.clip;
  const keys = getPropKeys(clip);
  if (!keys.length) return;

  const clipEl = sel.el;
  if (!clipEl) return;

  const times = new Set();
  keys.forEach(prop => {
    getKeyframes(clip, prop).forEach(k => {
      times.add(Math.round(k.time * 100) / 100);
    });
  });
  if (!times.size) return;

  const startTime = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
  if (duration <= 0) return;

  const clipWidthPx = clipEl.offsetWidth || 0;
  if (clipWidthPx <= 0) return;

  const layer = document.createElement('div');
  layer.className = 'kf-marker-layer';

  const playhead = getPlayheadTime();
  const isSel = selectedKf && selectedKf.clip === clip;

  times.forEach(kt => {
    const relTime = kt - startTime;
    if (relTime < 0 || relTime > duration) return;
    const pct = relTime / duration;
    const m = document.createElement('span');
    m.className = 'kf-marker';
    m.dataset.kfTime = String(kt);
    m.style.left = (pct * 100) + '%';

    if (Math.abs(playhead - kt) < 0.06) m.classList.add('active');
    if (isSel && Math.abs(selectedKf.time - kt) < 0.05) m.classList.add('selected');

    m.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      selectKeyframe(clip, kt, m);
    });

    layer.appendChild(m);
  });

  clipEl.appendChild(layer);
}

function selectKeyframe(clip, time, markerEl) {
  if (selectedKf && selectedKf.clip === clip &&
      Math.abs(selectedKf.time - time) < 0.05) {
    clearKeyframeSelection();
    return;
  }

  selectedKf = { clip, time };
  window.__selectedKeyframe = selectedKf;

  document.querySelectorAll('.kf-marker.selected').forEach(n => n.classList.remove('selected'));
  if (markerEl) markerEl.classList.add('selected');

  const props = getPropsWithKeyframeAt(clip, time);
  document.dispatchEvent(new CustomEvent('keyframe:selected', {
    detail: { clip, time, props }
  }));
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}