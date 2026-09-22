// ================================================================
//  js/workspace/previewDrag.js
//  Universal preview drag/scale/rotate for ALL layer types.
//
//  KEYFRAME-AWARE: drag updates keyframe at playhead automatically
//  (so live preview works even when keyframes exist).
//
//  Features:
//   - Drag (1 finger / mouse)     → move
//   - Pinch (2 finger)            → scale + rotate
//   - Mouse wheel                 → scale
//   - Shift + wheel               → rotate
//   - Rotation handle ↻           → drag to rotate
//   - Arrow keys                  → fine-tune position
// ================================================================

const CSS_ID = 'preview-drag-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    /* Draggable text / sticker overlay */
    .tx-overlay.pd-draggable,
    .sk-overlay.pd-draggable {
      pointer-events: auto !important;
      cursor: move !important;
      outline: 2px dashed rgba(0, 255, 135, 0.8);
      outline-offset: 6px;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .tx-overlay.pd-draggable:active,
    .sk-overlay.pd-draggable:active {
      cursor: grabbing !important;
      outline-style: solid;
      outline-color: #00FF87;
    }

    /* Media wrapper highlight */
    .preview-canvas-wrap.pd-media-selected::after {
      content: '';
      position: absolute;
      inset: 4px;
      border: 2px dashed rgba(0, 255, 135, 0.8);
      pointer-events: none;
      z-index: 28;
    }
    .preview-canvas-wrap.pd-media-selected {
      touch-action: none;
    }

    /* Rotation handle ↻ */
    .pd-rotate-handle {
      position: absolute;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #00FF87 0%, #60EFFF 100%);
      color: #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 800;
      cursor: grab;
      pointer-events: auto;
      z-index: 200;
      box-shadow: 0 2px 10px rgba(0,255,135,0.65);
      border: 2px solid #fff;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      transition: transform 0.1s ease;
    }
    .pd-rotate-handle:hover { transform: scale(1.1); }
    .pd-rotate-handle:active {
      cursor: grabbing;
      transform: scale(1.15);
    }

    /* Handle on overlay (text/sticker) — top-right outside */
    .tx-overlay .pd-rotate-handle,
    .sk-overlay .pd-rotate-handle {
      top: -36px;
      right: -36px;
    }

    /* Handle on wrap (media) — top-right inside */
    .preview-canvas-wrap > .pd-rotate-handle {
      top: 10px;
      right: 10px;
    }

    /* Hint badge */
    .pd-hint {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #00FF87 0%, #60EFFF 100%);
      color: #000;
      padding: 5px 12px;
      border-radius: 14px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      z-index: 35;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 3px 10px rgba(0, 255, 135, 0.5);
    }
    .pd-hint.pd-hint-hidden { display: none; }

    /* Tooltip */
    .pd-tooltip {
      position: fixed;
      background: #00FF87;
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
      transform: translate(12px, -50%);
    }

    body.pd-dragging,
    body.pd-dragging * {
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    body.pd-dragging.pd-cursor-move,
    body.pd-dragging.pd-cursor-move * { cursor: move !important; }
    body.pd-rotating,
    body.pd-rotating * { cursor: grabbing !important; }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let wrap = null;
let canvas = null;
let hintEl = null;
let currentTarget = null;
let pointers = new Map();
let gesture = null;
let tooltipEl = null;
let rotateHandle = null;

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initPreviewDrag() {
  injectStyles();

  wrap = document.querySelector('#preview-canvas-wrap');
  canvas = document.querySelector('#preview-canvas');
  if (!wrap) {
    console.warn('[previewDrag] preview wrap not found');
    return;
  }

  hintEl = document.createElement('div');
  hintEl.className = 'pd-hint pd-hint-hidden';
  hintEl.textContent = '✋ Drag · 🤏 Pinch · ↻ Handle to rotate';
  wrap.appendChild(hintEl);

  document.addEventListener('editor:clip-selected', refreshSelection);
  document.addEventListener('editor:clip-deselected', refreshSelection);
  document.addEventListener('editor:timeline-changed', refreshSelection);

  document.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  wrap.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('keydown', onKeyDown);

  refreshSelection();
}

// ═══════════════════════════════════════════════════════════════
//  🆕 KEYFRAME-AWARE PROPERTY SETTER
//  Updates base state AND keyframe at playhead (if any)
// ═══════════════════════════════════════════════════════════════
function setKeyframeAware(clip, kfProp, newValue) {
  if (!clip) return;

  // 🆕 Use keyframeStore — auto-keyframe if clip has ANY keyframes
  const ks = window.__keyframeStore;
  if (!ks || typeof ks.autoKeyframeIfActive !== 'function') return;

  const eng = window.__playbackEngine;
  const t0 = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  ks.autoKeyframeIfActive(clip, kfProp, t0, newValue);
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION
// ═══════════════════════════════════════════════════════════════
function getSelectedVisualClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label.charAt(0) !== 'V') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return { clip, trackIdx, clipIdx, el };
}

function getTargetInfo(clip) {
  if (!clip) return null;

  // Text
  if (clip.__textId && clip.textState) {
    const st = clip.textState;
    return {
      type: 'text',
      clip: clip,
      state: st,
      getX: function () { return st.positionX != null ? st.positionX : 50; },
      getY: function () { return st.positionY != null ? st.positionY : 50; },
      getScale: function () { return st.scale != null ? st.scale : 100; },
      getRotation: function () { return st.rotation || 0; },
      setX: function (v) { st.positionX = v; setKeyframeAware(clip, 'x', v); },
      setY: function (v) { st.positionY = v; setKeyframeAware(clip, 'y', v); },
      setScale: function (v) { st.scale = v; setKeyframeAware(clip, 'scale', v); },
      setRotation: function (v) { st.rotation = v; setKeyframeAware(clip, 'rotation', v); }
    };
  }

  // Sticker
  if (clip.__stickerId && clip.stickerState) {
    const st = clip.stickerState;
    return {
      type: 'sticker',
      clip: clip,
      state: st,
      getX: function () { return st.x != null ? st.x : 50; },
      getY: function () { return st.y != null ? st.y : 50; },
      getScale: function () { return st.scale != null ? st.scale : 100; },
      getRotation: function () { return st.rotation || 0; },
      setX: function (v) { st.x = v; setKeyframeAware(clip, 'x', v); },
      setY: function (v) { st.y = v; setKeyframeAware(clip, 'y', v); },
      setScale: function (v) { st.scale = v; setKeyframeAware(clip, 'scale', v); },
      setRotation: function (v) { st.rotation = v; setKeyframeAware(clip, 'rotation', v); }
    };
  }

  // Media
  if (clip.type && (clip.type.indexOf('video/') === 0 || clip.type.indexOf('image/') === 0)) {
    if (!clip.__transform) clip.__transform = {};
    const st = clip.__transform;
    return {
      type: 'media',
      clip: clip,
      state: st,
      getX: function () { return st.x != null ? st.x : 50; },
      getY: function () { return st.y != null ? st.y : 50; },
      getScale: function () { return st.scale != null ? st.scale : 100; },
      getRotation: function () { return st.rotation || 0; },
      setX: function (v) { st.x = v; setKeyframeAware(clip, 'x', v); },
      setY: function (v) { st.y = v; setKeyframeAware(clip, 'y', v); },
      setScale: function (v) { st.scale = v; setKeyframeAware(clip, 'scale', v); },
      setRotation: function (v) { st.rotation = v; setKeyframeAware(clip, 'rotation', v); }
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  REFRESH
// ═══════════════════════════════════════════════════════════════
function refreshSelection() {
  // Clear old handle
  document.querySelectorAll('.pd-rotate-handle').forEach(function (n) { n.remove(); });
  document.querySelectorAll('.tx-overlay.pd-draggable, .sk-overlay.pd-draggable')
    .forEach(function (el) { el.classList.remove('pd-draggable'); });

  const sel = getSelectedVisualClip();
  if (!sel) {
    currentTarget = null;
    hintEl.classList.add('pd-hint-hidden');
    wrap.classList.remove('pd-media-selected');
    return;
  }

  const info = getTargetInfo(sel.clip);
  currentTarget = info;

  if (!info) {
    hintEl.classList.add('pd-hint-hidden');
    wrap.classList.remove('pd-media-selected');
    return;
  }

  hintEl.classList.remove('pd-hint-hidden');

  if (info.type === 'media') {
    wrap.classList.add('pd-media-selected');
    hintEl.textContent = '✋ Drag · 🤏 Pinch · ↻ Handle to rotate';
    // Attach handle to wrap
    rotateHandle = createRotateHandle(info);
    wrap.appendChild(rotateHandle);
  } else {
    wrap.classList.remove('pd-media-selected');
    hintEl.textContent = '✋ Drag · 🤗 Pinch · ↻ Handle to rotate';
    const overlay = findOverlayForTarget(info);
    if (overlay) {
      overlay.classList.add('pd-draggable');
      rotateHandle = createRotateHandle(info);
      overlay.appendChild(rotateHandle);
    }
  }
}

function findOverlayForTarget(target) {
  if (!target) return null;
  if (target.type === 'text') {
    const id = target.clip.__textId;
    const ovs = document.querySelectorAll('.tx-overlay');
    for (let i = 0; i < ovs.length; i++) {
      if (ovs[i].dataset.textId === id) return ovs[i];
    }
  }
  if (target.type === 'sticker') {
    const id = target.clip.__stickerId;
    const ovs = document.querySelectorAll('.sk-overlay');
    for (let i = 0; i < ovs.length; i++) {
      if (ovs[i].dataset.stickerId === id) return ovs[i];
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  ROTATE HANDLE
// ═══════════════════════════════════════════════════════════════
function createRotateHandle(target) {
  const h = document.createElement('div');
  h.className = 'pd-rotate-handle';
  h.textContent = '↻';
  h.title = 'Drag to rotate';

  h.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    startRotateGesture(e, target);
  });

  // Prevent drag from picking it up
  h.addEventListener('mousedown', function (e) { e.stopPropagation(); });

  return h;
}

function getCenterOfTarget(target) {
  let el = null;
  if (target.type === 'media') {
    el = canvas || wrap;
  } else {
    el = findOverlayForTarget(target);
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function startRotateGesture(e, target) {
  const c = getCenterOfTarget(target);
  if (!c) return;

  const startAngle = Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI;

  gesture = {
    mode: 'rotate',
    pointerId: e.pointerId,
    cx: c.x,
    cy: c.y,
    startPointerAngle: startAngle,
    startRotation: target.getRotation(),
    moved: false
  };

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  try {
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  } catch (_) {}

  document.body.classList.add('pd-dragging', 'pd-rotating');

  showTooltip(e.clientX, e.clientY, Math.round(target.getRotation()) + '°');
}

// ═══════════════════════════════════════════════════════════════
//  POINTER DOWN
// ═══════════════════════════════════════════════════════════════
function isEventOnTarget(e) {
  if (!currentTarget) return false;
  if (currentTarget.type === 'media') {
    return (e.target === canvas || e.target === wrap);
  }
  const overlay = e.target.closest && e.target.closest('.tx-overlay.pd-draggable, .sk-overlay.pd-draggable');
  return !!overlay;
}

function onPointerDown(e) {
  // Skip rotation handle — handled separately
  if (e.target.closest && e.target.closest('.pd-rotate-handle')) return;

  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  if (!isEventOnTarget(e)) return;

  if (e.target.closest && e.target.closest('.cr-overlay')) return;
  if (e.target.closest && e.target.closest('.kf-marker-layer')) return;
  if (e.target.closest && e.target.closest('.transition-marker-layer')) return;

  e.preventDefault();
  e.stopPropagation();

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  try {
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  } catch (_) {}

  document.body.classList.add('pd-dragging');
  if (currentTarget.type === 'media') {
    document.body.classList.add('pd-cursor-move');
  }

  if (pointers.size === 1) {
    startDragGesture(e);
  } else if (pointers.size === 2) {
    startPinchGesture();
  }
}

function startDragGesture(e) {
  const pt = pointers.get(e.pointerId);
  if (!pt) return;
  gesture = {
    mode: 'drag',
    pointerId: e.pointerId,
    startX: pt.x,
    startY: pt.y,
    startPosX: currentTarget.getX(),
    startPosY: currentTarget.getY(),
    moved: false
  };
  showTooltip(pt.x, pt.y,
    'X ' + Math.round(currentTarget.getX()) + '% · Y ' + Math.round(currentTarget.getY()) + '%');
}

function startPinchGesture() {
  const pts = Array.from(pointers.values());
  if (pts.length < 2) return;
  const p1 = pts[0], p2 = pts[1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  gesture = {
    mode: 'pinch',
    startDist: dist,
    startAngle: angle,
    startMidX: (p1.x + p2.x) / 2,
    startMidY: (p1.y + p2.y) / 2,
    startPosX: currentTarget.getX(),
    startPosY: currentTarget.getY(),
    startScale: currentTarget.getScale(),
    startRotation: currentTarget.getRotation(),
    moved: true
  };
}

// ═══════════════════════════════════════════════════════════════
//  POINTER MOVE
// ═══════════════════════════════════════════════════════════════
function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  if (!currentTarget || !gesture) return;

  const pt = pointers.get(e.pointerId);
  pt.x = e.clientX;
  pt.y = e.clientY;

  if (e.cancelable) e.preventDefault();

  if (gesture.mode === 'drag') applyDragMove(pt.x, pt.y);
  else if (gesture.mode === 'pinch') applyPinchMove();
  else if (gesture.mode === 'rotate') applyRotateMove(pt.x, pt.y);
}

function applyDragMove(px, py) {
  const rect = wrap.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dxPct = ((px - gesture.startX) / rect.width) * 100;
  const dyPct = ((py - gesture.startY) / rect.height) * 100;

  if (Math.abs(dxPct) > 0.2 || Math.abs(dyPct) > 0.2) gesture.moved = true;

  const nx = clamp(gesture.startPosX + dxPct, -20, 120);
  const ny = clamp(gesture.startPosY + dyPct, -20, 120);

  currentTarget.setX(nx);
  currentTarget.setY(ny);

  syncLiveDOM();

  showTooltip(px, py, 'X ' + Math.round(nx) + '% · Y ' + Math.round(ny) + '%');

  // 🆕 Fire events (with keyframe awareness, live preview works)
  document.dispatchEvent(new CustomEvent('transform:changed'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
}

function applyPinchMove() {
  const pts = Array.from(pointers.values());
  if (pts.length < 2) return;
  const p1 = pts[0], p2 = pts[1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const scaleRatio = dist / gesture.startDist;
  const newScale = clamp(gesture.startScale * scaleRatio, 10, 500);
  currentTarget.setScale(newScale);

  let angleDelta = angle - gesture.startAngle;
  while (angleDelta > 180) angleDelta -= 360;
  while (angleDelta < -180) angleDelta += 360;
  const newRot = gesture.startRotation + angleDelta;
  currentTarget.setRotation(newRot);

  const rect = wrap.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    const dxPct = ((midX - gesture.startMidX) / rect.width) * 100;
    const dyPct = ((midY - gesture.startMidY) / rect.height) * 100;
    currentTarget.setX(clamp(gesture.startPosX + dxPct, -20, 120));
    currentTarget.setY(clamp(gesture.startPosY + dyPct, -20, 120));
  }

  syncLiveDOM();
  showTooltip(midX, midY, Math.round(newScale) + '% · ' + Math.round(newRot) + '°');

  document.dispatchEvent(new CustomEvent('transform:changed'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
}

function applyRotateMove(px, py) {
  const angle = Math.atan2(py - gesture.cy, px - gesture.cx) * 180 / Math.PI;
  let delta = angle - gesture.startPointerAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  const newRot = gesture.startRotation + delta;
  currentTarget.setRotation(newRot);
  gesture.moved = true;

  syncLiveDOM();
  showTooltip(px, py, Math.round(newRot) + '°');

  document.dispatchEvent(new CustomEvent('transform:changed'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
}

// ═══════════════════════════════════════════════════════════════
//  POINTER UP
// ═══════════════════════════════════════════════════════════════
function onPointerUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);

  try {
    if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
  } catch (_) {}

  if (pointers.size === 0) {
    finishGesture();
  } else if (pointers.size === 1) {
    gesture = null;
    const remaining = Array.from(pointers.entries())[0];
    if (currentTarget) {
      gesture = {
        mode: 'drag',
        pointerId: remaining[0],
        startX: remaining[1].x,
        startY: remaining[1].y,
        startPosX: currentTarget.getX(),
        startPosY: currentTarget.getY(),
        moved: true
      };
    }
  }
}

function finishGesture() {
  const wasMoved = gesture && gesture.moved;
  gesture = null;

  document.body.classList.remove('pd-dragging', 'pd-cursor-move', 'pd-rotating');
  hideTooltip();

  if (wasMoved && currentTarget) {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transform:changed'));
    document.dispatchEvent(new CustomEvent('keyframe:changed'));
  }
}

// ═══════════════════════════════════════════════════════════════
//  WHEEL
// ═══════════════════════════════════════════════════════════════
function onWheel(e) {
  if (!currentTarget) return;
  if (!isEventOnTarget(e) && e.target !== wrap && e.target !== canvas) return;

  e.preventDefault();

  if (e.shiftKey) {
    const step = e.deltaY < 0 ? 5 : -5;
    currentTarget.setRotation(currentTarget.getRotation() + step);
    showTooltip(e.clientX, e.clientY, Math.round(currentTarget.getRotation()) + '°');
  } else {
    const delta = e.deltaY < 0 ? 1.08 : (1 / 1.08);
    const newScale = clamp(currentTarget.getScale() * delta, 10, 500);
    currentTarget.setScale(newScale);
    showTooltip(e.clientX, e.clientY, Math.round(newScale) + '%');
  }

  syncLiveDOM();
  document.dispatchEvent(new CustomEvent('transform:changed'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  clearTimeout(onWheel._t);
  onWheel._t = setTimeout(hideTooltip, 900);
}

// ═══════════════════════════════════════════════════════════════
//  ARROW KEYS
// ═══════════════════════════════════════════════════════════════
function onKeyDown(e) {
  if (!currentTarget) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  const arrows = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    ArrowUp: [0, -1], ArrowDown: [0, 1]
  };
  const d = arrows[e.key];
  if (!d) return;

  e.preventDefault();
  const step = e.shiftKey ? 5 : 1;

  const nx = clamp(currentTarget.getX() + d[0] * step, -20, 120);
  const ny = clamp(currentTarget.getY() + d[1] * step, -20, 120);
  currentTarget.setX(nx);
  currentTarget.setY(ny);

  syncLiveDOM();
  document.dispatchEvent(new CustomEvent('transform:changed'));
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

// ═══════════════════════════════════════════════════════════════
//  LIVE DOM
// ═══════════════════════════════════════════════════════════════
function syncLiveDOM() {
  if (!currentTarget) return;

  if (currentTarget.type === 'text' || currentTarget.type === 'sticker') {
    const overlay = findOverlayForTarget(currentTarget);
    if (!overlay) return;

    const x = currentTarget.getX();
    const y = currentTarget.getY();
    const sc = currentTarget.getScale() / 100;
    const rot = currentTarget.getRotation();

    overlay.style.left = x + '%';
    overlay.style.top = y + '%';

    const mid = overlay.querySelector('.tx-mid');
    if (mid) {
      mid.style.transform = 'scale(' + sc + ') rotate(' + rot + 'deg)';
      mid.style.transformOrigin = '50% 50%';
    }
  }
  // Media → transform:changed triggers effectRenderer
}

// ═══════════════════════════════════════════════════════════════
//  TOOLTIP
// ═══════════════════════════════════════════════════════════════
function showTooltip(x, y, text) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'pd-tooltip';
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.textContent = text;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
  tooltipEl.style.display = '';
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}