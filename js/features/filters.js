// ================================================================
//  js/features/filters.js
//  Self-contained Filters feature.
//
//  Flow:
//    Filters click → list of 9 filters
//    Tap a filter → slider view (with numeric input + reset)
//    Back button → returns to list; from list → returns to shelf
//
//  Applies CSS `filter` directly on the canvas element, so it
//  works DURING playback (browser compositor handles it live).
// ================================================================

import { featuresRouter } from './featuresRouter.js';

export const featureKey = 'filters';

// ─── Filter definitions ────────────────────────────────────────
const FILTERS = [
  { key: 'brightness', label: 'Brightness', icon: '☀️', min: 0,   max: 200, step: 1,   default: 100, suffix: '%' },
  { key: 'contrast',   label: 'Contrast',   icon: '◐',  min: 0,   max: 200, step: 1,   default: 100, suffix: '%' },
  { key: 'saturation', label: 'Saturation', icon: '🎨', min: 0,   max: 200, step: 1,   default: 100, suffix: '%' },
  { key: 'hue',        label: 'Hue',        icon: '🌈', min: 0,   max: 360, step: 1,   default: 0,   suffix: '°' },
  { key: 'grayscale',  label: 'Grayscale',  icon: '⚪', min: 0,   max: 100, step: 1,   default: 0,   suffix: '%' },
  { key: 'sepia',      label: 'Sepia',      icon: '🟫', min: 0,   max: 100, step: 1,   default: 0,   suffix: '%' },
  { key: 'invert',     label: 'Invert',     icon: '🔄', min: 0,   max: 100, step: 1,   default: 0,   suffix: '%' },
  { key: 'blur',       label: 'Blur',       icon: '💧', min: 0,   max: 20,  step: 0.5, default: 0,   suffix: 'px' },
  { key: 'opacity',    label: 'Opacity',    icon: '👁️', min: 0,   max: 100, step: 1,   default: 100, suffix: '%' }
];

// ─── State ─────────────────────────────────────────────────────
const state = {};
FILTERS.forEach(f => { state[f.key] = f.default; });

let currentView = 'list';       // 'list' | 'slider'
let activeFilter = null;

// ─── Router self-install ───────────────────────────────────────
(function installFiltersRenderer() {
  if (featuresRouter.__filtersInstalled) return;
  featuresRouter.__filtersInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'filtersPanel') {
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
const CSS_ID = 'filters-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .fl-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 6px 14px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-x: hidden;
    }
    .fl-panel * { box-sizing: border-box; max-width: 100%; }

    /* ─── Filter list grid ─── */
    .fl-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      gap: 8px;
      width: 100%;
      padding: 2px;
    }
    .fl-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 78px;
      padding: 8px 4px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      position: relative;
    }
    .fl-item:active { background: var(--surface-3); }
    .fl-item.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .fl-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border);
      display: grid;
      place-items: center;
      font-size: 15px;
      background: var(--surface);
    }
    .fl-item.active .fl-icon {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .fl-label {
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      line-height: 1.1;
    }
    .fl-value {
      font-size: 9px;
      font-weight: 700;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
      min-height: 11px;
      letter-spacing: 0.02em;
    }

    /* ─── Slider view card ─── */
    .fl-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 100%;
      min-width: 0;
    }
    .fl-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }
    .fl-card-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .fl-reset {
      flex-shrink: 0;
      padding: 6px 12px;
      min-height: 34px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }
    .fl-reset:active { background: var(--surface-3); }

    /* Slider row */
    .fl-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-width: 0;
    }
    .fl-slider {
      flex: 1 1 0;
      min-width: 0;
      accent-color: var(--accent);
      height: 5px;
      cursor: pointer;
      touch-action: pan-x;
    }
    .fl-num {
      width: 68px;
      flex: 0 0 68px;
      padding: 6px 8px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      outline: none;
      font-family: inherit;
    }
    .fl-num:focus { border-color: var(--accent); }

    .fl-hint {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.3;
      opacity: 0.7;
      text-align: center;
    }

    .fl-current {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      padding: 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-variant-numeric: tabular-nums;
    }

    .fl-reset-all {
      padding: 10px 14px;
      min-height: 42px;
      background: var(--surface);
      color: var(--danger);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      width: 100%;
      margin-top: 4px;
      -webkit-tap-highlight-color: transparent;
    }
    .fl-reset-all:active { background: var(--surface-3); }

    @media (max-width: 380px) {
      .fl-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px; }
      .fl-item { min-height: 72px; padding: 6px 3px; }
      .fl-icon { width: 28px; height: 28px; font-size: 13px; }
      .fl-label { font-size: 10px; }
      .fl-num { width: 58px; flex: 0 0 58px; font-size: 12px; }
      .fl-card { padding: 12px 10px; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Build the CSS filter string ───────────────────────────────
function cssFor(key, v) {
  switch (key) {
    case 'brightness': return `brightness(${v}%)`;
    case 'contrast':   return `contrast(${v}%)`;
    case 'saturation': return `saturate(${v}%)`;
    case 'hue':        return `hue-rotate(${v}deg)`;
    case 'grayscale':  return `grayscale(${v}%)`;
    case 'sepia':      return `sepia(${v}%)`;
    case 'invert':     return `invert(${v}%)`;
    case 'blur':       return `blur(${v}px)`;
    case 'opacity':    return `opacity(${v}%)`;
  }
  return '';
}

function buildFilterString() {
  const parts = [];
  FILTERS.forEach(f => {
    const v = state[f.key];
    if (v !== f.default) parts.push(cssFor(f.key, v));
  });
  return parts.join(' ');
}

// ─── Apply to canvas (CSS filter, works during playback) ───────
function applyFilterToCanvas() {
  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) return;
  const f = buildFilterString();
  if (f) {
    canvas.style.setProperty('filter', f, 'important');
  } else {
    canvas.style.removeProperty('filter');
  }
}

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  currentView = 'list';
  activeFilter = null;
  router.openLevel('filters', [], {
    title: 'Filters',
    level: 2,
    renderMode: 'filtersPanel'
  });
}

// ─── Render ────────────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  installBackInterceptor(container);
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'fl-panel';
  container.appendChild(panel);

  if (currentView === 'list') renderList(panel);
  else renderSliderView(panel);

  // Make sure canvas has the current filter applied
  applyFilterToCanvas();
}

// ─── Back button interceptor ───────────────────────────────────
function installBackInterceptor(container) {
  const backBtn = document.querySelector('#feature-back-btn');
  if (!backBtn) return;
  if (backBtn.__flHandler) {
    backBtn.removeEventListener('click', backBtn.__flHandler, true);
  }
  const handler = (e) => {
    if (currentView === 'list') return; // let it exit to shelf
    e.stopImmediatePropagation();
    e.preventDefault();
    currentView = 'list';
    activeFilter = null;
    renderTo(container);
  };
  backBtn.addEventListener('click', handler, true);
  backBtn.__flHandler = handler;
}

// ─── LIST view ─────────────────────────────────────────────────
function renderList(panel) {
  const grid = document.createElement('div');
  grid.className = 'fl-grid';

  FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-item';
    if (state[f.key] !== f.default) btn.classList.add('active');

    const icon = document.createElement('span');
    icon.className = 'fl-icon';
    icon.textContent = f.icon;

    const lbl = document.createElement('span');
    lbl.className = 'fl-label';
    lbl.textContent = f.label;

    const val = document.createElement('span');
    val.className = 'fl-value';
    val.textContent = state[f.key] !== f.default
      ? `${state[f.key]}${f.suffix}`
      : '';

    btn.append(icon, lbl, val);

    btn.addEventListener('click', () => {
      activeFilter = f.key;
      currentView = 'slider';
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });

    grid.appendChild(btn);
  });

  panel.appendChild(grid);
}

// ─── SLIDER view ───────────────────────────────────────────────
function renderSliderView(panel) {
  const f = FILTERS.find(x => x.key === activeFilter);
  if (!f) { currentView = 'list'; return; }

  const card = document.createElement('div');
  card.className = 'fl-card';

  // Header
  const head = document.createElement('div');
  head.className = 'fl-card-head';

  const title = document.createElement('div');
  title.className = 'fl-card-title';
  title.textContent = `${f.icon}  ${f.label}`;

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'fl-reset';
  resetBtn.textContent = '↺ Reset';
  resetBtn.addEventListener('click', () => {
    state[f.key] = f.default;
    applyFilterToCanvas();
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  });

  head.append(title, resetBtn);
  card.appendChild(head);

  // Slider + numeric
  const row = document.createElement('div');
  row.className = 'fl-row';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = f.min;
  slider.max = f.max;
  slider.step = f.step;
  slider.value = state[f.key];
  slider.className = 'fl-slider';

  const num = document.createElement('input');
  num.type = 'number';
  num.min = f.min;
  num.max = f.max;
  num.step = f.step;
  num.value = state[f.key];
  num.className = 'fl-num';

  const commit = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(f.min, Math.min(f.max, n));
    state[f.key] = clamped;
    slider.value = clamped;
    num.value = clamped;
    applyFilterToCanvas();
  };

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    num.value = v;
    state[f.key] = v;
    applyFilterToCanvas();
  });
  num.addEventListener('change', () => commit(num.value));
  num.addEventListener('blur', () => commit(num.value));

  row.append(slider, num);
  card.appendChild(row);

  // Range hint
  const hint = document.createElement('div');
  hint.className = 'fl-hint';
  hint.textContent = `Range ${f.min} – ${f.max}${f.suffix}  •  Default ${f.default}${f.suffix}`;
  card.appendChild(hint);

  // Current value badge
  if (state[f.key] !== f.default) {
    const badge = document.createElement('div');
    badge.className = 'fl-current';
    badge.textContent = `Current: ${state[f.key]}${f.suffix}`;
    card.appendChild(badge);
  }

  // Reset ALL
  const anyActive = FILTERS.some(x => state[x.key] !== x.default);
  if (anyActive) {
    const resetAll = document.createElement('button');
    resetAll.type = 'button';
    resetAll.className = 'fl-reset-all';
    resetAll.textContent = '↺ Reset All Filters';
    resetAll.addEventListener('click', () => {
      FILTERS.forEach(x => { state[x.key] = x.default; });
      applyFilterToCanvas();
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });
    card.appendChild(resetAll);
  }

  panel.appendChild(card);
}