// ================================================================
//  js/features/text.js
//  Self-contained Text feature with keyframes + easing + custom values.
//  - Position / Scale / Rotation all support keyframes
//  - Easing curves shelf is horizontally scrollable (fixed card size)
//  - Outer panel scrolls only vertically
//  - Alignment fixed (anchor-based transform)
//  - Uses animations.js for preset animations
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { getAnimationList, applyAnimation } from './animations.js';

export const featureKey = 'text';

// ─── Fonts ─────────────────────────────────────────────────────
const FONTS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New',
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
  'Palatino Linotype', 'Garamond', 'Lucida Console', 'Arial Black',
  'Segoe UI', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato'
];

// ─── Options ───────────────────────────────────────────────────
const OPTIONS = [
  { key: 'addText',    label: 'Add Text',   icon: '➕' },
  { key: 'fonts',      label: 'Fonts',      icon: '🔤' },
  { key: 'stroke',     label: 'Stroke',     icon: '✏️' },
  { key: 'color',      label: 'Color',      icon: '🎨' },
  { key: 'gradient',   label: 'Gradient',   icon: '🌈' },
  { key: 'shadows',    label: 'Shadows',    icon: '🌑' },
  { key: 'alignment',  label: 'Align',      icon: '↔️' },
  { key: 'position',   label: 'Position',   icon: '📍' },
  { key: 'scale',      label: 'Scale',      icon: '🔍' },
  { key: 'rotation',   label: 'Rotate',     icon: '🔄' },
  { key: 'opacity',    label: 'Opacity',    icon: '👁' },
  { key: 'animations', label: 'Animations', icon: '✨' },
  { key: 'removeText', label: 'Remove',     icon: '🗑️' }
];

// ─── Easing options ────────────────────────────────────────────
const EASING_OPTIONS = [
  { key: 'linear',        label: 'Linear' },
  { key: 'easeIn',        label: 'Ease In' },
  { key: 'easeOut',       label: 'Ease Out' },
  { key: 'easeInOut',     label: 'Ease In-Out' },
  { key: 'easeInCubic',   label: 'Cubic In' },
  { key: 'easeOutCubic',  label: 'Cubic Out' },
  { key: 'easeInOutCubic',label: 'Cubic In-Out' },
  { key: 'easeInBack',    label: 'Back In' },
  { key: 'easeOutBack',   label: 'Back Out' },
  { key: 'easeInOutBack', label: 'Back In-Out' },
  { key: 'easeOutBounce', label: 'Bounce Out' },
  { key: 'easeOutElastic',label: 'Elastic Out' }
];

// ─── State ─────────────────────────────────────────────────────
const ts = {
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
  easeScale:    'easeInOut',
  easeRotation: 'easeInOut'
};

let currentSubView = 'options';
let overlayEl = null;
let textLayerId = null;
let previewRAF = null;

// ─── Router self-install ───────────────────────────────────────
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

// ─── CSS ───────────────────────────────────────────────────────
const CSS_ID = 'text-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    /* ═══════════ OUTER PANEL — vertical scroll only ═══════════ */
    .tx-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 8px 14px;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: 72vh;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .tx-panel * { box-sizing: border-box; }

    /* ═══════════ Options grid ═══════════ */
    .tx-options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
      gap: 8px;
      padding: 2px;
      width: 100%;
    }
    .tx-option-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 76px;
      padding: 8px 4px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s ease;
    }
    .tx-option-btn:active { background: var(--surface-3); }
    .tx-option-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid var(--border);
      display: grid;
      place-items: center;
      font-size: 16px;
      background: var(--surface);
    }
    .tx-option-label {
      font-size: 11px;
      font-weight: 600;
      text-align: center;
    }

    /* ═══════════ Card ═══════════ */
    .tx-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      width: 100%;
      min-width: 0;
    }
    .tx-card-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    /* ═══════════ Add Text ═══════════ */
    .tx-textarea {
      width: 100%;
      min-height: 80px;
      padding: 10px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      outline: none;
    }
    .tx-textarea:focus { border-color: var(--accent); }
    .tx-apply-btn {
      padding: 10px 16px;
      min-height: 44px;
      background: var(--accent);
      color: #000;
      border: 0;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .tx-apply-btn:active { opacity: 0.85; }

    /* ═══════════ Fonts shelf ═══════════ */
    .tx-fonts-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 8px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      width: 100%;
      min-width: 0;
    }
    .tx-font-card {
      flex: 0 0 auto;
      min-width: 140px;
      padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-size: 16px;
      text-align: center;
      scroll-snap-align: start;
      transition: all 0.12s ease;
      font-family: inherit;
      white-space: nowrap;
    }
    .tx-font-card.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }

    /* ═══════════ Rows + sliders ═══════════ */
    .tx-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      min-width: 0;
    }
    .tx-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .tx-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }
    .tx-slider-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }
    .tx-slider {
      flex: 1;
      accent-color: var(--accent);
      height: 4px;
      cursor: pointer;
      min-width: 0;
    }
    .tx-num {
      width: 62px;
      padding: 4px 6px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      outline: none;
      font-family: inherit;
      flex-shrink: 0;
    }
    .tx-num:focus { border-color: var(--accent); }

    /* ═══════════ Colors ═══════════ */
    .tx-color-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-width: 0;
    }
    .tx-color-input {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border: 2px solid var(--border);
      background: transparent;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
    .tx-hex {
      flex: 1;
      padding: 8px 10px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      font-family: monospace;
      outline: none;
      min-width: 0;
    }
    .tx-hex:focus { border-color: var(--accent); }

    /* ═══════════ Chips ═══════════ */
    .tx-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tx-chip {
      padding: 8px 14px;
      min-height: 36px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .tx-chip.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }

    /* ═══════════ Alignment ═══════════ */
    .tx-align-row {
      display: flex;
      gap: 8px;
    }
    .tx-align-btn {
      flex: 1;
      padding: 12px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .tx-align-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }

    /* ═══════════ Keyframe section ═══════════ */
    .tx-kf-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      width: 100%;
      min-width: 0;
    }
    .tx-kf-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .tx-kf-actions {
      display: flex;
      gap: 8px;
    }
    .tx-kf-btn {
      flex: 1;
      padding: 8px 10px;
      min-height: 38px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      white-space: nowrap;
    }
    .tx-kf-btn.primary {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .tx-kf-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 160px;
      overflow-y: auto;
      overflow-x: hidden;
      width: 100%;
      min-width: 0;
    }
    .tx-kf-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
    }
    .tx-kf-time {
      font-weight: 700;
      color: var(--accent);
      min-width: 48px;
      font-variant-numeric: tabular-nums;
    }
    .tx-kf-value {
      flex: 1;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tx-kf-del {
      background: transparent;
      border: 0;
      color: var(--muted);
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      flex-shrink: 0;
    }
    .tx-kf-empty {
      font-size: 11px;
      color: var(--muted);
      opacity: 0.65;
      padding: 4px;
      text-align: center;
    }

    /* ═══════════════════════════════════════════════════════════
       EASING CURVES — chota fixed-height scrollable shelf
       Sirf yeh shelf horizontally scroll karti hai.
       ═══════════════════════════════════════════════════════════ */
    .tx-ease-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      margin-top: 4px;
      border-top: 1px dashed var(--border);
      width: 100%;
      min-width: 0;
    }
    .tx-ease-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .tx-ease-shelf {
      display: flex;
      gap: 8px;
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 8px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
    }
    .tx-ease-shelf::-webkit-scrollbar {
      height: 5px;
    }
    .tx-ease-shelf::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    .tx-ease-card {
      flex: 0 0 90px;
      width: 90px;
      height: 68px;
      padding: 4px 4px 3px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      scroll-snap-align: start;
      transition: border-color 0.12s ease, box-shadow 0.12s ease;
      font-family: inherit;
    }
    .tx-ease-card:active { background: var(--surface-2); }
    .tx-ease-card.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }
    .tx-ease-card-curve {
      width: 100%;
      height: 40px;
      display: block;
      border-radius: 5px;
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .tx-ease-card.active .tx-ease-card-curve {
      background: var(--surface);
    }
    .tx-ease-card-name {
      font-size: 9px;
      font-weight: 600;
      text-align: center;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
      letter-spacing: 0.02em;
    }
    .tx-ease-card.active .tx-ease-card-name {
      color: var(--text);
    }

    /* ═══════════ Preview overlay ═══════════ */
    .tx-overlay {
      position: absolute;
      z-index: 45;
      pointer-events: none;
      white-space: pre-wrap;
      word-break: break-word;
      max-width: 94%;
      line-height: 1.15;
      user-select: none;
      will-change: transform, opacity;
    }
  `;
  document.head.appendChild(style);
}

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  currentSubView = 'options';
  router.openLevel('text', [], {
    title: 'Text',
    level: 2,
    renderMode: 'textPanel'
  });
}

export function renderTo(container, titleEl) {
  injectStyles();
  installBackInterceptor(container);
  renderCurrent(container);
}

function installBackInterceptor(container) {
  const backBtn = document.querySelector('#feature-back-btn');
  if (!backBtn) return;
  if (backBtn.__txHandler) {
    backBtn.removeEventListener('click', backBtn.__txHandler, true);
  }
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

  switch (currentSubView) {
    case 'options':    renderOptions(panel); break;
    case 'addText':    renderAddText(panel); break;
    case 'fonts':      renderFonts(panel); break;
    case 'stroke':     renderStroke(panel); break;
    case 'color':      renderColor(panel); break;
    case 'gradient':   renderGradient(panel); break;
    case 'shadows':    renderShadows(panel); break;
    case 'alignment':  renderAlignment(panel); break;
    case 'position':   renderPosition(panel); break;
    case 'scale':      renderScale(panel); break;
    case 'rotation':   renderRotation(panel); break;
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

function getCurrentContainer() {
  return document.querySelector('#feature-shelf');
}

// ─── Options ───────────────────────────────────────────────────
function renderOptions(panel) {
  const grid = document.createElement('div');
  grid.className = 'tx-options-grid';

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

    grid.appendChild(btn);
  });

  panel.appendChild(grid);
}

// ─── Add Text ──────────────────────────────────────────────────
function renderAddText(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Type your text';

  const ta = document.createElement('textarea');
  ta.className = 'tx-textarea';
  ta.placeholder = 'Enter text…';
  ta.value = ts.content;

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'tx-apply-btn';
  apply.textContent = '✓ Apply';

  apply.addEventListener('click', () => {
    const val = ta.value.trim();
    if (!val) return;
    ts.content = val;
    commitTextToPreview();
    commitTextToTimeline();
    goto('options');
  });

  card.append(title, ta, apply);
  panel.appendChild(card);

  setTimeout(() => ta.focus(), 50);
}

// ─── Fonts ─────────────────────────────────────────────────────
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
    btn.style.fontFamily = `"${font}", sans-serif`;
    if (ts.fontFamily === font) btn.classList.add('active');

    btn.addEventListener('click', () => {
      ts.fontFamily = font;
      scroll.querySelectorAll('.tx-font-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
    });

    scroll.appendChild(btn);
  });

  card.append(title, scroll);
  panel.appendChild(card);
}

// ─── Stroke ────────────────────────────────────────────────────
function renderStroke(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Stroke (Outline)';

  card.appendChild(makeSlider('Width', 0, 30, 1, ts.strokeWidth, v => {
    ts.strokeWidth = v;
    refreshOverlay();
  }));

  card.appendChild(makeColorRow('Color', ts.strokeColor, v => {
    ts.strokeColor = v;
    refreshOverlay();
  }));

  panel.appendChild(card);
}

// ─── Color ─────────────────────────────────────────────────────
function renderColor(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Solid Color';

  card.appendChild(makeColorRow('Color', ts.color, v => {
    ts.color = v;
    ts.gradientEnabled = false;
    refreshOverlay();
  }));

  panel.appendChild(card);
}

// ─── Gradient ──────────────────────────────────────────────────
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
    refreshOverlay();
  });
  chips.appendChild(onChip);
  card.appendChild(chips);

  card.appendChild(makeColorRow('Color A', ts.gradientColor1, v => {
    ts.gradientColor1 = v;
    ts.gradientEnabled = true;
    onChip.textContent = 'ON';
    onChip.classList.add('active');
    refreshOverlay();
  }));
  card.appendChild(makeColorRow('Color B', ts.gradientColor2, v => {
    ts.gradientColor2 = v;
    ts.gradientEnabled = true;
    onChip.textContent = 'ON';
    onChip.classList.add('active');
    refreshOverlay();
  }));
  card.appendChild(makeSlider('Angle', 0, 360, 1, ts.gradientAngle, v => {
    ts.gradientAngle = v;
    refreshOverlay();
  }));

  panel.appendChild(card);
}

// ─── Shadows ───────────────────────────────────────────────────
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
    refreshOverlay();
  });
  chips.appendChild(onChip);
  card.appendChild(chips);

  card.appendChild(makeColorRow('Color', ts.shadowColor, v => {
    ts.shadowColor = v;
    ts.shadowEnabled = true;
    onChip.textContent = 'ON';
    onChip.classList.add('active');
    refreshOverlay();
  }));
  card.appendChild(makeSlider('Blur',    0, 40, 1, ts.shadowBlur,    v => { ts.shadowBlur = v;    refreshOverlay(); }));
  card.appendChild(makeSlider('Offset X', -40, 40, 1, ts.shadowOffsetX, v => { ts.shadowOffsetX = v; refreshOverlay(); }));
  card.appendChild(makeSlider('Offset Y', -40, 40, 1, ts.shadowOffsetY, v => { ts.shadowOffsetY = v; refreshOverlay(); }));

  panel.appendChild(card);
}

// ─── Alignment ─────────────────────────────────────────────────
function renderAlignment(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Alignment';

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:11px;color:var(--muted);opacity:.7;';
  hint.textContent = 'Anchor point ke hisaab se text left / center / right shift hota hai.';

  const row = document.createElement('div');
  row.className = 'tx-align-row';

  const ALIGNS = [
    { key: 'left',   label: '⬅ Left' },
    { key: 'center', label: '⬌ Center' },
    { key: 'right',  label: '➡ Right' }
  ];

  ALIGNS.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-align-btn' + (ts.alignment === a.key ? ' active' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      ts.alignment = a.key;
      row.querySelectorAll('.tx-align-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      refreshOverlay();
    });
    row.appendChild(btn);
  });

  card.append(title, hint, row);
  panel.appendChild(card);
}

// ─── Position ──────────────────────────────────────────────────
function renderPosition(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Position';

  card.appendChild(makeSlider('X (%)', 0, 100, 0.1, ts.positionX, v => {
    ts.positionX = v;
    refreshOverlay();
  }));
  card.appendChild(makeSlider('Y (%)', 0, 100, 0.1, ts.positionY, v => {
    ts.positionY = v;
    refreshOverlay();
  }));

  card.appendChild(makeKeyframeSection({
    kind: 'position',
    list: ts.kfPosition,
    easeKey: 'easePosition',
    capture: () => ({ time: getCurrentTime(), x: ts.positionX, y: ts.positionY }),
    format: kf => `X ${kf.x.toFixed(1)}  Y ${kf.y.toFixed(1)}`,
    load: kf => {
      ts.positionX = kf.x;
      ts.positionY = kf.y;
      refreshOverlay();
    }
  }));

  panel.appendChild(card);
}

// ─── Scale ─────────────────────────────────────────────────────
function renderScale(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Scale';

  card.appendChild(makeSlider('Size (%)', 10, 300, 0.5, ts.scale, v => {
    ts.scale = v;
    refreshOverlay();
  }));

  card.appendChild(makeKeyframeSection({
    kind: 'scale',
    list: ts.kfScale,
    easeKey: 'easeScale',
    capture: () => ({ time: getCurrentTime(), value: ts.scale }),
    format: kf => `${kf.value.toFixed(1)}%`,
    load: kf => {
      ts.scale = kf.value;
      refreshOverlay();
    }
  }));

  panel.appendChild(card);
}

// ─── Rotation ──────────────────────────────────────────────────
function renderRotation(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Rotation';

  card.appendChild(makeSlider('Angle (°)', -180, 180, 0.5, ts.rotation, v => {
    ts.rotation = v;
    refreshOverlay();
  }));

  card.appendChild(makeKeyframeSection({
    kind: 'rotation',
    list: ts.kfRotation,
    easeKey: 'easeRotation',
    capture: () => ({ time: getCurrentTime(), value: ts.rotation }),
    format: kf => `${kf.value.toFixed(1)}°`,
    load: kf => {
      ts.rotation = kf.value;
      refreshOverlay();
    }
  }));

  panel.appendChild(card);
}

// ─── Opacity ───────────────────────────────────────────────────
function renderOpacity(panel) {
  const card = document.createElement('div');
  card.className = 'tx-card';

  const title = document.createElement('div');
  title.className = 'tx-card-title';
  title.textContent = 'Opacity';

  card.appendChild(makeSlider('Value (%)', 0, 100, 1, ts.opacity, v => {
    ts.opacity = v;
    refreshOverlay();
  }));

  panel.appendChild(card);
}

// ─── Animations ────────────────────────────────────────────────
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
      replayAnimation();
    });

    scroll.appendChild(btn);
  });

  card.append(title, scroll);

  card.appendChild(makeSlider('Duration (s)', 0.2, 3, 0.1, ts.animationDuration, v => {
    ts.animationDuration = v;
    replayAnimation();
  }));

  panel.appendChild(card);
}

// ================================================================
//  Keyframe section
// ================================================================
function makeKeyframeSection({ kind, list, easeKey, capture, format, load }) {
  const section = document.createElement('div');
  section.className = 'tx-kf-section';

  const title = document.createElement('div');
  title.className = 'tx-kf-title';
  title.textContent = 'Keyframes';

  const actions = document.createElement('div');
  actions.className = 'tx-kf-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'tx-kf-btn';
  previewBtn.textContent = '▶ Preview';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tx-kf-btn primary';
  addBtn.textContent = '+ Add at ' + formatTime(getCurrentTime());

  addBtn.addEventListener('click', () => {
    const kf = capture();
    const filtered = list.filter(k => Math.abs(k.time - kf.time) > 0.05);
    filtered.push(kf);
    filtered.sort((a, b) => a.time - b.time);
    list.length = 0;
    filtered.forEach(k => list.push(k));
    refreshCurrentPanel();
  });

  previewBtn.addEventListener('click', () => {
    if (!list.length) return;
    previewKeyframes(kind);
  });

  actions.append(previewBtn, addBtn);
  section.append(title, actions);

  const listEl = document.createElement('div');
  listEl.className = 'tx-kf-list';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'tx-kf-empty';
    empty.textContent = 'No keyframes yet. Scrub timeline then "+ Add".';
    listEl.appendChild(empty);
  } else {
    list.forEach(kf => {
      const item = document.createElement('div');
      item.className = 'tx-kf-item';

      const t = document.createElement('span');
      t.className = 'tx-kf-time';
      t.textContent = formatTime(kf.time);

      const v = document.createElement('span');
      v.className = 'tx-kf-value';
      v.textContent = format(kf);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'tx-kf-del';
      del.textContent = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = list.indexOf(kf);
        if (idx >= 0) list.splice(idx, 1);
        refreshCurrentPanel();
      });

      item.addEventListener('click', () => {
        const video = document.querySelector('#preview-video');
        if (video && Number.isFinite(kf.time)) {
          video.currentTime = kf.time;
        }
        load(kf);
      });

      item.append(t, v, del);
      listEl.appendChild(item);
    });
  }

  section.appendChild(listEl);

  // ⬇ Easing shelf (small, scrollable horizontally)
  section.appendChild(makeEasingSelector(easeKey));

  return section;
}

// ================================================================
//  Easing selector — chota fixed-height scrollable shelf
// ================================================================
function makeEasingSelector(easeKey) {
  const row = document.createElement('div');
  row.className = 'tx-ease-row';

  const label = document.createElement('div');
  label.className = 'tx-ease-label';
  label.textContent = 'Easing (swipe →)';
  row.appendChild(label);

  const shelf = document.createElement('div');
  shelf.className = 'tx-ease-shelf';

  const cards = {};

  EASING_OPTIONS.forEach(opt => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tx-ease-card';
    card.dataset.ease = opt.key;
    if (ts[easeKey] === opt.key) card.classList.add('active');

    // SVG curve preview
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('tx-ease-card-curve');

    // baseline
    const mid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mid.setAttribute('x1', '0');   mid.setAttribute('y1', '20');
    mid.setAttribute('x2', '100'); mid.setAttribute('y2', '20');
    mid.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    mid.setAttribute('stroke-width', '0.6');
    svg.appendChild(mid);

    // start/end dots
    const dotA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dotA.setAttribute('cx', '4');   dotA.setAttribute('cy', '36');
    dotA.setAttribute('r', '1.8');
    dotA.setAttribute('fill', 'var(--muted)');
    const dotB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dotB.setAttribute('cx', '96');  dotB.setAttribute('cy', '4');
    dotB.setAttribute('r', '1.8');
    dotB.setAttribute('fill', 'var(--muted)');
    svg.append(dotA, dotB);

    // curve path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('d', buildCurvePath(opt.key, 100, 40, 4));
    svg.appendChild(path);

    const name = document.createElement('div');
    name.className = 'tx-ease-card-name';
    name.textContent = opt.label;

    card.append(svg, name);

    card.addEventListener('click', () => {
      ts[easeKey] = opt.key;
      Object.values(cards).forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    cards[opt.key] = card;
    shelf.appendChild(card);
  });

  row.appendChild(shelf);

  // Auto-scroll selected card into view (only the shelf scrolls)
  setTimeout(() => {
    const active = cards[ts[easeKey]];
    if (active && shelf.scrollWidth > shelf.clientWidth) {
      const target = active.offsetLeft - shelf.clientWidth / 2 + active.offsetWidth / 2;
      shelf.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, 60);

  return row;
}

function buildCurvePath(ease, w, h, pad) {
  const N = 48;
  const pts = [];
  const usableH = h - pad * 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = getEasedValue(t, ease);
    const px = t * w;
    const py = h - pad - y * usableH;
    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return 'M ' + pts.join(' L ');
}

// ================================================================
//  Easing math
// ================================================================
function getEasedValue(t, ease) {
  t = Math.max(0, Math.min(1, t));
  switch (ease) {
    case 'linear':        return t;
    case 'easeIn':        return t * t;
    case 'easeOut':       return 1 - (1 - t) * (1 - t);
    case 'easeInOut':     return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':   return t * t * t;
    case 'easeOutCubic':  return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeInBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'easeOutBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'easeInOutBack': {
      const c1 = 1.70158, c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 'easeOutBounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'easeOutElastic': {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    default:
      return t;
  }
}

function refreshCurrentPanel() {
  const c = getCurrentContainer();
  if (c) renderCurrent(c);
}

// ================================================================
//  Keyframe preview
// ================================================================
function previewKeyframes(kind) {
  const video = document.querySelector('#preview-video');
  if (!video) return;
  stopPreview();

  const list =
    kind === 'position' ? ts.kfPosition :
    kind === 'scale'    ? ts.kfScale    :
                          ts.kfRotation;
  const lastKf = list[list.length - 1];
  const endTime = lastKf ? lastKf.time : 0;

  video.currentTime = 0;
  video.play().catch(() => {});

  const loop = () => {
    if (video.paused || video.ended) {
      previewRAF = null;
      return;
    }
    const t = video.currentTime;

    if (kind === 'position' && ts.kfPosition.length) {
      const p = interpolatePosition(t);
      if (p) { ts.positionX = p.x; ts.positionY = p.y; }
    } else if (kind === 'scale' && ts.kfScale.length) {
      const s = interpolateScale(t);
      if (s !== null) ts.scale = s;
    } else if (kind === 'rotation' && ts.kfRotation.length) {
      const r = interpolateRotation(t);
      if (r !== null) ts.rotation = r;
    }

    refreshOverlay();

    if (endTime && t >= endTime) {
      video.pause();
      previewRAF = null;
      return;
    }
    previewRAF = requestAnimationFrame(loop);
  };
  previewRAF = requestAnimationFrame(loop);
}

function stopPreview() {
  if (previewRAF) cancelAnimationFrame(previewRAF);
  previewRAF = null;
}

function interpolatePosition(t) {
  const kfs = ts.kfPosition;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time)
    return { x: kfs[0].x, y: kfs[0].y };
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return { x: last.x, y: last.y };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, ts.easePosition);
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }
  }
  return { x: last.x, y: last.y };
}

function interpolateScale(t) {
  const kfs = ts.kfScale;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, ts.easeScale);
      return a.value + (b.value - a.value) * local;
    }
  }
  return last.value;
}

function interpolateRotation(t) {
  const kfs = ts.kfRotation;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, ts.easeRotation);
      return a.value + (b.value - a.value) * local;
    }
  }
  return last.value;
}

function getCurrentTime() {
  const video = document.querySelector('#preview-video');
  return video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
}

function formatTime(s) {
  if (!Number.isFinite(s)) s = 0;
  return s.toFixed(2) + 's';
}

// ================================================================
//  Small UI helpers
// ================================================================
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
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;
  slider.className = 'tx-slider';

  const num = document.createElement('input');
  num.type = 'number';
  num.min = min;
  num.max = max;
  num.step = step;
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

  input.addEventListener('input', () => {
    hex.value = input.value;
    onChange(input.value);
  });
  hex.addEventListener('change', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      input.value = v;
      onChange(v);
    } else {
      hex.value = input.value;
    }
  });

  r.append(input, hex);
  row.append(head, r);
  return row;
}

// ================================================================
//  Preview overlay
// ================================================================
function commitTextToPreview() {
  if (!ts.content) { removeOverlay(); return; }
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;

  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'tx-overlay';
    wrap.appendChild(overlayEl);
  }
  overlayEl.textContent = ts.content;
  applyOverlayStyle();
  replayAnimation();
}

function refreshOverlay() {
  if (!overlayEl) return;
  applyOverlayStyle();
}

function applyOverlayStyle() {
  if (!overlayEl) return;
  const o = overlayEl;

  o.textContent = ts.content;
  o.style.fontFamily = `"${ts.fontFamily}", sans-serif`;
  o.style.fontSize = ts.fontSize + 'px';
  o.style.fontWeight = ts.fontWeight;
  o.style.fontStyle = ts.fontStyle;
  o.style.textAlign = ts.alignment;
  o.style.opacity = String(Math.max(0, Math.min(100, ts.opacity)) / 100);

  o.style.left = ts.positionX + '%';
  o.style.top  = ts.positionY + '%';

  let tx = '-50%';
  let originX = '50%';
  if (ts.alignment === 'left')   { tx = '0%';   originX = '0%';   }
  if (ts.alignment === 'right')  { tx = '-100%'; originX = '100%'; }

  o.style.transformOrigin = `${originX} 50%`;
  o.style.transform =
    `translate(${tx}, -50%) scale(${ts.scale / 100}) rotate(${ts.rotation}deg)`;

  o.style.setProperty('--tx-scale', ts.scale / 100);
  o.style.setProperty('--tx-rot', ts.rotation + 'deg');

  if (ts.gradientEnabled) {
    o.style.background = `linear-gradient(${ts.gradientAngle}deg, ${ts.gradientColor1}, ${ts.gradientColor2})`;
    o.style.webkitBackgroundClip = 'text';
    o.style.backgroundClip = 'text';
    o.style.color = 'transparent';
    o.style.webkitTextFillColor = 'transparent';
  } else {
    o.style.background = 'none';
    o.style.webkitBackgroundClip = '';
    o.style.backgroundClip = '';
    o.style.color = ts.color;
    o.style.webkitTextFillColor = '';
  }

  o.style.webkitTextStroke = ts.strokeWidth > 0
    ? `${ts.strokeWidth}px ${ts.strokeColor}`
    : '';

  o.style.textShadow = ts.shadowEnabled
    ? `${ts.shadowOffsetX}px ${ts.shadowOffsetY}px ${ts.shadowBlur}px ${ts.shadowColor}`
    : '';
}

function replayAnimation() {
  if (!overlayEl) return;
  const key = ts.animation || 'none';
  applyAnimation(overlayEl, key, ts.animationDuration);
}

function removeOverlay() {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
}

// ================================================================
//  Timeline integration
// ================================================================
function commitTextToTimeline() {
  if (!ts.content) return;
  if (!appState.timeline.visual[0]) appState.timeline.visual[0] = [];
  const track = appState.timeline.visual[0];

  if (!textLayerId) textLayerId = 'tx-' + Date.now();

  const clipData = {
    name: ts.content,
    url: 'text://' + textLayerId,
    type: 'text/plain',
    __textId: textLayerId,
    textState: { ...ts }
  };

  const existingIdx = track.findIndex(c => c.__textId === textLayerId);
  let clipIndex;
  if (existingIdx >= 0) {
    track[existingIdx] = { ...track[existingIdx], ...clipData };
    clipIndex = existingIdx;
  } else {
    track.push(clipData);
    clipIndex = track.length - 1;
  }

  syncTextClipDom(clipIndex);
}

function syncTextClipDom(clipIndex) {
  const trackEl = document.querySelector(
    '.track[data-group="visual"][data-track-index="0"]'
  );
  if (!trackEl) return;
  const content = trackEl.querySelector('.track-content');
  if (!content) return;

  content.querySelectorAll(`.clip[data-text-id="${textLayerId}"]`)
    .forEach(el => el.remove());

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'clip';
  el.textContent = ts.content || 'Text';
  el.dataset.track = 'V1';
  el.dataset.clip = clipIndex;
  el.dataset.textId = textLayerId;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    document.querySelectorAll('.clip.selected').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    e.preventDefault();
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.clip.selected').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
  });

  content.appendChild(el);
}

function removeText() {
  removeOverlay();
  stopPreview();
  ts.content = '';

  if (textLayerId && appState.timeline.visual[0]) {
    const track = appState.timeline.visual[0];
    const idx = track.findIndex(c => c.__textId === textLayerId);
    if (idx >= 0) track.splice(idx, 1);
  }

  if (textLayerId) {
    document.querySelectorAll(`.clip[data-text-id="${textLayerId}"]`)
      .forEach(el => el.remove());
  }
  textLayerId = null;

  goto('options');
}