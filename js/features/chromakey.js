// ================================================================
//  js/features/chromakey.js
//  Chroma Key — creates an effect LAYER.
//  Color picker + 4 params. Preview + export via effectRenderer.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'chromakey';
export const featureLabel = 'Chroma Key';
export const featureIcon = '🟢';

const DEFAULTS = {
  keyColor: null,       // {r,g,b}
  similarity: 30,
  smoothness: 20,
  spill: 50,
  intensity: 100,
  pickMode: false
};

let state = Object.assign({}, DEFAULTS);
let editingLayer = null;
let panelRefs = {};
let loupeEl = null;
let hoverColor = null;

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installChromaRenderer() {
  if (featuresRouter.__chromaInstalled) return;
  featuresRouter.__chromaInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'chromaKeyPanel') {
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

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'chromakey-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .ck-panel {
      display: flex; flex-direction: column; gap: 10px;
      padding: 8px 0 140px; width: 100%; box-sizing: border-box;
      overflow-y: auto; max-height: 72vh;
    }
    .ck-panel * { box-sizing: border-box; }

    .ck-warn {
      padding: 10px 12px; background: rgba(255,107,107,0.12);
      border: 1px solid var(--danger); border-radius: 8px;
      font-size: 12px; color: var(--danger); font-weight: 700;
      margin: 0 8px;
    }
    .ck-badge {
      padding: 8px 12px; background: rgba(255,209,102,0.15);
      border: 1px solid #ffd166; border-radius: 8px;
      font-size: 11px; color: #ffd166; font-weight: 700;
      margin: 0 8px;
    }

    /* Color row */
    .ck-color-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; margin: 0 8px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 8px;
    }
    .ck-swatch {
      width: 40px; height: 40px; border-radius: 6px;
      border: 2px solid var(--border); flex-shrink: 0;
      background:
        linear-gradient(45deg, #333 25%, transparent 25%) 0 0 / 8px 8px,
        linear-gradient(-45deg, #333 25%, transparent 25%) 0 4px / 8px 8px,
        linear-gradient(45deg, transparent 75%, #333 75%) 4px -4px / 8px 8px,
        linear-gradient(-45deg, transparent 75%, #333 75%) -4px 0 / 8px 8px,
        #1a1a1a;
    }
    .ck-color-info {
      display: flex; flex-direction: column; gap: 2px;
      flex: 1; min-width: 0;
    }
    .ck-color-label {
      font-size: 11px; font-weight: 700; color: var(--text);
    }
    .ck-color-value {
      font-size: 10px; color: var(--muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ck-pick-btn, .ck-clear-btn {
      padding: 6px 12px; min-height: 32px;
      border-radius: 6px; border: 1px solid var(--border);
      background: var(--surface); color: var(--text);
      cursor: pointer; font-weight: 700; font-size: 12px;
      font-family: inherit; flex-shrink: 0;
    }
    .ck-pick-btn.active {
      background: var(--accent); color: #000; border-color: var(--accent);
      animation: ck-pulse 1s ease-in-out infinite;
    }
    @keyframes ck-pulse {
      0%, 100% { opacity: 1; } 50% { opacity: 0.6; }
    }

    /* Params shelf — horizontal scrollable */
    .ck-shelf {
      display: flex; gap: 8px; width: 100%;
      overflow-x: auto; overflow-y: hidden;
      padding: 2px 8px 10px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin; touch-action: pan-x;
    }
    .ck-shelf::-webkit-scrollbar { height: 5px; }
    .ck-shelf::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .ck-card {
      flex: 0 0 200px; width: 200px; padding: 10px 12px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px;
      display: flex; flex-direction: column; gap: 6px;
      scroll-snap-align: start;
    }
    .ck-card-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 6px; min-height: 18px;
    }
    .ck-card-label {
      font-size: 12px; font-weight: 700; color: var(--text);
    }
    .ck-card-value {
      font-size: 12px; font-weight: 700; color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .ck-card-slider {
      width: 100%; accent-color: var(--accent);
      height: 5px; cursor: pointer;
    }
    .ck-card-hint {
      font-size: 10px; color: var(--muted);
      line-height: 1.2; min-height: 22px; opacity: 0.75;
    }

    /* Loupe */
    .ck-loupe {
      position: fixed; width: 78px; height: 78px;
      border-radius: 50%; border: 3px solid #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7);
      pointer-events: none; z-index: 9999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #000;
      transform: translate(14px, 14px);
    }
    .ck-loupe.hidden { display: none; }
    .ck-loupe-color { width: 100%; height: 100%; border-radius: 50%; }
    .ck-loupe-text {
      position: absolute; bottom: -22px; left: 50%;
      transform: translateX(-50%);
      font-size: 10px; font-weight: 700; color: #fff;
      background: rgba(0,0,0,0.75);
      padding: 2px 8px; border-radius: 10px;
      white-space: nowrap;
    }
    .ck-picking { cursor: crosshair !important; }

    .ck-remove-btn {
      padding: 10px 16px; margin: 0 8px; min-height: 44px;
      background: var(--surface); color: var(--danger);
      border: 1px solid var(--border); border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: inherit;
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER ENTRY
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  // Load state from existing chroma layer if selected
  const sel = getSelectedEffectLayer('chroma');
  if (sel && sel.clip.effectState && sel.clip.effectState.chroma) {
    state = Object.assign({}, DEFAULTS, sel.clip.effectState.chroma);
    editingLayer = sel;
  } else {
    state = Object.assign({}, DEFAULTS);
    editingLayer = null;
  }

  router.openLevel('chromakey', [], {
    title: 'Chroma Key',
    level: 2,
    renderMode: 'chromaKeyPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'ck-panel';

  if (!hasSelectedLayer()) {
    const warn = document.createElement('div');
    warn.className = 'ck-warn';
    warn.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(warn);
    container.appendChild(panel);
    return;
  }

  if (editingLayer) {
    const badge = document.createElement('div');
    badge.className = 'ck-badge';
    badge.textContent = '✏️ Editing: ' + (editingLayer.clip.name || 'Chroma Key');
    panel.appendChild(badge);
  }

  // ─── Color row ─────────────────────────────────────────────
  const colorRow = document.createElement('div');
  colorRow.className = 'ck-color-row';

  const swatch = document.createElement('div');
  swatch.className = 'ck-swatch';

  const colorInfo = document.createElement('div');
  colorInfo.className = 'ck-color-info';

  const colorLabel = document.createElement('span');
  colorLabel.className = 'ck-color-label';
  colorLabel.textContent = 'Key Color';

  const colorValue = document.createElement('span');
  colorValue.className = 'ck-color-value';

  colorInfo.append(colorLabel, colorValue);

  const pickBtn = document.createElement('button');
  pickBtn.type = 'button';
  pickBtn.className = 'ck-pick-btn';
  pickBtn.textContent = '🎯 Pick';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'ck-clear-btn';
  clearBtn.textContent = '✕';

  pickBtn.addEventListener('click', () => togglePickMode(!state.pickMode));
  clearBtn.addEventListener('click', () => {
    state.keyColor = null;
    updateSwatchUI(null);
    togglePickMode(false);
    applyToLayer();
    refreshPreview();
  });

  colorRow.append(swatch, colorInfo, pickBtn, clearBtn);
  panel.appendChild(colorRow);

  panelRefs.swatch = swatch;
  panelRefs.colorValue = colorValue;
  panelRefs.pickBtn = pickBtn;

  // ─── Params shelf ──────────────────────────────────────────
  const shelf = document.createElement('div');
  shelf.className = 'ck-shelf';

  const CARD_DEFS = [
    { key: 'similarity', label: 'Similarity',        hint: 'Colors near key color are removed' },
    { key: 'smoothness', label: 'Smoothness',        hint: 'Softens edge around removed area' },
    { key: 'spill',      label: 'Spill Suppression', hint: 'Removes color bleed on edges' },
    { key: 'intensity',  label: 'Intensity',         hint: 'Overall removal strength' }
  ];

  CARD_DEFS.forEach(def => {
    const card = document.createElement('div');
    card.className = 'ck-card';

    const head = document.createElement('div');
    head.className = 'ck-card-head';

    const label = document.createElement('span');
    label.className = 'ck-card-label';
    label.textContent = def.label;

    const value = document.createElement('span');
    value.className = 'ck-card-value';
    value.textContent = state[def.key] + '%';

    head.append(label, value);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0; slider.max = 100; slider.step = 1;
    slider.value = state[def.key];
    slider.className = 'ck-card-slider';

    slider.addEventListener('input', () => {
      state[def.key] = parseInt(slider.value, 10);
      value.textContent = state[def.key] + '%';
      applyToLayer();
      refreshPreview();
    });

    const hint = document.createElement('div');
    hint.className = 'ck-card-hint';
    hint.textContent = def.hint;

    card.append(head, slider, hint);
    shelf.appendChild(card);

    panelRefs[def.key] = { slider, value };
  });

  panel.appendChild(shelf);

  // Remove layer
  if (editingLayer) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ck-remove-btn';
    removeBtn.textContent = '🗑 Remove Chroma Layer';
    removeBtn.addEventListener('click', () => {
      removeLayer();
      renderTo(container);
    });
    panel.appendChild(removeBtn);
  }

  updateSwatchUI(state.keyColor);
  updatePickButtonUI();

  if (state.pickMode) togglePickMode(false);

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  STATE SYNC
// ═══════════════════════════════════════════════════════════════
function updateSwatchUI(rgb) {
  if (!panelRefs.swatch) return;
  panelRefs.swatch.style.background = rgb
    ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    : '';
  if (panelRefs.colorValue) {
    panelRefs.colorValue.textContent = rgb
      ? `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`
      : 'Not set — tap 🎯 to pick';
  }
}

function updatePickButtonUI() {
  if (!panelRefs.pickBtn) return;
  if (state.pickMode) {
    panelRefs.pickBtn.classList.add('active');
    panelRefs.pickBtn.textContent = '✕ Cancel';
  } else {
    panelRefs.pickBtn.classList.remove('active');
    panelRefs.pickBtn.textContent = '🎯 Pick';
  }
}

// ═══════════════════════════════════════════════════════════════
//  PICK MODE (loupe on canvas)
// ═══════════════════════════════════════════════════════════════
function togglePickMode(on) {
  state.pickMode = on;
  updatePickButtonUI();

  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) return;

  if (on) {
    canvas.classList.add('ck-picking');
    canvas.addEventListener('mousemove', onHover);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick, true);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  } else {
    canvas.classList.remove('ck-picking');
    canvas.removeEventListener('mousemove', onHover);
    canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('click', onClick, true);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    hideLoupe();
  }
}

function clientToPixel(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / (rect.width || 1);
  const scaleY = canvas.height / (rect.height || 1);
  const px = Math.floor((clientX - rect.left) * scaleX);
  const py = Math.floor((clientY - rect.top) * scaleY);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
  return { px, py };
}

function readPixel(canvas, px, py) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const d = ctx.getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  } catch (_) { return null; }
}

function onHover(e) {
  if (!state.pickMode) return;
  const canvas = e.currentTarget;
  const p = clientToPixel(canvas, e.clientX, e.clientY);
  if (!p) { hideLoupe(); return; }
  const c = readPixel(canvas, p.px, p.py);
  if (!c) { hideLoupe(); return; }
  hoverColor = c;
  showLoupe(e.clientX, e.clientY, c);
}
function onLeave() { hideLoupe(); hoverColor = null; }
function onClick(e) {
  if (!state.pickMode) return;
  e.preventDefault(); e.stopPropagation();
  const canvas = e.currentTarget;
  const p = clientToPixel(canvas, e.clientX, e.clientY);
  if (!p) return;
  const c = readPixel(canvas, p.px, p.py);
  if (!c) return;
  applyKeyColor(c);
}
function onTouchStart(e) {
  if (!state.pickMode) return;
  e.preventDefault();
  const t = e.touches[0];
  const canvas = e.currentTarget;
  const p = clientToPixel(canvas, t.clientX, t.clientY);
  if (!p) return;
  const c = readPixel(canvas, p.px, p.py);
  if (!c) return;
  hoverColor = c;
  showLoupe(t.clientX, t.clientY, c);
}
function onTouchMove(e) {
  if (!state.pickMode) return;
  e.preventDefault();
  const t = e.touches[0];
  const canvas = e.currentTarget;
  const p = clientToPixel(canvas, t.clientX, t.clientY);
  if (!p) { hideLoupe(); return; }
  const c = readPixel(canvas, p.px, p.py);
  if (!c) return;
  hoverColor = c;
  showLoupe(t.clientX, t.clientY, c);
}
function onTouchEnd(e) {
  if (!state.pickMode) return;
  e.preventDefault();
  if (hoverColor) applyKeyColor(hoverColor);
}

function applyKeyColor(rgb) {
  state.keyColor = { r: rgb.r, g: rgb.g, b: rgb.b };
  updateSwatchUI(state.keyColor);
  togglePickMode(false);
  applyToLayer();
  refreshPreview();
}

function ensureLoupe() {
  if (loupeEl) return loupeEl;
  loupeEl = document.createElement('div');
  loupeEl.className = 'ck-loupe hidden';
  const colorDiv = document.createElement('div');
  colorDiv.className = 'ck-loupe-color';
  const textDiv = document.createElement('div');
  textDiv.className = 'ck-loupe-text';
  loupeEl.append(colorDiv, textDiv);
  document.body.appendChild(loupeEl);
  return loupeEl;
}
function showLoupe(clientX, clientY, rgb) {
  const el = ensureLoupe();
  el.classList.remove('hidden');
  el.style.left = clientX + 'px';
  el.style.top = clientY + 'px';
  el.querySelector('.ck-loupe-color').style.background =
    `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  el.querySelector('.ck-loupe-text').textContent =
    `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}
function hideLoupe() { if (loupeEl) loupeEl.classList.add('hidden'); }

// ═══════════════════════════════════════════════════════════════
//  APPLY TO LAYER
// ═══════════════════════════════════════════════════════════════
function applyToLayer() {
  if (!hasSelectedLayer()) return;

  const payload = {
    chroma: {
      keyColor: state.keyColor,
      similarity: state.similarity,
      smoothness: state.smoothness,
      spill: state.spill,
      intensity: state.intensity
    }
  };

  if (editingLayer && editingLayer.clip && editingLayer.clip.__effectId) {
    updateEffectLayer(editingLayer.clip, payload);
  } else {
    const id = createEffectLayer('chroma', payload, 'Chroma Key');
    editingLayer = findEffectLayerById(id);
  }
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

function refreshPreview() {
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  const eng = window.__playbackEngine;
  if (eng) {
    const t = eng.getTime();
    if (typeof window.__applyVisualEffects === 'function') {
      window.__applyVisualEffects(t);
    }
  }
}