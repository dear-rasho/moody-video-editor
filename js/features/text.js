// ================================================================
//  js/features/text.js
//  Text panel — all state handled via panelState.js.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { getAnimationList, applyAnimation } from './animations.js';
import { placeClipAtTime } from '../layers/layersManager.js';
import * as panelState from '../workspace/panelState.js';
import {
  applyTextStyle,
  refreshCurrent,
  forceRerender,
  getTopTextClipAt
} from '../workspace/textRenderer.js';

export const featureKey = 'text';

const FONTS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New',
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
  'Palatino Linotype', 'Garamond', 'Lucida Console', 'Arial Black',
  'Segoe UI', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato'
];

const OPTIONS = [
  { key: 'addText',    label: 'Add Text',   icon: '➕' },
  { key: 'fonts',      label: 'Fonts',      icon: '🔤' },
  { key: 'stroke',     label: 'Stroke',     icon: '✏️' },
  { key: 'color',      label: 'Color',      icon: '🎨' },
  { key: 'gradient',   label: 'Gradient',   icon: '🌈' },
  { key: 'shadows',    label: 'Shadows',    icon: '🌑' },
  { key: 'alignment',  label: 'Align',      icon: '↔️' },
  { key: 'opacity',    label: 'Opacity',    icon: '👁' },
  { key: 'animations', label: 'Animations', icon: '✨' },
  { key: 'removeText', label: 'Remove',     icon: '🗑️' }
];

function makeDefaults() {
  return {
    content: '', fontFamily: 'Arial', fontSize: 36, fontWeight: 'normal',
    fontStyle: 'normal', color: '#ffffff', strokeWidth: 0, strokeColor: '#000000',
    gradientEnabled: false, gradientColor1: '#ff0066', gradientColor2: '#0066ff',
    gradientAngle: 90, shadowEnabled: false, shadowColor: '#000000',
    shadowBlur: 8, shadowOffsetX: 2, shadowOffsetY: 2, alignment: 'center',
    positionX: 50, positionY: 50, scale: 100, rotation: 0, opacity: 100,
    animation: 'none', animationDuration: 0.6
  };
}

let ts = makeDefaults();
let editingClipId = null;
let currentSubView = 'options';
let previewRAF = null;

(function installTextRenderer() {
  if (featuresRouter.__textInstalled) return;
  featuresRouter.__textInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'textPanel') {
      this.title.textContent = view.title;
      this.backButton.hidden = view.level === 0;
      this.shelf.classList.remove('circle-shelf');
      this.shelf.style.cssText = '';
      this.shelf.replaceChildren();
      renderTo(this.shelf, this.title);
      return;
    }
    return _origRender(view);
  };
})();

const CSS_ID = 'text-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .tx-panel { display:flex; flex-direction:column; gap:10px; padding:10px 8px 14px; overflow-y:auto; overflow-x:hidden; max-height:72vh; width:100%; box-sizing:border-box; }
    .tx-panel * { box-sizing:border-box; }
    .tx-editing-badge { padding:8px 12px; background:rgba(255,209,102,0.15); border:1px solid #ffd166; border-radius:8px; font-size:11px; color:#ffd166; font-weight:700; letter-spacing:0.04em; }
    .tx-options-shelf { display:flex; gap:8px; width:100%; min-width:0; overflow-x:auto; overflow-y:hidden; padding:2px 2px 10px; scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; scrollbar-width:thin; touch-action:pan-x; }
    .tx-options-shelf::-webkit-scrollbar { height:5px; }
    .tx-options-shelf::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
    .tx-option-btn { flex:0 0 84px; width:84px; min-height:82px; padding:8px 4px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; color:var(--text); cursor:pointer; font-family:inherit; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; scroll-snap-align:start; transition:all 0.12s ease; -webkit-tap-highlight-color:transparent; }
    .tx-option-btn:active { background:var(--surface-3); }
    .tx-option-icon { width:34px; height:34px; border-radius:50%; border:1px solid var(--border); display:grid; place-items:center; font-size:16px; background:var(--surface); }
    .tx-option-label { font-size:11px; font-weight:600; text-align:center; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; }
    .tx-card { display:flex; flex-direction:column; gap:10px; padding:12px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; width:100%; }
    .tx-card-title { font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
    .tx-textarea { width:100%; min-height:80px; padding:10px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:14px; font-family:inherit; resize:vertical; outline:none; }
    .tx-textarea:focus { border-color:var(--accent); }
    .tx-apply-btn { padding:10px 16px; min-height:44px; background:var(--accent); color:#000; border:0; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; }
    .tx-fonts-scroll { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; padding:2px 2px 8px; scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch; width:100%; scrollbar-width:thin; }
    .tx-fonts-scroll::-webkit-scrollbar{height:5px;}
    .tx-fonts-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .tx-font-card { flex:0 0 auto; min-width:140px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:10px; color:var(--text); cursor:pointer; font-size:16px; text-align:center; scroll-snap-align:start; transition:all 0.12s ease; font-family:inherit; white-space:nowrap; }
    .tx-font-card.active { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); background:var(--surface-2); }
    .tx-row { display:flex; flex-direction:column; gap:4px; width:100%; }
    .tx-row-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .tx-label { font-size:12px; font-weight:600; color:var(--text); }
    .tx-slider-wrap { display:flex; align-items:center; gap:8px; width:100%; }
    .tx-slider { flex:1; accent-color:var(--accent); height:4px; cursor:pointer; }
    .tx-num { width:62px; padding:4px 6px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:6px; font-size:12px; text-align:right; font-variant-numeric:tabular-nums; outline:none; font-family:inherit; flex-shrink:0; }
    .tx-num:focus { border-color:var(--accent); }
    .tx-color-row { display:flex; align-items:center; gap:10px; width:100%; }
    .tx-color-input { width:44px; height:44px; border-radius:8px; border:2px solid var(--border); background:transparent; cursor:pointer; padding:0; flex-shrink:0; }
    .tx-hex { flex:1; padding:8px 10px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:monospace; outline:none; min-width:0; }
    .tx-hex:focus { border-color:var(--accent); }
    .tx-chips { display:flex; gap:8px; flex-wrap:wrap; }
    .tx-chip { padding:8px 14px; min-height:36px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
    .tx-chip.active { background:var(--accent); color:#000; border-color:var(--accent); }
    .tx-align-row { display:flex; gap:8px; }
    .tx-align-btn { flex:1; padding:12px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:10px; font-size:13px; cursor:pointer; font-family:inherit; }
    .tx-align-btn.active { background:var(--accent); color:#000; border-color:var(--accent); }
  `;
  document.head.appendChild(style);
}

function loadFromSelection() {
  const el = document.querySelector('.clip.selected');
  if (el && el.dataset.clipType === 'text/plain') {
    const trackLabel = el.dataset.track || '';
    const trackIdx = Number(trackLabel.slice(1)) - 1;
    const clipIdx = Number(el.dataset.clip);
    if (Number.isFinite(trackIdx) && Number.isFinite(clipIdx)) {
      const track = appState.timeline.visual[trackIdx];
      const clip = track && track[clipIdx];
      if (clip && clip.__textId) {
        ts = Object.assign(makeDefaults(), clip.textState || {});
        editingClipId = clip.__textId;
        return true;
      }
    }
  }
  ts = makeDefaults();
  editingClipId = null;
  return false;
}

function syncToClip() {
  if (!editingClipId) return false;
  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && clip.__textId === editingClipId) {
        clip.textState = Object.assign({}, ts);
        clip.name = ts.content || clip.name;
        document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
        forceRerender();
        return true;
      }
    }
  }
  return false;
}

function createNewTextClip() {
  if (!ts.content) return null;
  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  const eng = window.__playbackEngine;
  const atTime = eng ? eng.getTime() : 0;
  const dur = 3;

  editingClipId = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  const clipData = {
    name: ts.content,
    url: 'text://' + editingClipId,
    type: 'text/plain',
    __textId: editingClipId,
    textState: Object.assign({}, ts),
    startTime: atTime,
    duration: dur
  };

  placeClipAtTime(appState.timeline.visual, clipData, atTime);
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  forceRerender();
  return editingClipId;
}

function refreshOverlay() {
  if (editingClipId) {
    const tracks = appState.timeline.visual || [];
    for (const track of tracks) {
      if (!Array.isArray(track)) continue;
      for (const clip of track) {
        if (clip && clip.__textId === editingClipId) {
          clip.textState = Object.assign({}, ts);
          break;
        }
      }
    }
  }
  try { refreshCurrent(); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  OPEN — restore sub-view from panelState
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  loadFromSelection();

  const saved = panelState.onFeatureOpen('text');
  currentSubView = saved.subView || 'options';

  router.openLevel('text', [], {
    title: 'Text',
    level: 2,
    renderMode: 'textPanel'
  });
}

export function renderTo(container) {
  injectStyles();

  // Register back interceptor ONCE per feature panel open
  panelState.registerBackInterceptor('text', function () {
    if (currentSubView === 'options') {
      // Let router handle it (exit to grid)
      panelState.unregisterBackInterceptor('text');
      return false;
    }
    // Sub-view → back to options
    stopPreview();
    currentSubView = 'options';
    panelState.setFeatureState('text', { subView: 'options' });
    renderCurrent(container);
    return true;
  });

  renderCurrent(container);
}

function renderCurrent(container) {
  container.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'tx-panel';
  container.appendChild(panel);

  if (editingClipId) {
    const badge = document.createElement('div');
    badge.className = 'tx-editing-badge';
    badge.textContent = '✏️ Editing selected text layer';
    panel.appendChild(badge);
  }

  switch (currentSubView) {
    case 'options':    renderOptions(panel); break;
    case 'addText':    renderAddText(panel); break;
    case 'fonts':      renderFonts(panel); break;
    case 'stroke':     renderStroke(panel); break;
    case 'color':      renderColor(panel); break;
    case 'gradient':   renderGradient(panel); break;
    case 'shadows':    renderShadows(panel); break;
    case 'alignment':  renderAlignment(panel); break;
    case 'opacity':    renderOpacity(panel); break;
    case 'animations': renderAnimations(panel); break;
  }
}

function goto(view, container) {
  stopPreview();
  currentSubView = view;
  panelState.setFeatureState('text', { subView: view });
  const c = container || document.querySelector('#feature-shelf');
  renderCurrent(c);
}

function renderOptions(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-options-shelf';

  OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-option-btn';

    const icon = document.createElement('span');
    icon.className = 'tx-option-icon';
    icon.textContent = opt.icon;

    const lbl = document.createElement('span');
    lbl.className = 'tx-option-label';
    lbl.textContent = opt.label;

    btn.append(icon, lbl);
    btn.addEventListener('click', () => {
      if (opt.key === 'removeText') { removeText(); return; }
      goto(opt.key);
    });

    shelf.appendChild(btn);
  });

  panel.appendChild(shelf);
}

function renderAddText(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = editingClipId ? 'Edit text of selected layer' : 'Type your text (new layer)';

  const ta = document.createElement('textarea');
  ta.className = 'tx-textarea';
  ta.placeholder = 'Enter text…';
  ta.value = ts.content;

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'tx-apply-btn';
  apply.textContent = editingClipId ? '✓ Update Layer' : '✓ Create Layer';

  apply.addEventListener('click', () => {
    const val = ta.value;
    if (!val) return;
    ts.content = val;
    if (editingClipId) syncToClip();
    else createNewTextClip();
    refreshOverlay();
    goto('options');
  });

  card.append(title, ta, apply);
  panel.appendChild(card);
  setTimeout(() => ta.focus(), 50);
}

function renderFonts(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Choose Font';

  const scroll = document.createElement('div');
  scroll.className = 'tx-fonts-scroll';

  FONTS.forEach(font => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-font-card';
    btn.textContent = font;
    btn.style.fontFamily = '"' + font + '", sans-serif';
    if (ts.fontFamily === font) btn.classList.add('active');

    btn.addEventListener('click', () => {
      ts.fontFamily = font;
      scroll.querySelectorAll('.tx-font-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
      syncToClip();
    });

    scroll.appendChild(btn);
  });

  card.append(title, scroll);
  panel.appendChild(card);
}

function renderStroke(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Stroke (Outline)';
  card.appendChild(makeSlider('Width', 0, 30, 1, ts.strokeWidth, v => { ts.strokeWidth = v; refreshOverlay(); syncToClip(); }));
  card.appendChild(makeColorRow('Color', ts.strokeColor, v => { ts.strokeColor = v; refreshOverlay(); syncToClip(); }));
  panel.appendChild(card);
}

function renderColor(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Solid Color';
  card.appendChild(makeColorRow('Color', ts.color, v => {
    ts.color = v; ts.gradientEnabled = false; refreshOverlay(); syncToClip();
  }));
  panel.appendChild(card);
}

function renderGradient(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Gradient Ramp';

  const chips = document.createElement('div');
  chips.className = 'tx-chips';
  const onChip = document.createElement('button');
  onChip.type = 'button';
  onChip.className = 'tx-chip' + (ts.gradientEnabled ? ' active' : '');
  onChip.textContent = ts.gradientEnabled ? 'ON' : 'OFF';
  onChip.addEventListener('click', () => {
    ts.gradientEnabled = !ts.gradientEnabled;
    onChip.textContent = ts.gradientEnabled ? 'ON' : 'OFF';
    onChip.classList.toggle('active', ts.gradientEnabled);
    refreshOverlay(); syncToClip();
  });
  chips.appendChild(onChip);
  card.appendChild(chips);

  card.appendChild(makeColorRow('Color A', ts.gradientColor1, v => {
    ts.gradientColor1 = v; ts.gradientEnabled = true;
    onChip.textContent = 'ON'; onChip.classList.add('active');
    refreshOverlay(); syncToClip();
  }));
  card.appendChild(makeColorRow('Color B', ts.gradientColor2, v => {
    ts.gradientColor2 = v; ts.gradientEnabled = true;
    onChip.textContent = 'ON'; onChip.classList.add('active');
    refreshOverlay(); syncToClip();
  }));
  card.appendChild(makeSlider('Angle', 0, 360, 1, ts.gradientAngle, v => { ts.gradientAngle = v; refreshOverlay(); syncToClip(); }));
  panel.appendChild(card);
}

function renderShadows(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Text Shadow';

  const chips = document.createElement('div');
  chips.className = 'tx-chips';
  const onChip = document.createElement('button');
  onChip.type = 'button';
  onChip.className = 'tx-chip' + (ts.shadowEnabled ? ' active' : '');
  onChip.textContent = ts.shadowEnabled ? 'ON' : 'OFF';
  onChip.addEventListener('click', () => {
    ts.shadowEnabled = !ts.shadowEnabled;
    onChip.textContent = ts.shadowEnabled ? 'ON' : 'OFF';
    onChip.classList.toggle('active', ts.shadowEnabled);
    refreshOverlay(); syncToClip();
  });
  chips.appendChild(onChip);
  card.appendChild(chips);

  card.appendChild(makeColorRow('Color', ts.shadowColor, v => {
    ts.shadowColor = v; ts.shadowEnabled = true;
    onChip.textContent = 'ON'; onChip.classList.add('active');
    refreshOverlay(); syncToClip();
  }));
  card.appendChild(makeSlider('Blur',     0, 40, 1, ts.shadowBlur,    v => { ts.shadowBlur = v;    refreshOverlay(); syncToClip(); }));
  card.appendChild(makeSlider('Offset X', -40, 40, 1, ts.shadowOffsetX, v => { ts.shadowOffsetX = v; refreshOverlay(); syncToClip(); }));
  card.appendChild(makeSlider('Offset Y', -40, 40, 1, ts.shadowOffsetY, v => { ts.shadowOffsetY = v; refreshOverlay(); syncToClip(); }));
  panel.appendChild(card);
}

function renderAlignment(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Alignment';

  const row = document.createElement('div');
  row.className = 'tx-align-row';

  // 🆕 Each alignment also syncs anchorX so text actually moves
  const ALIGNS = [
    { key: 'left',   label: '⬅ Left',   anchorX: 0   },
    { key: 'center', label: '⬌ Center', anchorX: 50  },
    { key: 'right',  label: '➡ Right',  anchorX: 100 }
  ];

  // 🆕 Detect current alignment from either ts.alignment or ts.anchorX
  let currentKey = ts.alignment || 'center';
  if (ts.anchorX != null) {
    if (ts.anchorX <= 16) currentKey = 'left';
    else if (ts.anchorX >= 84) currentKey = 'right';
    else currentKey = 'center';
  }

  ALIGNS.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-align-btn' + (currentKey === a.key ? ' active' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      // 🆕 Set both alignment + anchorX
      ts.alignment = a.key;
      ts.anchorX = a.anchorX;

      row.querySelectorAll('.tx-align-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
      syncToClip();
    });
    row.appendChild(btn);
  });

  card.append(title, row);
  panel.appendChild(card);
}

function renderOpacity(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Opacity';
  card.appendChild(makeSlider('Value (%)', 0, 100, 1, ts.opacity, v => { ts.opacity = v; refreshOverlay(); syncToClip(); }));
  panel.appendChild(card);
}

function renderAnimations(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';
  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Preset Animation';

  const list = getAnimationList();
  const scroll = document.createElement('div');
  scroll.className = 'tx-fonts-scroll';

  list.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-font-card';
    btn.textContent = a.label;
    btn.style.fontFamily = 'inherit';
    btn.style.fontSize = '13px';
    if (ts.animation === a.key) btn.classList.add('active');
    btn.addEventListener('click', () => {
      ts.animation = a.key;
      scroll.querySelectorAll('.tx-font-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      replayAnimation(); syncToClip();
    });
    scroll.appendChild(btn);
  });

  card.append(title, scroll);
  card.appendChild(makeSlider('Duration (s)', 0.2, 3, 0.1, ts.animationDuration, v => {
    ts.animationDuration = v; replayAnimation(); syncToClip();
  }));
  panel.appendChild(card);
}

function makeSlider(label, min, max, step, value, onChange) {
  const row = document.createElement('div');
  row.className = 'tx-row';
  const head = document.createElement('div');
  head.className = 'tx-row-head';
  const lbl = document.createElement('span');
  lbl.className = 'tx-label';
  lbl.textContent = label;
  head.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'tx-slider-wrap';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step;
  slider.value = value; slider.className = 'tx-slider';

  const num = document.createElement('input');
  num.type = 'number'; num.min = min; num.max = max; num.step = step;
  num.value = Number(value).toFixed(step < 1 ? 1 : 0);
  num.className = 'tx-num';

  const commit = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, n));
    slider.value = clamped;
    num.value = clamped.toFixed(step < 1 ? 1 : 0);
    onChange(clamped);
  };

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    num.value = v.toFixed(step < 1 ? 1 : 0);
    onChange(v);
  });
  num.addEventListener('change', () => commit(num.value));
  num.addEventListener('blur', () => commit(num.value));

  wrap.append(slider, num);
  row.append(head, wrap);
  return row;
}

function makeColorRow(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'tx-row';
  const head = document.createElement('div');
  head.className = 'tx-row-head';
  const lbl = document.createElement('span');
  lbl.className = 'tx-label';
  lbl.textContent = label;
  head.appendChild(lbl);

  const r = document.createElement('div');
  r.className = 'tx-color-row';

  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'tx-color-input';
  input.value = value;

  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'tx-hex';
  hex.value = value;

  input.addEventListener('input', () => { hex.value = input.value; onChange(input.value); });
  hex.addEventListener('change', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { input.value = v; onChange(v); }
    else hex.value = input.value;
  });

  r.append(input, hex);
  row.append(head, r);
  return row;
}

function replayAnimation() { forceRerender(); }

function stopPreview() {
  if (previewRAF) cancelAnimationFrame(previewRAF);
  previewRAF = null;
}

function removeText() {
  stopPreview();
  if (editingClipId) {
    const tracks = appState.timeline.visual || [];
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      if (!Array.isArray(track)) continue;
      const idx = track.findIndex(c => c && c.__textId === editingClipId);
      if (idx >= 0) { track.splice(idx, 1); break; }
    }
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  }
  ts = makeDefaults();
  editingClipId = null;
  forceRerender();
  goto('options');
}