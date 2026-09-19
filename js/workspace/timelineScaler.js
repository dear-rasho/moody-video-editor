// ================================================================
//  js/workspace/timelineScaler.js
//  Single source of truth for timeline scaling.
//
//  🆕 NEW MAPPING (logarithmic):
//     Slider UI:  10 → 100   (compact, familiar)
//     Zoom value: 0.10x → 3000x  (0.10x se 3000x)
// ================================================================

export const LABEL_WIDTH   = 80;
export const MIN_ZOOM      = 0.10;    // 10% (absolute min)
export const MAX_ZOOM      = 3000.00; // 🆕 300,000% (absolute max)
export const DEFAULT_ZOOM  = 1.00;    // 100% (1x)

// Slider UI range (compact)
export const SLIDER_MIN    = 10;
export const SLIDER_MAX    = 100;

const MIN_PPS = 0.05;
const MAX_PPS = 800;
const MIN_LABEL_GAP_PX = 56;

let zoom            = DEFAULT_ZOOM;
let durationSeconds = 0;
let viewportEl      = null;
let sliderEl        = null;
let valueEl         = null;
const listeners     = new Set();

// ═══════════════════════════════════════════════════════════════
//  MAPPING: slider value ↔ zoom value (logarithmic)
// ═══════════════════════════════════════════════════════════════
function sliderToZoom(sliderValue) {
  const v = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Number(sliderValue) || SLIDER_MIN));
  const t = (v - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
  const logMin = Math.log(MIN_ZOOM);
  const logMax = Math.log(MAX_ZOOM);
  return Math.exp(logMin + (logMax - logMin) * t);
}

function zoomToSlider(zoomValue) {
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoomValue) || DEFAULT_ZOOM));
  const t = (Math.log(z) - Math.log(MIN_ZOOM)) / (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM));
  return Math.round(SLIDER_MIN + (SLIDER_MAX - SLIDER_MIN) * t);
}

// ═══════════════════════════════════════════════════════════════
//  VIEWPORT
// ═══════════════════════════════════════════════════════════════
function getViewportContentWidth() {
  const el = viewportEl || document.querySelector('#timeline-viewport');
  if (!el) return 400;
  const w = el.clientWidth || 400;
  return Math.max(120, w - LABEL_WIDTH);
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initTimelineScaler(opts = {}) {
  viewportEl = opts.viewport   || null;
  sliderEl   = opts.slider     || null;
  valueEl    = opts.valueLabel || null;

  if (sliderEl && !sliderEl.__tlScalerBound) {
    sliderEl.addEventListener('input', () => {
      const sliderVal = parseInt(sliderEl.value, 10);
      setZoom(sliderToZoom(sliderVal));
    });
    sliderEl.__tlScalerBound = true;
  }

  if (viewportEl &&
      typeof ResizeObserver !== 'undefined' &&
      !viewportEl.__tlScalerObs) {
    const obs = new ResizeObserver(() => emitChange());
    obs.observe(viewportEl);
    viewportEl.__tlScalerObs = obs;
  }

  syncSliderUI();
  emitChange();
  return api;
}

// ═══════════════════════════════════════════════════════════════
//  DURATION
// ═══════════════════════════════════════════════════════════════
export function setDuration(seconds) {
  const sec  = Number(seconds);
  const next = (Number.isFinite(sec) && sec > 0) ? sec : 0;
  if (Math.abs(next - durationSeconds) < 1e-6) return durationSeconds;
  durationSeconds = next;
  emitChange();
  return durationSeconds;
}

export function getDuration() { return durationSeconds; }

// ═══════════════════════════════════════════════════════════════
//  ZOOM
// ═══════════════════════════════════════════════════════════════
export function setZoom(z) {
  let next = Number(z);
  if (!Number.isFinite(next)) next = DEFAULT_ZOOM;
  next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
  if (Math.abs(next - zoom) < 1e-9) return zoom;
  zoom = next;
  syncSliderUI();
  emitChange();
  return zoom;
}

export function getZoom() { return zoom; }
export function zoomIn(f  = 1.25) { return setZoom(zoom * f);  }
export function zoomOut(f = 1.25) { return setZoom(zoom / f);  }
export function resetZoom()       { return setZoom(DEFAULT_ZOOM); }

function syncSliderUI() {
  if (sliderEl) {
    const sliderVal = zoomToSlider(zoom);
    if (parseInt(sliderEl.value, 10) !== sliderVal) {
      sliderEl.value = String(sliderVal);
    }
  }
  if (valueEl) valueEl.textContent = formatZoomLabel(zoom);
}

function formatZoomLabel(z) {
  if (!Number.isFinite(z)) z = 1;
  if (z < 10) return z.toFixed(2) + 'x';
  if (z < 100) return z.toFixed(1) + 'x';
  return Math.round(z) + 'x';
}

// ═══════════════════════════════════════════════════════════════
//  SCALE / POSITION
// ═══════════════════════════════════════════════════════════════
export function getPixelsPerSecond() {
  if (durationSeconds <= 0) return 60;
  const vw      = getViewportContentWidth();
  const fitPPS  = vw / durationSeconds;
  const clamped = Math.max(MIN_PPS, Math.min(MAX_PPS, fitPPS));
  return clamped * zoom;
}

export function secondsToPx(sec) { return (Number(sec) || 0) * getPixelsPerSecond(); }
export function pxToSeconds(px)  { return (Number(px)  || 0) / getPixelsPerSecond(); }
export function getContentWidth() { return secondsToPx(durationSeconds); }
export function getTotalWidth()   { return LABEL_WIDTH + getContentWidth(); }

export function getMetrics() {
  const pxPerSecond  = getPixelsPerSecond();
  const contentWidth = durationSeconds * pxPerSecond;
  return {
    duration: durationSeconds,
    zoom,
    pxPerSecond,
    contentWidth,
    labelWidth: LABEL_WIDTH,
    totalWidth: LABEL_WIDTH + contentWidth
  };
}

export function computeClipRect(clip) {
  const start = Number.isFinite(clip && clip.startTime) ? clip.startTime : 0;
  const dur   = Number.isFinite(clip && clip.duration)  ? clip.duration  : 0;
  const pps   = getPixelsPerSecond();
  return {
    left:     Math.round(start * pps),
    width:    Math.max(20, Math.round(dur * pps)),
    start,
    end:      start + dur,
    duration: dur
  };
}

// ═══════════════════════════════════════════════════════════════
//  RULER
// ═══════════════════════════════════════════════════════════════
const STEP_CANDIDATES = [
  0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 900, 1800, 3600, 7200
];

export function getRulerStep() {
  const pps = getPixelsPerSecond();
  if (pps <= 0) return 1;
  for (const s of STEP_CANDIDATES) {
    if (s * pps >= MIN_LABEL_GAP_PX) return s;
  }
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
}

export function formatRulerTime(seconds, step) {
  const s = Math.max(0, Number(seconds) || 0);
  const smallStep = step > 0 && step < 1;
  const verySmallStep = step > 0 && step < 0.1;

  if (s < 60) {
    if (verySmallStep) return s.toFixed(2) + 's';
    if (smallStep) return s.toFixed(1) + 's';
    return Math.round(s) + 's';
  }

  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const rem = s - h * 3600 - m * 60;

  if (h > 0) {
    const mm = String(m).padStart(2, '0');
    const ss = String(Math.round(rem)).padStart(2, '0');
    return h + ':' + mm + ':' + ss;
  }

  let remStr;
  if (verySmallStep) {
    remStr = rem < 10 ? '0' + rem.toFixed(2) : rem.toFixed(2);
  } else {
    remStr = rem < 10
      ? '0' + (Math.round(rem * 10) / 10)
      : String(Math.round(rem * 10) / 10);
    if (remStr.endsWith('.0')) remStr = remStr.slice(0, -2);
  }
  return m + ':' + remStr;
}

// ═══════════════════════════════════════════════════════════════
//  LISTENERS
// ═══════════════════════════════════════════════════════════════
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  const detail = getMetrics();
  document.dispatchEvent(new CustomEvent('timeline:scale-changed', { detail }));
  for (const fn of listeners) {
    try { fn(detail); } catch (e) { console.warn(e); }
  }
}

// ═══════════════════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════════════════
const api = {
  init: initTimelineScaler,
  setDuration,
  getDuration,
  setZoom,
  getZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  getPixelsPerSecond,
  secondsToPx,
  pxToSeconds,
  getContentWidth,
  getTotalWidth,
  getMetrics,
  computeClipRect,
  getRulerStep,
  formatRulerTime,
  onChange,
  sliderToZoom,
  zoomToSlider,
  LABEL_WIDTH,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  SLIDER_MIN,
  SLIDER_MAX
};

export default api;