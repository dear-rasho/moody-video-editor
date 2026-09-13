// ================================================================
//  js/features/filters.js
//  Filters panel — creates / updates 'filter' effect layers.
//  Layer has effectState = { kind:'filter', filters:{...} }
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'filters';

const FILTERS = [
  { key: 'brightness', label: 'Brightness', icon: '☀️', min: 0,   max: 200, step: 1,   def: 100, suffix: '%' },
  { key: 'contrast',   label: 'Contrast',   icon: '◐',  min: 0,   max: 200, step: 1,   def: 100, suffix: '%' },
  { key: 'saturation', label: 'Saturation', icon: '🎨', min: 0,   max: 200, step: 1,   def: 100, suffix: '%' },
  { key: 'hue',        label: 'Hue',        icon: '🌈', min: 0,   max: 360, step: 1,   def: 0,   suffix: '°' },
  { key: 'grayscale',  label: 'Grayscale',  icon: '⚪', min: 0,   max: 100, step: 1,   def: 0,   suffix: '%' },
  { key: 'sepia',      label: 'Sepia',      icon: '🟫', min: 0,   max: 100, step: 1,   def: 0,   suffix: '%' },
  { key: 'invert',     label: 'Invert',     icon: '🔄', min: 0,   max: 100, step: 1,   def: 0,   suffix: '%' },
  { key: 'blur',       label: 'Blur',       icon: '💧', min: 0,   max: 20,  step: 0.5, def: 0,   suffix: 'px' },
  { key: 'opacity',    label: 'Opacity',    icon: '👁️', min: 0,   max: 100, step: 1,   def: 100, suffix: '%' }
];

let panelState = makeDefaults();
let editingLayer = null;
let currentView = 'list';
let activeFilter = null;

function makeDefaults() {
  const s = {};
  FILTERS.forEach(f => { s[f.key] = f.def; });
  return s;
}

function hasAnyChange() {
  return FILTERS.some(f => panelState[f.key] !== f.def);
}

// ─── Router install ───────────────────────────────────────────
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
      renderTo(this.shelf);
      return;
    }
    return _origRender(view);
  };
})();

const CSS_ID = 'filters-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .fl-panel { display:flex; flex-direction:column; gap:10px; padding:10px 6px 14px; width:100%; box-sizing:border-box; }
    .fl-warn { padding:10px 12px; background:rgba(255,107,107,0.12); border:1px solid var(--danger); border-radius:8px; font-size:12px; color:var(--danger); font-weight:700; }
    .fl-badge { padding:8px 12px; background:rgba(255,209,102,0.15); border:1px solid #ffd166; border-radius:8px; font-size:11px; color:#ffd166; font-weight:700; }
    .fl-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(76px, 1fr)); gap:8px; }
    .fl-item { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:78px; padding:8px 4px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; color:var(--text); cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent; }
    .fl-item:active { background:var(--surface-3); }
    .fl-item.active { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
    .fl-icon { width:32px; height:32px; border-radius:50%; border:1px solid var(--border); display:grid; place-items:center; font-size:15px; background:var(--surface); }
    .fl-item.active .fl-icon { background:var(--accent); color:#000; }
    .fl-label { font-size:11px; font-weight:600; text-align:center; }
    .fl-value { font-size:9px; font-weight:700; color:var(--accent); font-variant-numeric:tabular-nums; min-height:11px; }
    .fl-card { display:flex; flex-direction:column; gap:12px; padding:14px; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; }
    .fl-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .fl-card-title { font-size:14px; font-weight:700; }
    .fl-reset { padding:6px 12px; min-height:34px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; }
    .fl-row { display:flex; align-items:center; gap:10px; }
    .fl-slider { flex:1; accent-color:var(--accent); height:5px; cursor:pointer; }
    .fl-num { width:68px; padding:6px 8px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:13px; text-align:right; font-variant-numeric:tabular-nums; outline:none; font-family:inherit; }
    .fl-hint { font-size:11px; color:var(--muted); text-align:center; opacity:0.7; }
    .fl-reset-all { padding:10px 14px; min-height:42px; background:var(--surface); color:var(--danger); border:1px solid var(--border); border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; width:100%; margin-top:4px; }
    .fl-notice { padding:10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; font-size:11px; color:var(--muted); text-align:center; }
  `;
  document.head.appendChild(s);
}

// ─── Back interceptor ─────────────────────────────────────────
function installBackInterceptor(container) {
  const backBtn = document.querySelector('#feature-back-btn');
  if (!backBtn) return;
  if (backBtn.__flHandler) backBtn.removeEventListener('click', backBtn.__flHandler, true);
  const handler = (e) => {
    if (currentView === 'list') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    currentView = 'list';
    activeFilter = null;
    renderTo(container);
  };
  backBtn.addEventListener('click', handler, true);
  backBtn.__flHandler = handler;
}

// ─── Router entry ─────────────────────────────────────────────
export function open({ router }) {
  currentView = 'list';
  activeFilter = null;

  // Load state from selected effect layer (kind 'filter')
  const sel = getSelectedEffectLayer('filter');
  if (sel && sel.clip.effectState && sel.clip.effectState.filters) {
    panelState = Object.assign(makeDefaults(), sel.clip.effectState.filters);
    editingLayer = sel;
  } else {
    panelState = makeDefaults();
    editingLayer = null;
  }

  router.openLevel('filters', [], {
    title: 'Filters',
    level: 2,
    renderMode: 'filtersPanel'
  });
}

// ─── Render ───────────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  installBackInterceptor(container);
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'fl-panel';

  if (!hasSelectedLayer()) {
    const w = document.createElement('div');
    w.className = 'fl-warn';
    w.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(w);
  } else if (editingLayer) {
    const b = document.createElement('div');
    b.className = 'fl-badge';
    b.textContent = '✏️ Editing filter layer';
    panel.appendChild(b);
  }

  if (currentView === 'list') renderList(panel);
  else renderSliderView(panel);

  container.appendChild(panel);
}

function renderList(panel) {
  const grid = document.createElement('div');
  grid.className = 'fl-grid';

  FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-item';
    if (panelState[f.key] !== f.def) btn.classList.add('active');

    const ic = document.createElement('span');
    ic.className = 'fl-icon';
    ic.textContent = f.icon;

    const lb = document.createElement('span');
    lb.className = 'fl-label';
    lb.textContent = f.label;

    const vl = document.createElement('span');
    vl.className = 'fl-value';
    vl.textContent = panelState[f.key] !== f.def
      ? panelState[f.key] + f.suffix : '';

    btn.append(ic, lb, vl);

    btn.addEventListener('click', () => {
      activeFilter = f.key;
      currentView = 'slider';
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });

    grid.appendChild(btn);
  });

  panel.appendChild(grid);

  if (hasAnyChange() && editingLayer) {
    const rst = document.createElement('button');
    rst.type = 'button';
    rst.className = 'fl-reset-all';
    rst.textContent = '↺ Reset All Filters';
    rst.addEventListener('click', () => {
      panelState = makeDefaults();
      applyToLayer();
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });
    panel.appendChild(rst);
  } else if (hasAnyChange() && !editingLayer) {
    const n = document.createElement('div');
    n.className = 'fl-notice';
    n.textContent = '👆 Tap a filter to create a new filter layer';
    panel.appendChild(n);
  }
}

function renderSliderView(panel) {
  const f = FILTERS.find(x => x.key === activeFilter);
  if (!f) { currentView = 'list'; renderTo(panel.parentElement); return; }

  const card = document.createElement('div');
  card.className = 'fl-card';

  const head = document.createElement('div');
  head.className = 'fl-card-head';

  const title = document.createElement('div');
  title.className = 'fl-card-title';
  title.textContent = f.icon + '  ' + f.label;

  const rst = document.createElement('button');
  rst.type = 'button';
  rst.className = 'fl-reset';
  rst.textContent = '↺ Reset';
  rst.addEventListener('click', () => {
    panelState[f.key] = f.def;
    applyToLayer();
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  });

  head.append(title, rst);
  card.appendChild(head);

  const row = document.createElement('div');
  row.className = 'fl-row';

  const sl = document.createElement('input');
  sl.type = 'range';
  sl.min = f.min; sl.max = f.max; sl.step = f.step;
  sl.value = panelState[f.key];
  sl.className = 'fl-slider';

  const num = document.createElement('input');
  num.type = 'number';
  num.min = f.min; num.max = f.max; num.step = f.step;
  num.value = panelState[f.key];
  num.className = 'fl-num';

  const commit = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    const cl = Math.max(f.min, Math.min(f.max, n));
    panelState[f.key] = cl;
    sl.value = cl;
    num.value = cl;
    applyToLayer();
  };

  sl.addEventListener('input', () => {
    const v = parseFloat(sl.value);
    num.value = v;
    panelState[f.key] = v;
    applyToLayer();
  });
  num.addEventListener('change', () => commit(num.value));
  num.addEventListener('blur', () => commit(num.value));

  row.append(sl, num);
  card.appendChild(row);

  const hint = document.createElement('div');
  hint.className = 'fl-hint';
  hint.textContent = 'Range ' + f.min + '–' + f.max + f.suffix + ' • Default ' + f.def + f.suffix;
  card.appendChild(hint);

  panel.appendChild(card);
}

// ─── Apply to layer ───────────────────────────────────────────
function applyToLayer() {
  if (!hasSelectedLayer()) return;

  const filters = Object.assign({}, panelState);

  if (editingLayer && editingLayer.clip && editingLayer.clip.__effectId) {
    updateEffectLayer(editingLayer.clip, { filters: filters });
  } else {
    const id = createEffectLayer('filter', { filters: filters }, 'Filter');
    editingLayer = findEffectLayerById(id);
  }
}