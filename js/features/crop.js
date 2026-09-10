// ================================================================
//  js/features/crop.js
//  Fully self-contained Crop feature.
//
//  Features:
//    - Panel with 4 sliders (Top / Bottom / Left / Right) 0-95%
//    - 6 aspect-ratio quick presets (Free, 1:1, 16:9, 9:16, 4:3, 3:4)
//    - Reset Crop button
//    - Interactive overlay on the preview:
//        8 draggable handles (4 corners + 4 edges)
//        rule-of-thirds grid
//        dark mask outside the crop rect
//    - Preview canvas redraws the cropped region of the video
//
//  All styles + logic live in this file. No other file is touched.
// ================================================================
// ─── Self-install: patch router.render to handle 'cropPanel' ────
import { featuresRouter } from './featuresRouter.js';

(function installCropRenderer() {
  if (featuresRouter.__cropInstalled) return;
  featuresRouter.__cropInstalled = true;

  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'cropPanel') {
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

export const featureKey = 'crop';

// ─── State (persists between openings) ─────────────────────────
const state = {
  top: 0,        // percent 0..95
  bottom: 0,
  left: 0,
  right: 0,
  aspect: 'free',
  active: false
};

const MIN_REGION = 5; // keep at least 5% of the frame on each axis

// ─── Canvas context cache ──────────────────────────────────────
let cachedCtx = null;
let cachedCanvas = null;
function getPreviewCtx(canvas) {
  if (!canvas) return null;
  if (cachedCanvas !== canvas) {
    cachedCanvas = canvas;
    try {
      cachedCtx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (_) {
      cachedCtx = canvas.getContext('2d');
    }
  }
  return cachedCtx;
}

// ─── Refs ──────────────────────────────────────────────────────
let panelRefs = {};
let overlayEl = null;
let cropRectEl = null;
let handlesEl = {};
let dragging = null;
let rafPending = false;
let mutationObserver = null;
let resizeObserver = null;

// ─── CSS ───────────────────────────────────────────────────────
const CSS_ID = 'crop-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .cr-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 8px 14px;
      overflow-y: auto;
      max-height: 72vh;
      width: 100%;
    }
    .cr-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .cr-section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .cr-aspects {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .cr-aspect-btn {
      flex: 1 0 auto;
      min-width: 52px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s ease;
    }
    .cr-aspect-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .cr-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cr-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cr-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }
    .cr-value {
      font-size: 12px;
      font-weight: 600;
      min-width: 44px;
      text-align: right;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .cr-slider {
      width: 100%;
      accent-color: var(--accent);
      height: 4px;
      cursor: pointer;
    }
    .cr-reset-btn {
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      min-height: 40px;
    }
    .cr-reset-btn:active {
      background: var(--surface-3);
    }

    /* ─── Overlay on the preview canvas wrap ─── */
    .preview-canvas-wrap.crop-active { overflow: visible !important; }

    .cr-overlay {
      position: absolute;
      inset: 0;
      z-index: 50;
      pointer-events: none;
    }
    .cr-mask {
      position: absolute;
      background: rgba(0, 0, 0, 0.55);
      pointer-events: none;
    }
    .cr-rect {
      position: absolute;
      border: 2px solid #ffffff;
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.65),
        inset 0 0 0 1px rgba(0, 0, 0, 0.4);
      pointer-events: auto;
      box-sizing: border-box;
      z-index: 2;
    }
    .cr-handle {
      position: absolute;
      width: 22px;
      height: 22px;
      background: #ffffff;
      border: 2px solid #000;
      border-radius: 50%;
      z-index: 5;
      pointer-events: auto;
      cursor: pointer;
      touch-action: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    }
    .cr-handle.nw { top: -11px; left: -11px; cursor: nwse-resize; }
    .cr-handle.ne { top: -11px; right: -11px; cursor: nesw-resize; }
    .cr-handle.sw { bottom: -11px; left: -11px; cursor: nesw-resize; }
    .cr-handle.se { bottom: -11px; right: -11px; cursor: nwse-resize; }
    .cr-handle.n  { top: -11px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .cr-handle.s  { bottom: -11px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .cr-handle.w  { top: 50%; left: -11px; transform: translateY(-50%); cursor: ew-resize; }
    .cr-handle.e  { top: 50%; right: -11px; transform: translateY(-50%); cursor: ew-resize; }

    /* Rule-of-thirds grid inside crop rect */
    .cr-grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .cr-grid::before,
    .cr-grid::after {
      content: '';
      position: absolute;
      background: rgba(255, 255, 255, 0.28);
    }
    .cr-grid::before {
      top: 33.333%; left: 0; right: 0; height: 1px;
      box-shadow: 0 calc(33.333% + 1px) 0 0 rgba(255, 255, 255, 0.28);
    }
    .cr-grid::after {
      left: 33.333%; top: 0; bottom: 0; width: 1px;
      box-shadow: calc(33.333% + 1px) 0 0 0 rgba(255, 255, 255, 0.28);
    }
  `;
  document.head.appendChild(style);
}

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  router.openLevel('crop', [], {
    title: 'Crop',
    level: 2,
    renderMode: 'cropPanel'
  });
}

// ─── Render panel ──────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  state.active = true;
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'cr-panel';
  container.appendChild(panel);

  panelRefs = {};
  handlesEl = {};

  // ─── Aspect Ratio section ───────────────────────────────────
  const aspectSection = document.createElement('div');
  aspectSection.className = 'cr-section';

  const aspectTitle = document.createElement('div');
  aspectTitle.className = 'cr-section-title';
  aspectTitle.textContent = 'Aspect Ratio';

  const aspectsRow = document.createElement('div');
  aspectsRow.className = 'cr-aspects';

  const ASPECTS = [
    { key: 'free', label: 'Free' },
    { key: '1:1',  label: '1:1'  },
    { key: '16:9', label: '16:9' },
    { key: '9:16', label: '9:16' },
    { key: '4:3',  label: '4:3'  },
    { key: '3:4',  label: '3:4'  }
  ];

  panelRefs.aspectBtns = {};

  ASPECTS.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cr-aspect-btn';
    btn.textContent = a.label;
    btn.dataset.aspect = a.key;
    if (state.aspect === a.key) btn.classList.add('active');

    btn.addEventListener('click', () => {
      state.aspect = a.key;
      Object.values(panelRefs.aspectBtns).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyAspectPreset(a.key);
      syncSlidersFromState();
      updateOverlay();
      scheduleRedraw();
    });

    panelRefs.aspectBtns[a.key] = btn;
    aspectsRow.appendChild(btn);
  });

  aspectSection.append(aspectTitle, aspectsRow);
  panel.appendChild(aspectSection);

  // ─── Sliders section ────────────────────────────────────────
  const slidersSection = document.createElement('div');
  slidersSection.className = 'cr-section';

  const slidersTitle = document.createElement('div');
  slidersTitle.className = 'cr-section-title';
  slidersTitle.textContent = 'Crop Values';

  const sliderDefs = [
    { key: 'top',    label: 'Top'    },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left',   label: 'Left'   },
    { key: 'right',  label: 'Right'  }
  ];

  panelRefs.sliders = {};

  sliderDefs.forEach(def => {
    const row = document.createElement('div');
    row.className = 'cr-row';

    const head = document.createElement('div');
    head.className = 'cr-row-head';

    const label = document.createElement('span');
    label.className = 'cr-label';
    label.textContent = def.label;

    const value = document.createElement('span');
    value.className = 'cr-value';
    value.textContent = Math.round(state[def.key]) + '%';

    head.append(label, value);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 95;
    slider.step = 1;
    slider.value = Math.round(state[def.key]);
    slider.className = 'cr-slider';

    slider.addEventListener('input', () => {
      state[def.key] = parseInt(slider.value, 10);
      enforceConstraints(def.key);
      syncSlidersFromState();
      updateOverlay();
      scheduleRedraw();
    });

    row.append(head, slider);
    slidersSection.appendChild(row);

    panelRefs.sliders[def.key] = { slider, value };
  });

  panel.appendChild(slidersSection);

  // ─── Reset button ───────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'cr-reset-btn';
  resetBtn.textContent = '↺ Reset Crop';

  resetBtn.addEventListener('click', () => {
    state.top = 0; state.bottom = 0; state.left = 0; state.right = 0;
    state.aspect = 'free';
    Object.values(panelRefs.aspectBtns).forEach(b => b.classList.remove('active'));
    panelRefs.aspectBtns.free?.classList.add('active');
    syncSlidersFromState();
    updateOverlay();
    scheduleRedraw();
  });

  panel.appendChild(resetBtn);

  // ─── Mount overlay + observer ───────────────────────────────
  mountOverlay();
  observeShelfRemoval(container, panel);

  // ─── Initial render ─────────────────────────────────────────
  updateOverlay();
  scheduleRedraw();
}

// ─── Aspect preset logic ───────────────────────────────────────
function applyAspectPreset(key) {
  if (key === 'free') return;

  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;
  const wr = wrap.getBoundingClientRect();
  const frameAR = wr.width / wr.height || 1;

  const [aw, ah] = key.split(':').map(Number);
  const targetAR = aw / ah;

  let wPct, hPct;
  if (targetAR >= frameAR) {
    wPct = 90;
    hPct = (frameAR / targetAR) * wPct;
  } else {
    hPct = 90;
    wPct = (targetAR / frameAR) * hPct;
  }
  wPct = Math.min(wPct, 100);
  hPct = Math.min(hPct, 100);

  const sideEach = (100 - wPct) / 2;
  const tbEach   = (100 - hPct) / 2;

  state.left   = Math.round(sideEach);
  state.right  = Math.round(sideEach);
  state.top    = Math.round(tbEach);
  state.bottom = Math.round(tbEach);
}

function syncSlidersFromState() {
  if (!panelRefs.sliders) return;
  ['top', 'bottom', 'left', 'right'].forEach(k => {
    const ref = panelRefs.sliders[k];
    if (ref) {
      ref.slider.value = Math.round(state[k]);
      ref.value.textContent = Math.round(state[k]) + '%';
    }
  });
}

// ─── Constraints ───────────────────────────────────────────────
function enforceConstraints(changedKey) {
  switch (changedKey) {
    case 'top':
      if (state.top + state.bottom > 100 - MIN_REGION)
        state.bottom = Math.max(0, 100 - MIN_REGION - state.top);
      break;
    case 'bottom':
      if (state.top + state.bottom > 100 - MIN_REGION)
        state.top = Math.max(0, 100 - MIN_REGION - state.bottom);
      break;
    case 'left':
      if (state.left + state.right > 100 - MIN_REGION)
        state.right = Math.max(0, 100 - MIN_REGION - state.left);
      break;
    case 'right':
      if (state.left + state.right > 100 - MIN_REGION)
        state.left = Math.max(0, 100 - MIN_REGION - state.right);
      break;
  }
  ['top', 'bottom', 'left', 'right'].forEach(k => {
    state[k] = Math.max(0, Math.min(95, state[k]));
  });
}

// ─── Overlay: mount / update / unmount ─────────────────────────
function mountOverlay() {
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;

  document.querySelector('.cr-overlay')?.remove();
  wrap.classList.add('crop-active');

  overlayEl = document.createElement('div');
  overlayEl.className = 'cr-overlay';

  // 4 masks around the crop rect
  ['m-top', 'm-bottom', 'm-left', 'm-right'].forEach(cls => {
    const m = document.createElement('div');
    m.className = 'cr-mask ' + cls;
    overlayEl.appendChild(m);
  });

  cropRectEl = document.createElement('div');
  cropRectEl.className = 'cr-rect';

  const grid = document.createElement('div');
  grid.className = 'cr-grid';
  cropRectEl.appendChild(grid);

  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  HANDLES.forEach(pos => {
    const h = document.createElement('div');
    h.className = 'cr-handle ' + pos;
    h.dataset.handle = pos;
    h.addEventListener('pointerdown', onHandleDown);
    cropRectEl.appendChild(h);
    handlesEl[pos] = h;
  });

  overlayEl.appendChild(cropRectEl);
  wrap.appendChild(overlayEl);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateOverlay());
    resizeObserver.observe(wrap);
  }
}

function updateOverlay() {
  if (!overlayEl || !cropRectEl) return;

  const { top, bottom, left, right } = state;
  const rectW = Math.max(0, 100 - left - right);
  const rectH = Math.max(0, 100 - top - bottom);

  cropRectEl.style.left   = left   + '%';
  cropRectEl.style.top    = top    + '%';
  cropRectEl.style.width  = rectW  + '%';
  cropRectEl.style.height = rectH  + '%';

  const [mTop, mBottom, mLeft, mRight] =
    overlayEl.querySelectorAll('.cr-mask');

  if (mTop) {
    mTop.style.left = '0%'; mTop.style.right = '0%';
    mTop.style.top = '0%'; mTop.style.height = top + '%';
  }
  if (mBottom) {
    mBottom.style.left = '0%'; mBottom.style.right = '0%';
    mBottom.style.bottom = '0%'; mBottom.style.height = bottom + '%';
  }
  if (mLeft) {
    mLeft.style.left = '0%'; mLeft.style.top = top + '%';
    mLeft.style.bottom = bottom + '%'; mLeft.style.width = left + '%';
  }
  if (mRight) {
    mRight.style.right = '0%'; mRight.style.top = top + '%';
    mRight.style.bottom = bottom + '%'; mRight.style.width = right + '%';
  }
}

function unmountOverlay() {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  cropRectEl = null;
  handlesEl = {};
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (wrap) wrap.classList.remove('crop-active');
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
}

// ─── Handle dragging ───────────────────────────────────────────
function onHandleDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const handle = e.currentTarget.dataset.handle;
  if (!handle) return;

  dragging = {
    handle,
    startX: e.clientX,
    startY: e.clientY,
    startCrop: { ...state }
  };

  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

  window.addEventListener('pointermove', onHandleMove);
  window.addEventListener('pointerup', onHandleUp);
  window.addEventListener('pointercancel', onHandleUp);
}

function onHandleMove(e) {
  if (!dragging) return;
  e.preventDefault();

  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;
  const wr = wrap.getBoundingClientRect();

  const dxPct = ((e.clientX - dragging.startX) / wr.width) * 100;
  const dyPct = ((e.clientY - dragging.startY) / wr.height) * 100;

  const sc = dragging.startCrop;
  const { handle } = dragging;

  // Reset to starting values each frame for stability
  state.top    = sc.top;
  state.bottom = sc.bottom;
  state.left   = sc.left;
  state.right  = sc.right;

  if (handle.includes('n')) state.top    = sc.top    + dyPct;
  if (handle.includes('s')) state.bottom = sc.bottom - dyPct;
  if (handle.includes('w')) state.left   = sc.left   + dxPct;
  if (handle.includes('e')) state.right  = sc.right  - dxPct;

  ['top', 'bottom', 'left', 'right'].forEach(k => {
    state[k] = Math.max(0, Math.min(95, state[k]));
  });

  if (state.top + state.bottom > 100 - MIN_REGION) {
    if (handle.includes('n'))
      state.top = Math.max(0, 100 - MIN_REGION - state.bottom);
    else if (handle.includes('s'))
      state.bottom = Math.max(0, 100 - MIN_REGION - state.top);
  }
  if (state.left + state.right > 100 - MIN_REGION) {
    if (handle.includes('w'))
      state.left = Math.max(0, 100 - MIN_REGION - state.right);
    else if (handle.includes('e'))
      state.right = Math.max(0, 100 - MIN_REGION - state.left);
  }

  updateOverlay();
  syncSlidersFromState();
  scheduleRedraw();
}

function onHandleUp() {
  dragging = null;
  window.removeEventListener('pointermove', onHandleMove);
  window.removeEventListener('pointerup', onHandleUp);
  window.removeEventListener('pointercancel', onHandleUp);
}

// ─── Redraw canvas with crop applied ───────────────────────────
function scheduleRedraw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    drawCroppedFrame();
  });
}

function drawCroppedFrame() {
  const canvas = document.querySelector('#preview-canvas');
  const video  = document.querySelector('#preview-video');
  if (!canvas) return;
  const ctx = getPreviewCtx(canvas);
  if (!ctx) return;

  // Crop only applies to a video source for now.
  if (!video || video.readyState < 2 || !video.videoWidth) return;

  const sw = video.videoWidth;
  const sh = video.videoHeight;

  const sx = (state.left / 100) * sw;
  const sy = (state.top  / 100) * sh;
  const srcW = sw * (1 - (state.left + state.right) / 100);
  const srcH = sh * (1 - (state.top  + state.bottom) / 100);
  if (srcW <= 0 || srcH <= 0) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, sx, sy, srcW, srcH, 0, 0, canvas.width, canvas.height);
}

// ─── Cleanup when panel is removed ────────────────────────────
function observeShelfRemoval(container, panel) {
  if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  if (!container) return;
  mutationObserver = new MutationObserver(() => {
    if (!container.contains(panel)) cleanup();
  });
  mutationObserver.observe(container, { childList: true });
}

function cleanup() {
  if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  dragging = null;
  window.removeEventListener('pointermove', onHandleMove);
  window.removeEventListener('pointerup', onHandleUp);
  window.removeEventListener('pointercancel', onHandleUp);
  unmountOverlay();
  panelRefs = {};
  // Note: state persists, canvas stays cropped.
}