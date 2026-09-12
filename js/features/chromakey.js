// ================================================================
//  js/features/chromakey.js
//  Chroma key panel with 4 properties + interactive color picker.
//  Ratio-aware redraw via window.__previewDrawVideo.
// ================================================================

export const featureKey = 'chromakey';

const state = {
  keyColor: null,
  similarity: 30,
  smoothness: 20,
  spill: 50,
  intensity: 100,
  pickMode: false
};

let panelRefs = {};
let rafPending = false;
let loupeEl = null;
let hoverColor = null;

// ─── Ratio-aware draw helper ───────────────────────────────────
function drawVideoContained(ctx, video, canvas) {
  if (typeof window.__previewDrawVideo === 'function') {
    window.__previewDrawVideo(ctx, video, canvas);
    return;
  }
  // Fallback if previewCanvas hasn't initialised yet
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rectFn = window.__previewContainRect;
  const r = rectFn
    ? rectFn(video.videoWidth, video.videoHeight, canvas.width, canvas.height)
    : { x: 0, y: 0, w: canvas.width, h: canvas.height };
  try {
    ctx.drawImage(video, r.x, r.y, r.w, r.h);
  } catch (_) {}
}

let _cachedCtx = null;
let _cachedCanvas = null;
function getPreviewCtx(canvas) {
  if (!canvas) return null;
  if (_cachedCanvas !== canvas) {
    _cachedCanvas = canvas;
    try {
      _cachedCtx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (_) {
      _cachedCtx = canvas.getContext('2d');
    }
  }
  return _cachedCtx;
}

const CSS_ID = 'chromakey-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .ck-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0 0;
      padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px));
      width: 100%;
      max-width: 100%;
      min-width: 0;
      max-height: 72vh;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      box-sizing: border-box;
      scrollbar-width: thin;
    }
    .ck-panel::-webkit-scrollbar { width: 4px; }
    .ck-panel::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    .ck-panel * { box-sizing: border-box; }

    .ck-color-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      margin: 0 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      flex: 0 0 auto;
      min-width: 0;
    }
    .ck-swatch {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 2px solid var(--border);
      flex-shrink: 0;
      background:
        linear-gradient(45deg, #333 25%, transparent 25%) 0 0 / 8px 8px,
        linear-gradient(-45deg, #333 25%, transparent 25%) 0 4px / 8px 8px,
        linear-gradient(45deg, transparent 75%, #333 75%) 4px -4px / 8px 8px,
        linear-gradient(-45deg, transparent 75%, #333 75%) -4px 0 / 8px 8px,
        #1a1a1a;
    }
    .ck-color-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }
    .ck-color-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
    }
    .ck-color-value {
      font-size: 10px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ck-pick-btn,
    .ck-clear-btn {
      padding: 4px 10px;
      font-size: 11px;
      min-height: 30px;
      white-space: nowrap;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
      flex-shrink: 0;
    }
    .ck-pick-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      animation: ck-pulse 1s ease-in-out infinite;
    }
    @keyframes ck-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .ck-shelf-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      min-width: 0;
      padding: 0 8px;
      overflow: hidden;
      flex: 0 0 auto;
    }
    .ck-shelf-hint {
      font-size: 9px;
      color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.6;
      padding: 0 2px;
    }
    .ck-shelf {
      display: flex;
      gap: 8px;
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 0 8px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      touch-action: pan-x;
    }
    .ck-shelf::-webkit-scrollbar { height: 4px; }
    .ck-shelf::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .ck-card {
      flex: 0 0 200px;
      width: 200px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      scroll-snap-align: start;
    }
    .ck-card.is-intensity {
      border-color: var(--accent);
    }
    .ck-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-height: 18px;
    }
    .ck-card-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.1;
      white-space: nowrap;
    }
    .ck-card.is-intensity .ck-card-label {
      font-size: 13px;
    }
    .ck-card-value {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
      flex-shrink: 0;
    }
    .ck-card.is-intensity .ck-card-value {
      font-size: 13px;
    }
    .ck-card-slider {
      width: 100%;
      accent-color: var(--accent);
      height: 4px;
      cursor: pointer;
      margin: 0;
      touch-action: pan-x;
    }
    .ck-card.is-intensity .ck-card-slider {
      height: 5px;
    }
    .ck-card-hint {
      font-size: 9px;
      color: var(--muted);
      line-height: 1.2;
      opacity: 0.6;
      min-height: 22px;
    }

    .ck-loupe {
      position: fixed;
      width: 78px;
      height: 78px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000;
      transform: translate(14px, 14px);
      transition: opacity 0.08s linear;
    }
    .ck-loupe.hidden { opacity: 0; }
    .ck-loupe-color { width: 100%; height: 100%; border-radius: 50%; }
    .ck-loupe-text {
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      font-weight: 700;
      color: #fff;
      background: rgba(0, 0, 0, 0.75);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.03em;
    }
    .ck-picking { cursor: crosshair !important; }

    @media (max-width: 380px) {
      .ck-panel {
        padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
      }
      .ck-card {
        flex: 0 0 180px;
        width: 180px;
        padding: 9px 10px;
      }
      .ck-card-label { font-size: 11px; }
      .ck-card-value { font-size: 11px; }
      .ck-card.is-intensity .ck-card-label { font-size: 12px; }
      .ck-card.is-intensity .ck-card-value { font-size: 12px; }
      .ck-swatch { width: 28px; height: 28px; }
      .ck-pick-btn, .ck-clear-btn { padding: 3px 8px; font-size: 10px; min-height: 28px; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  router.openLevel('chromakey', [], {
    title: 'Chroma Key',
    level: 2,
    renderMode: 'chromaKeyPanel'
  });
}

// ─── Render panel ──────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'ck-panel';
  container.appendChild(panel);
  panelRefs = {};

  // ═══════════════════════════════════════════════════════════
  //  1. COLOR ROW
  // ═══════════════════════════════════════════════════════════
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
    refreshCanvas();
  });

  colorRow.append(swatch, colorInfo, pickBtn, clearBtn);
  panel.appendChild(colorRow);

  panelRefs.swatch = swatch;
  panelRefs.colorValue = colorValue;
  panelRefs.pickBtn = pickBtn;

  // ═══════════════════════════════════════════════════════════
  //  2. HORIZONTAL SHELF — all 4 property cards
  // ═══════════════════════════════════════════════════════════
  const shelfWrap = document.createElement('div');
  shelfWrap.className = 'ck-shelf-wrap';

  const shelfHint = document.createElement('div');
  shelfHint.className = 'ck-shelf-hint';
  shelfHint.textContent = '← Swipe for more properties →';
  shelfWrap.appendChild(shelfHint);

  const shelf = document.createElement('div');
  shelf.className = 'ck-shelf';

  const CARD_DEFS = [
    { key: 'similarity', label: 'Similarity',        hint: 'Colors close to key color are removed' },
    { key: 'smoothness', label: 'Smoothness',        hint: 'Softens the edge around removed area' },
    { key: 'spill',      label: 'Spill Suppression', hint: 'Removes color bleed on subject edges' },
    { key: 'intensity',  label: 'Intensity',         hint: 'Overall removal strength (0–100%)', isIntensity: true }
  ];

  CARD_DEFS.forEach(def => {
    const card = document.createElement('div');
    card.className = 'ck-card' + (def.isIntensity ? ' is-intensity' : '');

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
      scheduleApply();
    });

    const hint = document.createElement('div');
    hint.className = 'ck-card-hint';
    hint.textContent = def.hint;

    card.append(head, slider, hint);
    shelf.appendChild(card);

    panelRefs[def.key] = { slider, value };
  });

  shelfWrap.appendChild(shelf);
  panel.appendChild(shelfWrap);

  // ─── Restore UI ───
  updateSwatchUI(state.keyColor);
  updatePickButtonUI();

  // Ensure pick mode is OFF when panel opens
  if (state.pickMode) togglePickMode(false);

  // Re-apply existing chroma key if any
  if (state.keyColor) scheduleApply();
}

function updateSwatchUI(rgb) {
  if (!panelRefs.swatch) return;
  panelRefs.swatch.style.background = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
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

function togglePickMode(on) {
  state.pickMode = on;
  updatePickButtonUI();

  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) return;

  if (on) {
    refreshCanvas();
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
    const ctx = getPreviewCtx(canvas);
    if (!ctx) return null;
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
  scheduleApply();
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
  el.querySelector('.ck-loupe-color').style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  el.querySelector('.ck-loupe-text').textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function hideLoupe() { if (loupeEl) loupeEl.classList.add('hidden'); }

function refreshCanvas() {
  const canvas = document.querySelector('#preview-canvas');
  const video = document.querySelector('#preview-video');
  if (!canvas || !video) return;
  const ctx = getPreviewCtx(canvas);
  if (!ctx) return;
  if (video.readyState >= 2 && video.videoWidth > 0) {
    drawVideoContained(ctx, video, canvas);
  }
}

function scheduleApply() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyChromaKey();
  });
}

function applyChromaKey() {
  const canvas = document.querySelector('#preview-canvas');
  const video = document.querySelector('#preview-video');
  if (!canvas) return;
  const ctx = getPreviewCtx(canvas);
  if (!ctx) return;

  // If video is not ready yet, do nothing (avoids cumulative processing)
  if (!video || video.readyState < 2 || !video.videoWidth) return;

  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tCtx = temp.getContext('2d', { willReadFrequently: true });

  drawVideoContained(tCtx, video, canvas);   // always fresh from video

  if (!state.keyColor) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);
    return;
  }

  const imgData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const kr = state.keyColor.r;
  const kg = state.keyColor.g;
  const kb = state.keyColor.b;
  const similarity = state.similarity / 100;
  const smoothness = state.smoothness / 100;
  const intensity  = state.intensity / 100;
  const spillAmt   = state.spill / 100;

  const maxDist = Math.sqrt(3 * 255 * 255) || 1;
  const simEnd  = similarity;
  const softEnd = similarity + smoothness;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / maxDist;

    let removal = 0;
    if (dist <= simEnd) {
      removal = 1;
    } else if (smoothness > 0 && dist <= softEnd) {
      removal = 1 - (dist - simEnd) / smoothness;
    }
    removal *= intensity;

    if (removal > 0) {
      data[i + 3] = Math.round(data[i + 3] * (1 - removal));
    }

    if (spillAmt > 0 && data[i + 3] > 0) {
      if (dist < softEnd + 0.15) {
        const proximity = 1 - Math.min(1, dist / (softEnd + 0.15));
        const blend = spillAmt * proximity * 0.8;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i]     = Math.round(r * (1 - blend) + gray * blend);
        data[i + 1] = Math.round(g * (1 - blend) + gray * blend);
        data[i + 2] = Math.round(b * (1 - blend) + gray * blend);
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imgData, 0, 0);
}