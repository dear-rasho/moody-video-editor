// ================================================================
//  js/features/chromakey.js
//  Self-contained Chroma Key Panel (Premiere Pro style)
//  - Hover over video → loupe shows color under cursor
//  - Click → that color becomes key and is removed
//  - Similarity / Smoothness / Spill Suppression
//  - Intensity slider (0-100)
// ================================================================

export const featureKey = 'chromakey';

// ─── State ──────────────────────────────────────────────────────
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

// ─── Cached canvas context ─────────────────────────────────────
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

// ─── Inject CSS once ────────────────────────────────────────────
const CSS_ID = 'chromakey-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .ck-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 8px 14px;
      overflow-y: auto;
      max-height: 72vh;
      width: 100%;
    }
    .ck-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .ck-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .ck-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: 0.02em;
    }
    .ck-value {
      font-size: 12px;
      font-weight: 600;
      min-width: 44px;
      text-align: right;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .ck-slider {
      width: 100%;
      accent-color: var(--accent);
      height: 4px;
      cursor: pointer;
    }
    .ck-hint {
      font-size: 10px;
      color: var(--muted);
      line-height: 1.3;
      opacity: 0.7;
    }

    .ck-color-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .ck-swatch {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      border: 2px solid var(--border);
      flex-shrink: 0;
      background:
        linear-gradient(45deg, #333 25%, transparent 25%) 0 0 / 10px 10px,
        linear-gradient(-45deg, #333 25%, transparent 25%) 0 5px / 10px 10px,
        linear-gradient(45deg, transparent 75%, #333 75%) 5px -5px / 10px 10px,
        linear-gradient(-45deg, transparent 75%, #333 75%) -5px 0 / 10px 10px,
        #1a1a1a;
    }
    .ck-color-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .ck-color-value {
      font-size: 11px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ck-pick-btn,
    .ck-clear-btn {
      padding: 6px 12px;
      font-size: 12px;
      min-height: 36px;
      white-space: nowrap;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
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

    .ck-intensity-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--accent);
      border-radius: 10px;
      margin-top: 4px;
    }
    .ck-intensity-row .ck-label {
      font-size: 13px;
      font-weight: 700;
    }
    .ck-intensity-row .ck-value {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
    }
    .ck-intensity-row .ck-slider {
      height: 5px;
    }

    /* ─── Live loupe that follows the cursor over the video ─── */
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
    .ck-loupe.hidden {
      opacity: 0;
    }
    .ck-loupe-color {
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }
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

    /* When in pick mode, canvas cursor */
    .ck-picking {
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(style);
}

// ─── Router entry ───────────────────────────────────────────────
export function open({ router }) {
  router.openLevel('chromakey', [], {
    title: 'Chroma Key',
    level: 2,
    renderMode: 'chromaKeyPanel'
  });
}

// ─── Render panel ───────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'ck-panel';
  container.appendChild(panel);

  panelRefs = {};

  // ─── Color row ───────────────────────────────────────────────
  const colorRow = document.createElement('div');
  colorRow.className = 'ck-color-row';

  const swatch = document.createElement('div');
  swatch.className = 'ck-swatch';

  const colorInfo = document.createElement('div');
  colorInfo.className = 'ck-color-info';

  const colorLabel = document.createElement('span');
  colorLabel.className = 'ck-label';
  colorLabel.textContent = 'Key Color';

  const colorValue = document.createElement('span');
  colorValue.className = 'ck-color-value';

  colorInfo.append(colorLabel, colorValue);

  const pickBtn = document.createElement('button');
  pickBtn.type = 'button';
  pickBtn.className = 'ck-pick-btn';
  pickBtn.textContent = '🎯 Pick';
  pickBtn.setAttribute('aria-label', 'Pick key color from preview');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'ck-clear-btn';
  clearBtn.textContent = '✕';
  clearBtn.setAttribute('aria-label', 'Clear chroma key');

  pickBtn.addEventListener('click', () => togglePickMode(!state.pickMode));

  clearBtn.addEventListener('click', () => {
    state.keyColor = null;
    updateSwatchUI(null);
    togglePickMode(false);
    refreshCanvas();
    updateVideoVisibility();
  });

  colorRow.append(swatch, colorInfo, pickBtn, clearBtn);
  panel.appendChild(colorRow);

  panelRefs.swatch = swatch;
  panelRefs.colorValue = colorValue;
  panelRefs.pickBtn = pickBtn;

  // ─── 3 Premiere-style sliders ────────────────────────────────
  const sliderDefs = [
    { key: 'similarity', label: 'Similarity',       hint: 'Colors close to key color are removed' },
    { key: 'smoothness', label: 'Smoothness',       hint: 'Softens the edge around removed area' },
    { key: 'spill',      label: 'Spill Suppression',hint: 'Removes color bleed on subject edges' }
  ];

  sliderDefs.forEach(def => {
    const row = document.createElement('div');
    row.className = 'ck-row';

    const head = document.createElement('div');
    head.className = 'ck-row-head';

    const label = document.createElement('span');
    label.className = 'ck-label';
    label.textContent = def.label;

    const value = document.createElement('span');
    value.className = 'ck-value';
    value.textContent = state[def.key] + '%';

    head.append(label, value);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 100;
    slider.step = 1;
    slider.value = state[def.key];
    slider.className = 'ck-slider';

    slider.addEventListener('input', () => {
      state[def.key] = parseInt(slider.value, 10);
      value.textContent = state[def.key] + '%';
      scheduleApply();
    });

    const hint = document.createElement('span');
    hint.className = 'ck-hint';
    hint.textContent = def.hint;

    row.append(head, slider, hint);
    panel.appendChild(row);

    panelRefs[def.key] = { slider, value };
  });

  // ─── Intensity ───────────────────────────────────────────────
  const intensityRow = document.createElement('div');
  intensityRow.className = 'ck-intensity-row';

  const intHead = document.createElement('div');
  intHead.className = 'ck-row-head';

  const intLabel = document.createElement('span');
  intLabel.className = 'ck-label';
  intLabel.textContent = 'Intensity';

  const intValue = document.createElement('span');
  intValue.className = 'ck-value';
  intValue.textContent = state.intensity + '%';

  intHead.append(intLabel, intValue);

  const intSlider = document.createElement('input');
  intSlider.type = 'range';
  intSlider.min = 0;
  intSlider.max = 100;
  intSlider.step = 1;
  intSlider.value = state.intensity;
  intSlider.className = 'ck-slider';

  intSlider.addEventListener('input', () => {
    state.intensity = parseInt(intSlider.value, 10);
    intValue.textContent = state.intensity + '%';
    updateVideoVisibility();
    scheduleApply();
  });

  intensityRow.append(intHead, intSlider);
  panel.appendChild(intensityRow);

  panelRefs.intensity = { slider: intSlider, value: intValue };

  // ─── Restore state on reopen ─────────────────────────────────
  updateSwatchUI(state.keyColor);
  updatePickButtonUI();

  if (state.keyColor) {
    updateVideoVisibility();
    scheduleApply();
  }
}

// ─── Swatch / button UI ─────────────────────────────────────────
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

// ================================================================
//  Pick mode — hover shows loupe, click picks color
// ================================================================
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
    // Touch support
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

// ─── Screen → canvas pixel mapping ──────────────────────────────
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
  } catch (_) {
    return null;
  }
}

// ─── Hover handlers ─────────────────────────────────────────────
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

function onLeave() {
  hideLoupe();
  hoverColor = null;
}

// ─── Click handler (pick!) ──────────────────────────────────────
function onClick(e) {
  if (!state.pickMode) return;
  e.preventDefault();
  e.stopPropagation();

  const canvas = e.currentTarget;
  const p = clientToPixel(canvas, e.clientX, e.clientY);
  if (!p) return;
  const c = readPixel(canvas, p.px, p.py);
  if (!c) return;

  applyKeyColor(c);
}

// ─── Touch handlers ─────────────────────────────────────────────
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
  if (hoverColor) {
    applyKeyColor(hoverColor);
  }
}

// ─── Commit a picked color as key ───────────────────────────────
function applyKeyColor(rgb) {
  state.keyColor = { ...rgb };
  updateSwatchUI(state.keyColor);
  togglePickMode(false);
  updateVideoVisibility();
  scheduleApply();
}

// ─── Loupe ──────────────────────────────────────────────────────
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

function hideLoupe() {
  if (loupeEl) loupeEl.classList.add('hidden');
}

// ─── Frame refresh helpers ──────────────────────────────────────
function refreshCanvas() {
  const canvas = document.querySelector('#preview-canvas');
  const video = document.querySelector('#preview-video');
  if (!canvas || !video) return;
  const ctx = getPreviewCtx(canvas);
  if (!ctx) return;
  if (video.readyState >= 2 && video.videoWidth > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
}

// ─── Hide video overlay when key is active ──────────────────────
function updateVideoVisibility() {
  const video = document.querySelector('#preview-video');
  if (!video) return;
  if (state.keyColor && state.intensity > 0) {
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
  } else {
    video.style.opacity = '';
    video.style.pointerEvents = '';
  }
}

// ─── Throttled apply ────────────────────────────────────────────
function scheduleApply() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyChromaKey();
  });
}

// ─── Core chroma key processing ─────────────────────────────────
function applyChromaKey() {
  const canvas = document.querySelector('#preview-canvas');
  const video = document.querySelector('#preview-video');
  if (!canvas) return;
  const ctx = getPreviewCtx(canvas);
  if (!ctx) return;

  // Source frame
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tCtx = temp.getContext('2d');

  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    tCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    tCtx.drawImage(canvas, 0, 0);
  }

  if (!state.keyColor) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);
    return;
  }

  const imgData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const { r: kr, g: kg, b: kb } = state.keyColor;
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

    // Spill suppression
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