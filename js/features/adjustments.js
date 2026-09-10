// ================================================================
//  js/features/adjustments.js
//  Self-contained Adjustments Panel
//  Sliders: -100 .. +100, default 0
//  Per-pixel canvas processing
// ================================================================

export const featureKey = 'adjustments';

// ─── Adjustment definitions ─────────────────────────────────────
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

// ─── Module state ───────────────────────────────────────────────
const state = {};
ADJUSTMENTS.forEach(a => { state[a.key] = 0; });

let sliderRefs = {};
let rafPending = false;

// ─── Router entry ───────────────────────────────────────────────
export function open({ router }) {
  router.openLevel('adjustments', [], {
    title: 'Adjustments',
    level: 2,
    renderMode: 'adjustmentsPanel'
  });
}

// ─── Render panel ───────────────────────────────────────────────
export function renderTo(container) {
  container.replaceChildren();
  container.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:8px 6px 14px;' +
    'overflow-y:auto;max-height:72vh;width:100%;';

  sliderRefs = {};

  ADJUSTMENTS.forEach(adj => {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;flex-direction:column;gap:6px;padding:10px 12px;' +
      'background:var(--surface-2);border:1px solid var(--border);border-radius:10px;';

    // ---- Header: name (left) + value + reset (right) ----
    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:8px;';

    const label = document.createElement('span');
    label.textContent = adj.label;
    label.style.cssText =
      'font-size:12px;font-weight:600;color:var(--text);letter-spacing:0.02em;';

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = '0';
    valueDisplay.style.cssText =
      'font-size:12px;font-weight:600;min-width:40px;text-align:right;' +
      'color:var(--muted);font-variant-numeric:tabular-nums;';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = '↺';
    resetBtn.setAttribute('aria-label', `Reset ${adj.label}`);
    resetBtn.style.cssText =
      'background:transparent;border:0;color:var(--muted);font-size:14px;' +
      'cursor:pointer;padding:0 2px;opacity:0.7;';

    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state[adj.key] = 0;
      const ref = sliderRefs[adj.key];
      if (ref) {
        ref.slider.value = 0;
        ref.valueDisplay.textContent = '0';
      }
      scheduleApply();
    });

    right.append(valueDisplay, resetBtn);
    header.append(label, right);

    // ---- Slider ----
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = -100;
    slider.max = 100;
    slider.step = 1;
    slider.value = 0;
    slider.style.cssText =
      'width:100%;accent-color:var(--accent);height:4px;cursor:pointer;';

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      state[adj.key] = val;
      valueDisplay.textContent = val > 0 ? `+${val}` : `${val}`;
      scheduleApply();
    });

    row.append(header, slider);
    container.appendChild(row);

    sliderRefs[adj.key] = { slider, valueDisplay };
  });
}

// ─── Throttled apply via rAF ────────────────────────────────────
function scheduleApply() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyAdjustments();
  });
}

// ─── Core pixel processing ──────────────────────────────────────
function applyAdjustments() {
  const canvas = document.querySelector('#preview-canvas');
  const video  = document.querySelector('#preview-video');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1) Grab fresh source frame
  const temp = document.createElement('canvas');
  temp.width  = canvas.width;
  temp.height = canvas.height;
  const tCtx = temp.getContext('2d');

  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    tCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    tCtx.drawImage(canvas, 0, 0);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(temp, 0, 0);

  // 2) Skip if nothing active
  const anyActive = ADJUSTMENTS.some(a => state[a.key] !== 0);
  if (!anyActive) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;
  const s = state;
  const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

  // Precompute normalized amounts
  const brightnessAmt = s.brightness / 100;
  const contrastAmt   = s.contrast   / 100;
  const exposureAmt   = Math.pow(2, s.exposure / 100);
  const whitesAmt     = s.whites     / 100;
  const blacksAmt     = s.blacks     / 100;
  const shadowsAmt    = s.shadows    / 100;
  const highlightsAmt = s.highlights / 100;
  const clarityAmt    = s.clarity    / 100;
  const saturationAmt = s.saturation / 100;
  const vibranceAmt   = s.vibrance   / 100;
  const temperatureAmt= s.temperature/ 100;
  const tintAmt       = s.tint       / 100;
  const noiseAmt      = s.noise      / 100;
  const sharpenAmt    = s.sharpen    / 100;
  const vignetteAmt   = s.vignette   / 100;
  const redsAmt       = s.reds       / 100;
  const yellowsAmt    = s.yellows    / 100;
  const greensAmt     = s.greens     / 100;
  const bluesAmt      = s.blues      / 100;
  const purplesAmt    = s.purples    / 100;
  const skinAmt       = s.skinTones  / 100;

  const anyColorAdj =
    redsAmt || yellowsAmt || greensAmt || bluesAmt || purplesAmt || skinAmt;

  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const pixelIndex = i / 4;
    const px = pixelIndex % w;
    const py = (pixelIndex - px) / w;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // ---- Brightness ----
    if (brightnessAmt !== 0) {
      const add = brightnessAmt * 110;
      r += add; g += add; b += add;
    }

    // ---- Exposure ----
    if (exposureAmt !== 1) {
      r *= exposureAmt; g *= exposureAmt; b *= exposureAmt;
    }

    // ---- Contrast ----
    if (contrastAmt !== 0) {
      const f = 1 + contrastAmt;
      r = (r - 128) * f + 128;
      g = (g - 128) * f + 128;
      b = (b - 128) * f + 128;
    }

    // ---- Whites (bright pixels only) ----
    if (whitesAmt !== 0) {
      const wt = Math.max(0, (lum - 128) / 127);
      const add = whitesAmt * wt * 110;
      r += add; g += add; b += add;
    }

    // ---- Blacks (dark pixels only) ----
    if (blacksAmt !== 0) {
      const wt = Math.max(0, (128 - lum) / 128);
      const add = -blacksAmt * wt * 110;
      r += add; g += add; b += add;
    }

    // ---- Shadows ----
    if (shadowsAmt !== 0) {
      const wt = Math.max(0, (128 - lum) / 128);
      const add = shadowsAmt * wt * 90;
      r += add; g += add; b += add;
    }

    // ---- Highlights ----
    if (highlightsAmt !== 0) {
      const wt = Math.max(0, (lum - 128) / 127);
      const add = highlightsAmt * wt * 90;
      r += add; g += add; b += add;
    }

    // ---- Clarity (mid-tone contrast) ----
    if (clarityAmt !== 0) {
      const wt = 1 - Math.abs(lum - 128) / 128;
      const f = 1 + clarityAmt * wt * 0.7;
      r = (r - 128) * f + 128;
      g = (g - 128) * f + 128;
      b = (b - 128) * f + 128;
    }

    // ---- Saturation ----
    if (saturationAmt !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const f = 1 + saturationAmt;
      r = gray + (r - gray) * f;
      g = gray + (g - gray) * f;
      b = gray + (b - gray) * f;
    }

    // ---- Vibrance (protects already-saturated colors) ----
    if (vibranceAmt !== 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat  = (maxC - minC) / 255;
      const boost = vibranceAmt * (1 - sat) * 0.9;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * (1 + boost);
      g = gray + (g - gray) * (1 + boost);
      b = gray + (b - gray) * (1 + boost);
    }

    // ---- Temperature (warm + / cool -) ----
    if (temperatureAmt !== 0) {
      r += temperatureAmt * 35;
      b -= temperatureAmt * 35;
    }

    // ---- Tint (magenta + / green -) ----
    if (tintAmt !== 0) {
      g -= tintAmt * 28;
      r += tintAmt * 12;
      b += tintAmt * 12;
    }

    r = clamp(r); g = clamp(g); b = clamp(b);

    // ================================================================
    //  Color-specific (hue-masked) adjustments
    //  Only affects pixels belonging to that hue region.
    // ================================================================
    if (anyColorAdj) {
      const hsl   = rgbToHsl(r, g, b);
      const hue   = hsl.h;      // 0..360
      const sat   = hsl.s;      // 0..1
      const light = hsl.l;      // 0..1

      // Reds — hue near 0 / 360
      if (redsAmt !== 0) {
        let wt = hueWeight(hue, 345, 360);
        if (!wt) wt = hueWeight(hue, 0, 25);
        if (wt > 0) {
          const k = redsAmt * wt;
          r += k * 70;
          g -= k * 18;
          b -= k * 18;
        }
      }

      // Yellows — 40..75
      if (yellowsAmt !== 0) {
        const wt = hueWeight(hue, 40, 75);
        if (wt > 0) {
          const k = yellowsAmt * wt;
          r += k * 50;
          g += k * 50;
          b -= k * 30;
        }
      }

      // Greens — 80..170
      if (greensAmt !== 0) {
        const wt = hueWeight(hue, 80, 170);
        if (wt > 0) {
          const k = greensAmt * wt;
          g += k * 70;
          r -= k * 18;
          b -= k * 18;
        }
      }

      // Blues — 180..260
      if (bluesAmt !== 0) {
        const wt = hueWeight(hue, 180, 260);
        if (wt > 0) {
          const k = bluesAmt * wt;
          b += k * 70;
          r -= k * 18;
          g -= k * 12;
        }
      }

      // Purples — 260..330
      if (purplesAmt !== 0) {
        const wt = hueWeight(hue, 260, 330);
        if (wt > 0) {
          const k = purplesAmt * wt;
          r += k * 45;
          b += k * 45;
          g -= k * 22;
        }
      }

      // Skin Tones — hue 10..45, moderate sat/light
      if (skinAmt !== 0) {
        if (hue >= 10 && hue <= 45 && sat >= 0.12 && sat <= 0.7 &&
            light >= 0.2 && light <= 0.9) {
          const center = 27;
          const half = 18;
          const wt = Math.max(0, 1 - Math.abs(hue - center) / half);
          if (wt > 0) {
            const k = skinAmt * wt;
            r += k * 40;
            g += k * 16;
            b -= k * 10;
          }
        }
      }
    }

    // ---- Sharpen (light local contrast boost) ----
    if (sharpenAmt !== 0) {
      const f = 1 + sharpenAmt * 0.18;
      r = (r - 128) * f + 128;
      g = (g - 128) * f + 128;
      b = (b - 128) * f + 128;
    }

    // ---- Noise (grain) ----
    if (noiseAmt !== 0) {
      const grain = (Math.random() - 0.5) * noiseAmt * 45;
      r += grain; g += grain; b += grain;
    }

    // ---- Vignette ----
    if (vignetteAmt !== 0) {
      const dx = px - cx;
      const dy = py - cy;
      const d  = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const v  = 1 - Math.max(0, d - 0.4) * vignetteAmt * 1.8;
      r *= v; g *= v; b *= v;
    }

    data[i]     = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  ctx.putImageData(imgData, 0, 0);
}

// ─── Helpers ────────────────────────────────────────────────────
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hueWeight(hue, start, end) {
  if (hue < start || hue > end) return 0;
  const center = (start + end) / 2;
  const half = (end - start) / 2;
  if (half === 0) return 1;
  return Math.max(0, 1 - Math.abs(hue - center) / half);
}