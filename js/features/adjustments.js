// ================================================================
//  js/features/adjustments.js
//  Adjustments panel — creates/updates 'adjustment' effect layers.
//  Applies DOWNWARD (hierarchy).
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'adjustments';
export const featureLabel = 'Adjust';
export const featureIcon = '🎚️';

const ADJUSTMENTS = [
  { key: 'brightness',  label: 'Brightness'  },
  { key: 'contrast',    label: 'Contrast'    },
  { key: 'exposure',    label: 'Exposure'    },
  { key: 'whites',      label: 'Whites'      },
  { key: 'blacks',      label: 'Blacks'      },
  { key: 'shadows',     label: 'Shadows'     },
  { key: 'highlights',  label: 'Highlights'  },
  { key: 'clarity',     label: 'Clarity'     },
  { key: 'saturation',  label: 'Saturation'  },
  { key: 'vibrance',    label: 'Vibrance'    },
  { key: 'temperature', label: 'Temperature' },
  { key: 'tint',        label: 'Tint'        },
  { key: 'noise',       label: 'Noise'       },
  { key: 'sharpen',     label: 'Sharpen'     },
  { key: 'vignette',    label: 'Vignette'    },
  { key: 'reds',        label: 'Reds'        },
  { key: 'yellows',     label: 'Yellows'     },
  { key: 'greens',      label: 'Greens'      },
  { key: 'blues',       label: 'Blues'       },
  { key: 'purples',     label: 'Purples'     },
  { key: 'skinTones',   label: 'Skin Tones'  }
];

function makeDefaults() {
  const s = {};
  ADJUSTMENTS.forEach(a => { s[a.key] = 0; });
  return s;
}

let panelState = makeDefaults();
let editingLayer = null;
let sliderRefs = {};

(function installAdjustmentsRenderer() {
  if (featuresRouter.__adjustInstalled) return;
  featuresRouter.__adjustInstalled = true;
  const _orig = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'adjustmentsPanel') {
      this.title.textContent = view.title;
      this.backButton.hidden = view.level === 0;
      this.shelf.classList.remove('circle-shelf');
      this.shelf.style.cssText = '';
      this.shelf.replaceChildren();
      renderTo(this.shelf);
      return;
    }
    return _orig(view);
  };
})();

const CSS_ID = 'adjustments-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .aj-panel { display:flex;flex-direction:column;gap:8px;padding:8px 6px 14px;overflow-y:auto;max-height:72vh;width:100%;box-sizing:border-box; }
    .aj-warn { padding:10px 12px;background:rgba(255,107,107,0.12);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);font-weight:700; }
    .aj-badge { padding:8px 12px;background:rgba(255,209,102,0.15);border:1px solid #ffd166;border-radius:8px;font-size:11px;color:#ffd166;font-weight:700; }
    .aj-row { display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px; }
    .aj-head { display:flex;align-items:center;justify-content:space-between;gap:8px; }
    .aj-label { font-size:12px;font-weight:600;color:var(--text); }
    .aj-right { display:flex;align-items:center;gap:8px; }
    .aj-val { font-size:12px;font-weight:600;min-width:40px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums; }
    .aj-reset { background:transparent;border:0;color:var(--muted);font-size:14px;cursor:pointer;padding:0 2px;opacity:0.7; }
    .aj-slider { width:100%;accent-color:var(--accent);height:4px;cursor:pointer; }
    .aj-actions { display:flex;gap:8px;margin-top:4px; }
    .aj-btn { flex:1;padding:10px 12px;min-height:44px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit; }
    .aj-btn.danger { color:var(--danger); }
  `;
  document.head.appendChild(s);
}

export function open({ router }) {
  const sel = getSelectedEffectLayer('adjustment');
  if (sel && sel.clip.effectState && sel.clip.effectState.adjustments) {
    panelState = Object.assign(makeDefaults(), sel.clip.effectState.adjustments);
    editingLayer = sel;
  } else {
    panelState = makeDefaults();
    editingLayer = null;
  }

  router.openLevel('adjustments', [], {
    title: 'Adjustments',
    level: 2,
    renderMode: 'adjustmentsPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'aj-panel';
  sliderRefs = {};

  if (!hasSelectedLayer()) {
    const w = document.createElement('div');
    w.className = 'aj-warn';
    w.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(w);
  } else if (editingLayer) {
    const b = document.createElement('div');
    b.className = 'aj-badge';
    b.textContent = '✏️ Editing adjustment layer';
    panel.appendChild(b);
  }

  ADJUSTMENTS.forEach(adj => {
    const row = document.createElement('div');
    row.className = 'aj-row';

    const head = document.createElement('div');
    head.className = 'aj-head';

    const label = document.createElement('span');
    label.className = 'aj-label';
    label.textContent = adj.label;

    const right = document.createElement('div');
    right.className = 'aj-right';

    const v = panelState[adj.key] || 0;

    const val = document.createElement('span');
    val.className = 'aj-val';
    val.textContent = v > 0 ? '+' + v : String(v);

    const rst = document.createElement('button');
    rst.type = 'button';
    rst.className = 'aj-reset';
    rst.textContent = '↺';
    rst.addEventListener('click', (e) => {
      e.stopPropagation();
      panelState[adj.key] = 0;
      const ref = sliderRefs[adj.key];
      if (ref) { ref.slider.value = 0; ref.val.textContent = '0'; }
      applyToLayer();
    });

    right.append(val, rst);
    head.append(label, right);

    const sl = document.createElement('input');
    sl.type = 'range';
    sl.min = -100; sl.max = 100; sl.step = 1;
    sl.value = v;
    sl.className = 'aj-slider';

    sl.addEventListener('input', () => {
      const n = parseInt(sl.value, 10);
      panelState[adj.key] = n;
      val.textContent = n > 0 ? '+' + n : String(n);
      applyToLayer();
    });

    row.append(head, sl);
    panel.appendChild(row);

    sliderRefs[adj.key] = { slider: sl, val: val };
  });

  if (editingLayer) {
    const actions = document.createElement('div');
    actions.className = 'aj-actions';
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'aj-btn danger';
    rmBtn.textContent = '🗑 Remove Adjustment Layer';
    rmBtn.addEventListener('click', () => {
      removeLayer();
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });
    actions.appendChild(rmBtn);
    panel.appendChild(actions);
  }

  container.appendChild(panel);
}

function applyToLayer() {
  if (!hasSelectedLayer()) return;
  const adjustments = Object.assign({}, panelState);

  if (editingLayer && editingLayer.clip && editingLayer.clip.__effectId) {
    updateEffectLayer(editingLayer.clip, { adjustments: adjustments });
  } else {
    const id = createEffectLayer('adjustment', { adjustments: adjustments }, 'Adjustments');
    editingLayer = findEffectLayerById(id);
  }

  document.dispatchEvent(new CustomEvent('effects:refresh'));
}

function removeLayer() {
  if (!editingLayer) return;
  const appState = window.__appState;
  if (!appState) return;
  const tracks = appState.timeline.visual || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__effectId === editingLayer.clip.__effectId);
    if (idx >= 0) { track.splice(idx, 1); break; }
  }
  editingLayer = null;
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
}