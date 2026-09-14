// ================================================================
//  js/features/colorWheel.js
//  Color Wheels (Shadows/Midtones/Highlights) + HDR.
//  Creates an effect LAYER. Preview + export via effectRenderer.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'colorWheel';
export const featureLabel = 'Color Wheel';
export const featureIcon = '🌈';

const DEFAULTS = {
  tones: {
    shadows:    { h: 0, s: 0, intensity: 0 },
    midtones:   { h: 0, s: 0, intensity: 0 },
    highlights: { h: 0, s: 0, intensity: 0 }
  },
  hdrWhite: 100
};

let state = JSON.parse(JSON.stringify(DEFAULTS));
let editingLayer = null;
let wheelRefs = {};
let hdrSlider = null;
let hdrDisplay = null;

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installColorWheelRenderer() {
  if (featuresRouter.__colorWheelInstalled) return;
  featuresRouter.__colorWheelInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'colorwheel') {
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
const CSS_ID = 'colorwheel-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .cw-panel {
      display: flex; flex-direction: column; gap: 10px;
      padding: 8px 0 200px;
      width: 100%; box-sizing: border-box;
      overflow: hidden;
    }
    .cw-panel * { box-sizing: border-box; }

    .cw-warn {
      padding: 10px 12px; background: rgba(255,107,107,0.12);
      border: 1px solid var(--danger); border-radius: 8px;
      font-size: 12px; color: var(--danger); font-weight: 700;
      margin: 0 8px;
    }
    .cw-badge {
      padding: 8px 12px; background: rgba(255,209,102,0.15);
      border: 1px solid #ffd166; border-radius: 8px;
      font-size: 11px; color: #ffd166; font-weight: 700;
      margin: 0 8px;
    }

    /* Horizontal wheel shelf */
    .cw-shelf {
      display: flex; gap: 12px; width: 100%;
      overflow-x: auto; overflow-y: hidden;
      padding: 8px 12px 16px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: thin; touch-action: pan-x;
    }
    .cw-shelf::-webkit-scrollbar { height: 5px; }
    .cw-shelf::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .cw-item {
      flex: 0 0 160px; width: 160px;
      display: flex; flex-direction: column;
      align-items: center; gap: 6px;
      scroll-snap-align: start;
    }

    .cw-item-head {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: 0 4px;
    }
    .cw-item-label {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--muted);
    }
    .cw-item-reset {
      background: transparent; border: 0; color: var(--muted);
      font-size: 14px; cursor: pointer; padding: 0 4px; opacity: 0.6;
    }

    .cw-wheel {
      width: 140px; height: 140px;
      border-radius: 50%;
      position: relative;
      cursor: crosshair;
      touch-action: none;
      background:
        radial-gradient(circle, #ffffff 0%, transparent 75%),
        conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
      box-shadow: inset 0 0 8px rgba(0,0,0,0.25),
                  0 3px 10px rgba(0,0,0,0.15);
      flex-shrink: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    .cw-puck {
      width: 16px; height: 16px;
      border: 2px solid #ffffff;
      background: transparent;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 2;
    }
    .cw-puck-dot {
      display: block; width: 3px; height: 3px;
      background: #fff; border-radius: 50%;
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%);
    }

    .cw-int-row {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 2px 6px;
    }
    .cw-int-slider {
      flex: 1; accent-color: var(--accent);
      height: 3px; cursor: pointer;
    }
    .cw-int-value {
      font-size: 11px; font-weight: 700;
      min-width: 34px; text-align: right;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .cw-hdr-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; margin: 0 8px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px;
    }
    .cw-hdr-label {
      font-size: 12px; font-weight: 700; color: var(--muted);
      min-width: 80px;
    }
    .cw-hdr-slider {
      flex: 1; accent-color: var(--accent);
      height: 5px; cursor: pointer;
    }
    .cw-hdr-value {
      font-size: 14px; font-weight: 700;
      min-width: 40px; text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .cw-remove-btn {
      padding: 10px 16px; margin: 0 8px; min-height: 44px;
      background: var(--surface); color: var(--danger);
      border: 1px solid var(--border); border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: inherit;
    }

    @media (max-width: 380px) {
      .cw-item { flex: 0 0 140px; width: 140px; }
      .cw-wheel { width: 120px; height: 120px; }
      .cw-puck { width: 14px; height: 14px; }
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER ENTRY
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  const sel = getSelectedEffectLayer('colorWheel');
  if (sel && sel.clip.effectState && sel.clip.effectState.colorWheel) {
    state = JSON.parse(JSON.stringify(sel.clip.effectState.colorWheel));
    editingLayer = sel;
  } else {
    state = JSON.parse(JSON.stringify(DEFAULTS));
    editingLayer = null;
  }

  router.openLevel('colorWheel', [], {
    title: 'Color Wheels',
    level: 2,
    renderMode: 'colorwheel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();
  wheelRefs = {};

  const panel = document.createElement('div');
  panel.className = 'cw-panel';

  if (!hasSelectedLayer()) {
    const warn = document.createElement('div');
    warn.className = 'cw-warn';
    warn.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(warn);
    container.appendChild(panel);
    return;
  }

  if (editingLayer) {
    const badge = document.createElement('div');
    badge.className = 'cw-badge';
    badge.textContent = '✏️ Editing: ' + (editingLayer.clip.name || 'Color Wheel');
    panel.appendChild(badge);
  }

  // ─── Wheels shelf ─────────────────────────────────────────
  const shelf = document.createElement('div');
  shelf.className = 'cw-shelf';

  const toneKeys = ['shadows', 'midtones', 'highlights'];
  const toneLabels = ['Shadows', 'Midtones', 'Highlights'];

  toneKeys.forEach((key, idx) => {
    const item = document.createElement('div');
    item.className = 'cw-item';

    const head = document.createElement('div');
    head.className = 'cw-item-head';

    const label = document.createElement('span');
    label.className = 'cw-item-label';
    label.textContent = toneLabels[idx];

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺';
    resetBtn.type = 'button';
    resetBtn.className = 'cw-item-reset';
    resetBtn.addEventListener('click', () => {
      const tone = state.tones[key];
      tone.h = 0; tone.s = 0; tone.intensity = 0;
      const ref = wheelRefs[key];
      if (ref) {
        ref.intSlider.value = 0;
        ref.intDisplay.textContent = '0%';
        updatePuck(key, 0, 0);
      }
      applyToLayer();
      refreshPreview();
    });

    head.append(label, resetBtn);

    // Wheel
    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'cw-wheel';

    const puck = document.createElement('div');
    puck.className = 'cw-puck';
    const dot = document.createElement('span');
    dot.className = 'cw-puck-dot';
    puck.appendChild(dot);
    wheelWrap.appendChild(puck);

    // Intensity slider
    const intRow = document.createElement('div');
    intRow.className = 'cw-int-row';

    const intSlider = document.createElement('input');
    intSlider.type = 'range';
    intSlider.min = 0; intSlider.max = 100; intSlider.value = 0;
    intSlider.className = 'cw-int-slider';

    const intDisplay = document.createElement('span');
    intDisplay.className = 'cw-int-value';
    intDisplay.textContent = '0%';

    intRow.append(intSlider, intDisplay);

    item.append(head, wheelWrap, intRow);
    shelf.appendChild(item);

    wheelRefs[key] = { wheel: wheelWrap, puck, intSlider, intDisplay };

    // ─── Picker interaction ──────────────────────────────────
    function getCoords(e) {
      const rect = wheelWrap.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - rect.left, y: cy - rect.top, w: rect.width, h: rect.height };
    }

    function handlePick(e) {
      e.preventDefault();
      const { x, y, w, h } = getCoords(e);
      const cx = w / 2, cy = h / 2;
      const dx = x - cx, dy = y - cy;
      const radius = Math.min(w, h) / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, radius);
      const sat = Math.round((clampedDist / radius) * 100);
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      const hue = Math.round(angle);

      state.tones[key].h = hue;
      state.tones[key].s = sat;
      updatePuck(key, hue, sat);
      applyToLayer();
      refreshPreview();
    }

    wheelWrap.addEventListener('mousedown', (e) => {
      handlePick(e);
      const onMove = (ev) => handlePick(ev);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    wheelWrap.addEventListener('touchstart', (e) => {
      handlePick(e);
      const onMove = (ev) => { ev.preventDefault(); handlePick(ev); };
      const onUp = () => {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }, { passive: false });

    intSlider.addEventListener('input', () => {
      const val = parseFloat(intSlider.value);
      intDisplay.textContent = Math.round(val) + '%';
      state.tones[key].intensity = val;
      applyToLayer();
      refreshPreview();
    });
  });

  panel.appendChild(shelf);

  // ─── HDR White ────────────────────────────────────────────
  const hdrRow = document.createElement('div');
  hdrRow.className = 'cw-hdr-row';

  const hdrLabel = document.createElement('span');
  hdrLabel.className = 'cw-hdr-label';
  hdrLabel.textContent = 'HDR White';

  hdrSlider = document.createElement('input');
  hdrSlider.type = 'range';
  hdrSlider.min = 0;
  hdrSlider.max = 200;
  hdrSlider.value = state.hdrWhite;
  hdrSlider.className = 'cw-hdr-slider';

  hdrDisplay = document.createElement('span');
  hdrDisplay.className = 'cw-hdr-value';
  hdrDisplay.textContent = Math.round(state.hdrWhite);

  hdrRow.append(hdrLabel, hdrSlider, hdrDisplay);
  panel.appendChild(hdrRow);

  hdrSlider.addEventListener('input', () => {
    state.hdrWhite = parseFloat(hdrSlider.value);
    hdrDisplay.textContent = Math.round(state.hdrWhite);
    applyToLayer();
    refreshPreview();
  });

  // ─── Remove ───────────────────────────────────────────────
  if (editingLayer) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cw-remove-btn';
    removeBtn.textContent = '🗑 Remove Color Wheel Layer';
    removeBtn.addEventListener('click', () => {
      removeLayer();
      renderTo(container);
    });
    panel.appendChild(removeBtn);
  }

  // ─── Blank spacer for mobile ──────────────────────────────
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height:200px;width:100%;flex-shrink:0;';
  panel.appendChild(spacer);

  container.appendChild(panel);

  // Initial pucks
  setTimeout(() => {
    toneKeys.forEach(k => {
      const t = state.tones[k];
      updatePuck(k, t.h, t.s);
      const ref = wheelRefs[k];
      if (ref) {
        ref.intSlider.value = t.intensity;
        ref.intDisplay.textContent = Math.round(t.intensity) + '%';
      }
    });
  }, 30);
}

// ─── Update puck position ────────────────────────────────────
function updatePuck(toneKey, hue, sat) {
  const ref = wheelRefs[toneKey];
  if (!ref) return;
  const w = ref.wheel.getBoundingClientRect().width || 140;
  const radius = w / 2;
  const angleRad = (hue / 360) * 2 * Math.PI;
  const dist = (sat / 100) * radius;
  const x = radius + Math.cos(angleRad) * dist;
  const y = radius + Math.sin(angleRad) * dist;
  const pctX = (x / w) * 100;
  const pctY = (y / w) * 100;
  ref.puck.style.left = pctX + '%';
  ref.puck.style.top = pctY + '%';
  ref.puck.style.transform = 'translate(-50%, -50%)';
}

// ═══════════════════════════════════════════════════════════════
//  APPLY TO LAYER
// ═══════════════════════════════════════════════════════════════
function applyToLayer() {
  if (!hasSelectedLayer()) return;

  const payload = {
    colorWheel: {
      tones: JSON.parse(JSON.stringify(state.tones)),
      hdrWhite: state.hdrWhite
    }
  };

  if (editingLayer && editingLayer.clip && editingLayer.clip.__effectId) {
    updateEffectLayer(editingLayer.clip, payload);
  } else {
    const id = createEffectLayer('colorWheel', payload, 'Color Wheel');
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