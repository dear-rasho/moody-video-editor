// ================================================================
//  js/features/text.js
//  Multi-instance text editor.
//  ALL property groups (options + inner properties) = horizontal shelves.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { getAnimationList, applyAnimation } from './animations.js';
import { placeClipAtTime } from '../layers/layersManager.js';
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
    content: '',
    fontFamily: 'Arial',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#ffffff',
    strokeWidth: 0,
    strokeColor: '#000000',
    gradientEnabled: false,
    gradientColor1: '#ff0066',
    gradientColor2: '#0066ff',
    gradientAngle: 90,
    shadowEnabled: false,
    shadowColor: '#000000',
    shadowBlur: 8,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    alignment: 'center',
    positionX: 50,
    positionY: 50,
    scale: 100,
    rotation: 0,
    opacity: 100,
    animation: 'none',
    animationDuration: 0.6,
    kfPosition: [],
    kfScale: [],
    kfRotation: [],
    easePosition: 'easeInOut',
    easeScale: 'easeInOut',
    easeRotation: 'easeInOut'
  };
}

let ts = makeDefaults();
let editingClipId = null;
let currentSubView = 'options';
let previewRAF = null;

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'text-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .tx-panel { display:flex; flex-direction:column; gap:10px; padding:10px 8px 14px; overflow-y:auto; overflow-x:hidden; max-height:72vh; width:100%; box-sizing:border-box; }
    .tx-panel * { box-sizing:border-box; }

    .tx-editing-badge { padding:8px 12px; background:rgba(255,209,102,0.15); border:1px solid #ffd166; border-radius:8px; font-size:11px; color:#ffd166; font-weight:700; letter-spacing:0.04em; }

    /* ─── Horizontal shelves (used for everything) ─── */
    .tx-shelf {
      display: flex;
      gap: 8px;
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 10px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      touch-action: pan-x;
    }
    .tx-shelf::-webkit-scrollbar { height: 5px; }
    .tx-shelf::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* Option buttons (in main options shelf) */
    .tx-option-btn {
      flex: 0 0 84px;
      width: 84px;
      min-height: 82px;
      padding: 8px 4px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-family: inherit;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      scroll-snap-align: start;
      transition: all 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .tx-option-btn:active { background: var(--surface-3); }
    .tx-option-icon {
      width: 34px; height: 34px;
      border-radius: 50%;
      border: 1px solid var(--border);
      display: grid; place-items: center;
      font-size: 16px;
      background: var(--surface);
    }
    .tx-option-label {
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    /* ─── Property cards (in inner sub-views) ─── */
    .tx-prop-card {
      flex: 0 0 170px;
      width: 170px;
      min-height: 86px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scroll-snap-align: start;
    }
    .tx-prop-card.narrow {
      flex: 0 0 130px;
      width: 130px;
    }
    .tx-prop-card.wide {
      flex: 0 0 210px;
      width: 210px;
    }

    .tx-prop-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tx-prop-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
      text-align: center;
    }

    .tx-prop-slider {
      width: 100%;
      accent-color: var(--accent);
      height: 5px;
      cursor: pointer;
    }

    .tx-prop-num {
      width: 100%;
      padding: 6px 8px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      outline: none;
      font-family: inherit;
    }
    .tx-prop-num:focus { border-color: var(--accent); }

    .tx-prop-color-btn {
      width: 100%;
      height: 44px;
      border-radius: 8px;
      border: 2px solid var(--border);
      background: transparent;
      cursor: pointer;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .tx-prop-color-btn input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    /* Toggle chip card */
    .tx-prop-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: 40px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s ease;
    }
    .tx-prop-toggle.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }

    /* Font cards (already shelf) */
    .tx-font-card { flex:0 0 auto; min-width:140px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:10px; color:var(--text); cursor:pointer; font-size:16px; text-align:center; scroll-snap-align:start; transition:all 0.12s ease; font-family:inherit; white-space:nowrap; }
    .tx-font-card.active { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); background:var(--surface-2); }

    /* Textarea card (Add Text) */
    .tx-card { display:flex; flex-direction:column; gap:10px; padding:12px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; width:100%; }
    .tx-card-title { font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
    .tx-textarea { width:100%; min-height:80px; padding:10px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:14px; font-family:inherit; resize:vertical; outline:none; }
    .tx-textarea:focus { border-color:var(--accent); }
    .tx-apply-btn { padding:10px 16px; min-height:44px; background:var(--accent); color:#000; border:0; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; }
    .tx-apply-btn:active { opacity:0.85; }

    /* Alignment card (3 buttons inside one card) */
    .tx-align-btn {
      flex: 1;
      padding: 10px 6px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      min-height: 40px;
    }
    .tx-align-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .tx-align-row {
      display: flex;
      gap: 6px;
      width: 100%;
    }

    @media (max-width:380px){
      .tx-option-btn{flex:0 0 76px;width:76px;min-height:76px;}
      .tx-option-icon{width:30px;height:30px;font-size:14px;}
      .tx-option-label{font-size:10px;}
      .tx-prop-card{flex:0 0 150px;width:150px;padding:8px 10px;}
      .tx-prop-card.narrow{flex:0 0 116px;width:116px;}
      .tx-prop-card.wide{flex:0 0 180px;width:180px;}
      .tx-prop-label{font-size:10px;}
      .tx-prop-value{font-size:13px;}
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
//  LOAD / SYNC / CREATE
// ═══════════════════════════════════════════════════════════════
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
//  ROUTER ENTRY
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  loadFromSelection();
  currentSubView = 'options';
  router.openLevel('text', [], {
    title: 'Text',
    level: 2,
    renderMode: 'textPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  installBackInterceptor(container);
  renderCurrent(container);
}

function installBackInterceptor(container) {
  const backBtn = document.querySelector('#feature-back-btn');
  if (!backBtn) return;
  if (backBtn.__txHandler) backBtn.removeEventListener('click', backBtn.__txHandler, true);
  const handler = (e) => {
    if (currentSubView === 'options') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    stopPreview();
    currentSubView = 'options';
    renderCurrent(container);
  };
  backBtn.addEventListener('click', handler, true);
  backBtn.__txHandler = handler;
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
  const c = container || document.querySelector('#feature-shelf');
  renderCurrent(c);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN OPTIONS SHELF
// ═══════════════════════════════════════════════════════════════
function renderOptions(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

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

// ─── Add Text ─────────────────────────────────────────────────
function renderAddText(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = editingClipId
    ? 'Edit text of selected layer'
    : 'Type your text (new layer)';

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

// ─── Fonts (shelf) ────────────────────────────────────────────
function renderFonts(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  FONTS.forEach(font => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-font-card';
    btn.textContent = font;
    btn.style.fontFamily = `"${font}", sans-serif`;
    if (ts.fontFamily === font) btn.classList.add('active');

    btn.addEventListener('click', () => {
      ts.fontFamily = font;
      shelf.querySelectorAll('.tx-font-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
      syncToClip();
    });

    shelf.appendChild(btn);
  });

  panel.appendChild(shelf);
}

// ─── Stroke (shelf: Width + Color) ────────────────────────────
function renderStroke(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  shelf.appendChild(makeSliderCard('Width', 0, 30, 1, ts.strokeWidth, '%', v => {
    ts.strokeWidth = v; refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeColorCard('Color', ts.strokeColor, v => {
    ts.strokeColor = v; refreshOverlay(); syncToClip();
  }));

  panel.appendChild(shelf);
}

// ─── Color (shelf: single color card) ─────────────────────────
function renderColor(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  shelf.appendChild(makeColorCard('Color', ts.color, v => {
    ts.color = v; ts.gradientEnabled = false;
    refreshOverlay(); syncToClip();
  }, true));

  panel.appendChild(shelf);
}

// ─── Gradient (shelf: toggle + 2 colors + angle) ──────────────
function renderGradient(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  shelf.appendChild(makeToggleCard('Gradient', ts.gradientEnabled, on => {
    ts.gradientEnabled = on;
    refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeColorCard('Color A', ts.gradientColor1, v => {
    ts.gradientColor1 = v; ts.gradientEnabled = true;
    refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeColorCard('Color B', ts.gradientColor2, v => {
    ts.gradientColor2 = v; ts.gradientEnabled = true;
    refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeSliderCard('Angle', 0, 360, 1, ts.gradientAngle, '°', v => {
    ts.gradientAngle = v; refreshOverlay(); syncToClip();
  }));

  panel.appendChild(shelf);
}

// ─── Shadows (shelf: toggle + color + blur + offsets) ─────────
function renderShadows(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  shelf.appendChild(makeToggleCard('Shadow', ts.shadowEnabled, on => {
    ts.shadowEnabled = on;
    refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeColorCard('Color', ts.shadowColor, v => {
    ts.shadowColor = v; ts.shadowEnabled = true;
    refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeSliderCard('Blur', 0, 40, 1, ts.shadowBlur, 'px', v => {
    ts.shadowBlur = v; refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeSliderCard('Offset X', -40, 40, 1, ts.shadowOffsetX, 'px', v => {
    ts.shadowOffsetX = v; refreshOverlay(); syncToClip();
  }));

  shelf.appendChild(makeSliderCard('Offset Y', -40, 40, 1, ts.shadowOffsetY, 'px', v => {
    ts.shadowOffsetY = v; refreshOverlay(); syncToClip();
  }));

  panel.appendChild(shelf);
}

// ─── Alignment (shelf: single card with 3 buttons) ────────────
function renderAlignment(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  const card = document.createElement('div');
  card.className = 'tx-prop-card wide';

  const label = document.createElement('div');
  label.className = 'tx-prop-label';
  label.textContent = 'Alignment';
  card.appendChild(label);

  const row = document.createElement('div');
  row.className = 'tx-align-row';

  const ALIGNS = [
    { key: 'left',   label: '⬅' },
    { key: 'center', label: '⬌' },
    { key: 'right',  label: '➡' }
  ];

  ALIGNS.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-align-btn' + (ts.alignment === a.key ? ' active' : '');
    btn.textContent = a.label;
    btn.title = a.key;
    btn.addEventListener('click', () => {
      ts.alignment = a.key;
      row.querySelectorAll('.tx-align-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
      syncToClip();
    });
    row.appendChild(btn);
  });

  card.appendChild(row);
  shelf.appendChild(card);

  panel.appendChild(shelf);
}

// ─── Opacity (shelf: slider card) ─────────────────────────────
function renderOpacity(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  shelf.appendChild(makeSliderCard('Opacity', 0, 100, 1, ts.opacity, '%', v => {
    ts.opacity = v; refreshOverlay(); syncToClip();
  }));

  panel.appendChild(shelf);
}

// ─── Animations (shelf: animation list + duration) ────────────
function renderAnimations(panel) {
  const shelf = document.createElement('div');
  shelf.className = 'tx-shelf';

  const list = getAnimationList();
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
      shelf.querySelectorAll('.tx-font-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      replayAnimation();
      syncToClip();
    });

    shelf.appendChild(btn);
  });

  // Duration as slider card at end
  shelf.appendChild(makeSliderCard('Duration', 0.2, 3, 0.1, ts.animationDuration, 's', v => {
    ts.animationDuration = v;
    replayAnimation();
    syncToClip();
  }));

  panel.appendChild(shelf);
}

// ═══════════════════════════════════════════════════════════════
//  CARD BUILDERS (used by inner sub-views)
// ═══════════════════════════════════════════════════════════════
function makeSliderCard(label, min, max, step, value, suffix, onChange) {
  const card = document.createElement('div');
  card.className = 'tx-prop-card';

  const lbl = document.createElement('div');
  lbl.className = 'tx-prop-label';
  lbl.textContent = label;
  card.appendChild(lbl);

  const val = document.createElement('div');
  val.className = 'tx-prop-value';
  const fmt = v => {
    const r = Math.round(v * 10) / 10;
    return r + suffix;
  };
  val.textContent = fmt(value);
  card.appendChild(val);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'tx-prop-slider';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    val.textContent = fmt(v);
    onChange(v);
  });

  card.appendChild(slider);

  // Optional number input below
  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'tx-prop-num';
  num.min = String(min);
  num.max = String(max);
  num.step = String(step);
  num.value = fmt(value).replace(/[^0-9.-]/g, '');

  const commit = () => {
    let n = parseFloat(num.value);
    if (!Number.isFinite(n)) { num.value = fmt(value); return; }
    n = Math.max(min, Math.min(max, n));
    slider.value = String(n);
    val.textContent = fmt(n);
    onChange(n);
  };
  num.addEventListener('change', commit);
  num.addEventListener('blur', commit);

  card.appendChild(num);

  return card;
}

function makeColorCard(label, value, onChange) {
  const card = document.createElement('div');
  card.className = 'tx-prop-card narrow';

  const lbl = document.createElement('div');
  lbl.className = 'tx-prop-label';
  lbl.textContent = label;
  card.appendChild(lbl);

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'tx-prop-color-btn';
  swatch.style.background = value;

  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => {
    swatch.style.background = input.value;
    onChange(input.value);
  });
  swatch.appendChild(input);

  card.appendChild(swatch);

  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'tx-prop-num';
  hex.value = value;
  hex.style.fontFamily = 'monospace';
  hex.addEventListener('change', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      input.value = v;
      swatch.style.background = v;
      onChange(v);
    } else {
      hex.value = input.value;
    }
  });
  card.appendChild(hex);

  return card;
}

function makeToggleCard(label, value, onChange) {
  const card = document.createElement('div');
  card.className = 'tx-prop-card narrow';

  const lbl = document.createElement('div');
  lbl.className = 'tx-prop-label';
  lbl.textContent = label;
  card.appendChild(lbl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tx-prop-toggle' + (value ? ' active' : '');
  btn.textContent = value ? 'ON' : 'OFF';
  btn.addEventListener('click', () => {
    const next = !btn.classList.contains('active');
    btn.classList.toggle('active', next);
    btn.textContent = next ? 'ON' : 'OFF';
    onChange(next);
  });
  card.appendChild(btn);

  return card;
}

// ═══════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════
function replayAnimation() {
  forceRerender();
}

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