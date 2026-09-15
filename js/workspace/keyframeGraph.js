// ================================================================
//  js/workspace/keyframeGraph.js
//  Keyframe graph — canvas-based curve editor.
//  🆕 Points are DRAGGABLE (X = time, Y = value)
// ================================================================

import { getPropKeys, getKeyframes, easeFn } from './keyframeStore.js';

const OVERLAY_ID = 'kfg-overlay';
const CSS_ID = 'kfg-styles';

const PROP_COLORS = {
  x: '#4f9dff', y: '#22c55e', scale: '#f59e0b', rotation: '#ef4444',
  opacity: '#a855f7', anchorX: '#06b6d4', anchorY: '#14b8a6',
  cropL: '#f472b6', cropR: '#fb923c', cropT: '#facc15', cropB: '#84cc16'
};

const HIT_RADIUS = 16;   // px — dot grab radius
const SNAP_TIME = 0.05;  // seconds — snap granularity

let overlayEl = null;
let canvasEl = null;
let legendEl = null;
let rafId = null;

// Plot dimensions (set during render, used during drag)
let plot = { W: 0, H: 0, padL: 46, padR: 16, padT: 16, padB: 34, duration: 0, minVal: 0, maxVal: 1 };

// Active drag state
let activeDrag = null;
let hoverPt = null;

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    #kfg-overlay {
      position: fixed;
      inset: 0;
      z-index: 99998;
      background: rgba(8, 8, 8, 0.97);
      display: flex;
      flex-direction: column;
      font-family: inherit;
      animation: kfg-fadein 0.18s ease;
    }
    @keyframes kfg-fadein { from { opacity: 0; } to { opacity: 1; } }

    .kfg-header {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: calc(10px + env(safe-area-inset-top, 0px)) 14px 10px;
      background: #0d0d0d;
      border-bottom: 1px solid #262626;
    }
    .kfg-title {
      flex: 1;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .kfg-close {
      width: 40px; height: 40px;
      border: 1px solid #303030;
      border-radius: 10px;
      background: #181818;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      font-family: inherit;
    }
    .kfg-close:active { background: #222; }

    .kfg-info {
      flex: 0 0 auto;
      padding: 8px 14px;
      background: #0d0d0d;
      border-bottom: 1px solid #1a1a1a;
      font-size: 11px;
      color: #8a8a8a;
      letter-spacing: 0.03em;
    }
    .kfg-info b { color: #fff; }

    .kfg-canvas-wrap {
      flex: 1 1 auto;
      position: relative;
      overflow: hidden;
      background: #101010;
    }
    #kfg-canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: crosshair;
      user-select: none;
      -webkit-user-select: none;
    }
    #kfg-canvas.kfg-grabbing { cursor: grabbing; }

    .kfg-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #6a6a6a;
      font-size: 13px;
      padding: 20px;
      text-align: center;
      pointer-events: none;
    }
    .kfg-empty-icon { font-size: 42px; opacity: 0.4; }

    .kfg-legend {
      flex: 0 0 auto;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 14px calc(10px + env(safe-area-inset-bottom, 0px));
      background: #0d0d0d;
      border-top: 1px solid #262626;
      scrollbar-width: thin;
    }
    .kfg-legend::-webkit-scrollbar { height: 4px; }
    .kfg-legend::-webkit-scrollbar-thumb { background: #303030; border-radius: 3px; }

    .kfg-chip {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #181818;
      border: 1px solid #303030;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 700;
      color: #eaeaea;
      cursor: pointer;
      white-space: nowrap;
      font-family: inherit;
      transition: all 0.12s ease;
    }
    .kfg-chip.active { background: #222; border-color: currentColor; }
    .kfg-chip.disabled { opacity: 0.3; text-decoration: line-through; }
    .kfg-chip-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      background: currentColor;
    }

    /* 🆕 Drag tooltip */
    .kfg-drag-tip {
      position: fixed;
      background: #22c55e;
      color: #000;
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      z-index: 100002;
      pointer-events: none;
      font-family: inherit;
      letter-spacing: 0.02em;
      transform: translate(12px, -50%);
    }

    body.kfg-is-dragging,
    body.kfg-is-dragging * {
      cursor: grabbing !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  OPEN / CLOSE
// ═══════════════════════════════════════════════════════════════
export function openKeyframeGraph() {
  if (overlayEl) return;

  injectStyles();

  const clip = getSelectedClipData();
  if (!clip) {
    showToast('Select a clip first');
    return;
  }

  overlayEl = document.createElement('div');
  overlayEl.id = OVERLAY_ID;
  overlayEl.innerHTML = `
    <div class="kfg-header">
      <div class="kfg-title">📊 Keyframe Graph</div>
      <button class="kfg-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="kfg-info" id="kfg-info"></div>
    <div class="kfg-canvas-wrap">
      <canvas id="kfg-canvas"></canvas>
      <div class="kfg-empty" id="kfg-empty" style="display:none;">
        <div class="kfg-empty-icon">◆</div>
        <div>Is clip pe koi keyframe nahi hai.</div>
        <div style="font-size:11px;opacity:.6;">Prompt ya Transform panel se keyframe add karein.</div>
      </div>
    </div>
    <div class="kfg-legend" id="kfg-legend"></div>
  `;

  document.body.appendChild(overlayEl);
  canvasEl = overlayEl.querySelector('#kfg-canvas');
  legendEl = overlayEl.querySelector('#kfg-legend');

  overlayEl.querySelector('.kfg-close').addEventListener('click', closeKeyframeGraph);

  // 🆕 Pointer events
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointercancel', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);

  window.addEventListener('resize', scheduleRedraw);

  render();
}

export function closeKeyframeGraph() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  window.removeEventListener('resize', scheduleRedraw);
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    canvasEl = null;
    legendEl = null;
  }
  activeDrag = null;
  hoverPt = null;
}

let rafPending = false;
function scheduleRedraw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    render();
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
function render() {
  if (!overlayEl || !canvasEl) return;

  const clip = getSelectedClipData();
  const infoEl = overlayEl.querySelector('#kfg-info');
  const emptyEl = overlayEl.querySelector('#kfg-empty');

  if (!clip) {
    if (infoEl) infoEl.textContent = 'No clip selected';
    if (emptyEl) emptyEl.style.display = 'flex';
    clearCanvas();
    return;
  }

  const props = getPropKeys(clip);
  if (!props.length) {
    if (infoEl) infoEl.innerHTML = 'Clip: <b>' + escapeHtml(clip.name || 'Untitled') + '</b>';
    if (emptyEl) emptyEl.style.display = 'flex';
    clearCanvas();
    renderLegend([]);
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const clipDur = Number.isFinite(clip.duration) ? clip.duration : 3;

  const series = [];
  let minVal = Infinity, maxVal = -Infinity;

  props.forEach(prop => {
    const kfs = getKeyframes(clip, prop);
    if (!kfs.length) return;
    const data = kfs.map(k => ({
      time: k.time - clipStart,
      value: k.value,
      origKf: k
    })).sort((a, b) => a.time - b.time);

    data.forEach(d => {
      if (d.value < minVal) minVal = d.value;
      if (d.value > maxVal) maxVal = d.value;
    });

    series.push({ prop, data, ease: kfs[0].ease || 'quadInOut', color: PROP_COLORS[prop] || '#4f9dff' });
  });

  if (infoEl) {
    infoEl.innerHTML = 'Clip: <b>' + escapeHtml(clip.name || 'Untitled') +
      '</b> · Duration: <b>' + clipDur.toFixed(2) + 's</b> · ' +
      series.length + ' propert' + (series.length === 1 ? 'y' : 'ies') +
      ' · <span style="color:#22c55e;">drag dots to edit</span>';
  }

  if (minVal === maxVal) { minVal -= 10; maxVal += 10; }
  else {
    const pad = (maxVal - minVal) * 0.1;
    minVal -= pad; maxVal += pad;
  }

  // Setup canvas
  const rect = canvasEl.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(200, Math.floor(rect.width));
  const H = Math.max(200, Math.floor(rect.height));
  canvasEl.width = W * dpr;
  canvasEl.height = H * dpr;
  canvasEl.style.width = W + 'px';
  canvasEl.style.height = H + 'px';

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padL = 46, padR = 16, padT = 16, padB = 34;
  plot = {
    W, H, padL, padR, padT, padB,
    plotW: W - padL - padR,
    plotH: H - padT - padB,
    duration: clipDur,
    minVal, maxVal
  };

  drawGraph(ctx, series);
  renderLegend(series);
}

function clearCanvas() {
  if (!canvasEl) return;
  const rect = canvasEl.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width = rect.width * dpr;
  canvasEl.height = rect.height * dpr;
  canvasEl.style.width = rect.width + 'px';
  canvasEl.style.height = rect.height + 'px';
  const ctx = canvasEl.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }
}

function xToPx(t) { return plot.padL + (t / plot.duration) * plot.plotW; }
function vToPx(v) { return plot.padT + plot.plotH * (1 - (v - plot.minVal) / (plot.maxVal - plot.minVal)); }
function pxToX(px) { return ((px - plot.padL) / plot.plotW) * plot.duration; }
function pxToV(py) { return plot.minVal + (1 - (py - plot.padT) / plot.plotH) * (plot.maxVal - plot.minVal); }

function drawGraph(ctx, series) {
  const { W, H, padL, padT, plotW, plotH, duration, minVal, maxVal } = plot;

  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(padL, padT, plotW, plotH);

  // Horizontal grid
  const ySteps = 4;
  ctx.strokeStyle = '#1e1e1e';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#5a5a5a';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= ySteps; i++) {
    const t = i / ySteps;
    const y = padT + plotH * (1 - t);
    const v = minVal + (maxVal - minVal) * t;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(formatVal(v), padL - 6, y);
  }

  // Vertical grid
  const xSteps = Math.min(8, Math.max(2, Math.floor(plotW / 70)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= xSteps; i++) {
    const t = i / xSteps;
    const x = padL + plotW * t;
    const time = duration * t;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(time.toFixed(1) + 's', x, padT + plotH + 8);
  }

  // Border
  ctx.strokeStyle = '#262626';
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Curves
  series.forEach(({ data, ease, color }) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    const samples = 120;
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * duration;
      const v = sampleSeries(data, t, ease);
      const x = xToPx(t);
      const y = vToPx(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dots
    data.forEach((kf, kfIdx) => {
      if (kf.time < 0 || kf.time > duration) return;
      const x = xToPx(kf.time);
      const y = vToPx(kf.value);

      const isHover = hoverPt && hoverPt.prop === series.prop && hoverPt.kfIdx === kfIdx;
      const isDrag = activeDrag && activeDrag.prop === series.prop && activeDrag.kfIdx === kfIdx;

      // Outer glow when hovered/dragged
      if (isHover || isDrag) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = isDrag ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.15)';
        ctx.fill();
      }

      // Fill
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? '#22c55e' : color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isDrag ? 2.5 : 1.5;
      ctx.stroke();
    });
  });
}

function sampleSeries(data, t, ease) {
  if (!data.length) return 0;
  if (data.length === 1) return data[0].value;
  if (t <= data[0].time) return data[0].value;
  const last = data[data.length - 1];
  if (t >= last.time) return last.value;

  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (b.time - a.time) > 0 ? (t - a.time) / (b.time - a.time) : 0;
      const eased = easeFn(raw, a.origKf && a.origKf.ease ? a.origKf.ease : ease);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return last.value;
}

function formatVal(v) {
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toString();
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function renderLegend(series) {
  if (!legendEl) return;
  legendEl.replaceChildren();
  if (!series.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#5a5a5a;font-size:11px;padding:4px 0;';
    empty.textContent = 'No keyframes';
    legendEl.appendChild(empty);
    return;
  }
  series.forEach(({ prop, color }) => {
    const chip = document.createElement('div');
    chip.className = 'kfg-chip active';
    chip.style.color = color;
    const dot = document.createElement('span');
    dot.className = 'kfg-chip-dot';
    const name = document.createElement('span');
    name.textContent = prop;
    chip.append(dot, name);
    legendEl.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════════════════════
//  🆕 POINTER EVENTS
// ═══════════════════════════════════════════════════════════════
function clientToCanvas(e) {
  const rect = canvasEl.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findNearestPoint(cx, cy) {
  const clip = getSelectedClipData();
  if (!clip) return null;

  const props = getPropKeys(clip);
  let best = null;
  let bestDist = HIT_RADIUS * HIT_RADIUS;

  props.forEach(prop => {
    const kfs = getKeyframes(clip, prop);
    kfs.forEach((kf, kfIdx) => {
      const gx = xToPx(kf.time - (clip.startTime || 0));
      const gy = vToPx(kf.value);
      const dx = gx - cx, dy = gy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = { prop, kfIdx, kf, series: null };
      }
    });
  });

  return best;
}

function onPointerDown(e) {
  if (!canvasEl) return;
  const pt = clientToCanvas(e);
  const hit = findNearestPoint(pt.x, pt.y);
  if (!hit) return;

  e.preventDefault();
  canvasEl.setPointerCapture && canvasEl.setPointerCapture(e.pointerId);
  canvasEl.classList.add('kfg-grabbing');
  document.body.classList.add('kfg-is-dragging');

  const clip = getSelectedClipData();
  if (!clip) return;

  activeDrag = {
    prop: hit.prop,
    kfIdx: hit.kfIdx,
    origTime: hit.kf.time,
    origValue: hit.kf.value,
    clip,
    pointerId: e.pointerId,
    dragTip: createDragTip(hit.kf.time - (clip.startTime || 0), hit.kf.value)
  };

  // Re-render to show hover state
  render();
  updateDragTip(e.clientX, e.clientY);
}

function onPointerMove(e) {
  if (!canvasEl) return;
  const pt = clientToCanvas(e);

  if (activeDrag) {
    e.preventDefault();
    const clip = activeDrag.clip;
    const clipStart = clip.startTime || 0;
    const clipDur = Number.isFinite(clip.duration) ? clip.duration : 3;

    // Compute new time & value
    let newTime = pxToX(pt.x);
    let newValue = pxToV(pt.y);

    // Clamp time within clip [0, clipDur]
    newTime = Math.max(0, Math.min(clipDur, newTime));
    // Snap to grid
    newTime = Math.round(newTime / SNAP_TIME) * SNAP_TIME;

    // Get current keyframes array for this prop
    const kfs = getKeyframes(clip, activeDrag.prop);
    if (!kfs || !kfs.length) return;

    // Find the keyframe in the array (match by original time — but time may have changed)
    // Use kfIdx as index into the sorted array; but after sorting, index may shift.
    // Safer: search by origValue + closest to origTime.
    let targetIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const dt = Math.abs(kf.time - activeDrag.origTime);
      const score = dt * 100 + Math.abs(kf.value - activeDrag.origValue);
      if (score < bestScore) { bestScore = score; targetIdx = i; }
    }
    if (targetIdx < 0) return;

    // Prevent overlap with OTHER keyframes — nudge to nearest free time
    let finalTime = newTime + clipStart;
    for (let i = 0; i < kfs.length; i++) {
      if (i === targetIdx) continue;
      if (Math.abs(kfs[i].time - finalTime) < SNAP_TIME * 0.5) {
        // Bump slightly forward or back
        const dir = kfs[i].time > finalTime ? -1 : 1;
        finalTime = kfs[i].time + dir * SNAP_TIME;
      }
    }
    // Re-clamp
    finalTime = Math.max(clipStart, Math.min(clipStart + clipDur, finalTime));

    kfs[targetIdx].time = finalTime;
    kfs[targetIdx].value = newValue;

    // Sort by time
    kfs.sort((a, b) => a.time - b.time);

    // Update drag origin to current, so continued drag works
    activeDrag.origTime = finalTime;
    activeDrag.origValue = newValue;

    // Live events for preview update
    document.dispatchEvent(new CustomEvent('transform:changed'));
    document.dispatchEvent(new CustomEvent('keyframe:changed'));

    updateDragTip(e.clientX, e.clientY, finalTime - clipStart, newValue);

    render();
    return;
  }

  // No active drag — hover detection
  const hit = findNearestPoint(pt.x, pt.y);
  if (hit) {
    if (!hoverPt || hoverPt.prop !== hit.prop || hoverPt.kfIdx !== hit.kfIdx) {
      hoverPt = { prop: hit.prop, kfIdx: hit.kfIdx };
      render();
    }
    canvasEl.style.cursor = 'grab';
  } else {
    if (hoverPt) {
      hoverPt = null;
      render();
    }
    canvasEl.style.cursor = 'crosshair';
  }
}

function onPointerUp(e) {
  if (!activeDrag) return;
  try { canvasEl.releasePointerCapture && canvasEl.releasePointerCapture(activeDrag.pointerId); } catch (_) {}
  canvasEl.classList.remove('kfg-grabbing');
  document.body.classList.remove('kfg-is-dragging');

  if (activeDrag.dragTip) activeDrag.dragTip.remove();

  const dragProp = activeDrag.prop;
  const finalKf = activeDrag.origValue;
  const finalTime = activeDrag.origTime;

  activeDrag = null;

  // Commit events
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));

  showToast('◆ ' + dragProp + ' → ' + finalTime.toFixed(2) + 's, ' + formatVal(finalKf));

  // Full re-render (rescales Y axis)
  render();
}

function onPointerLeave() {
  if (activeDrag) return;
  if (hoverPt) {
    hoverPt = null;
    render();
  }
}

function createDragTip(timeVal, value) {
  const tip = document.createElement('div');
  tip.className = 'kfg-drag-tip';
  tip.textContent = timeVal.toFixed(2) + 's · ' + formatVal(value);
  document.body.appendChild(tip);
  return tip;
}

function updateDragTip(clientX, clientY, timeVal, value) {
  if (!activeDrag || !activeDrag.dragTip) return;
  if (Number.isFinite(timeVal) && Number.isFinite(value)) {
    activeDrag.dragTip.textContent = timeVal.toFixed(2) + 's · ' + formatVal(value);
  }
  activeDrag.dragTip.style.left = clientX + 'px';
  activeDrag.dragTip.style.top = clientY + 'px';
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function getSelectedClipData() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label[0] !== 'V') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;

  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;
  return track[clipIdx] || null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:8px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:99999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}