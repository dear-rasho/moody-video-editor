// ================================================================
//  js/features/transform.js
//  Transform panel — every property has:
//   [−] [value input] [+]   (type or tap)
//  Scroll position preserved across re-renders.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  hasAnyKeyframes, sampleAll, setKeyframe, removeKeyframe,
  ANIMATABLE_PROPS, setAllEasesAtTime, getEaseAtTime,
  getPropsWithKeyframeAt, hasKeyframeAt, easeFn
} from '../workspace/keyframeStore.js';
import { getSelectedKeyframe, clearKeyframeSelection } from '../workspace/keyframeUI.js';
import { openKeyframeGraph } from '../workspace/keyframeGraph.js';

export const featureKey = 'transform';
export const featureLabel = 'Transform';
export const featureIcon = '🔲';

// ═══════════════════════════════════════════════════════════════
//  PROPERTY GROUPS
// ═══════════════════════════════════════════════════════════════
const PROP_GROUPS = [
  { id: 'position', label: 'Position',     fields: [
      { key: 'x', short: 'X', step: 1 },
      { key: 'y', short: 'Y', step: 1 }
    ]},
  { id: 'anchor',   label: 'Anchor Point', fields: [
      { key: 'anchorX', short: 'AX', step: 1 },
      { key: 'anchorY', short: 'AY', step: 1 }
    ]},
  { id: 'scale',    label: 'Scale',        fields: [
      { key: 'scale', short: 'S', step: 1 }
    ], suffix: '%' },
  { id: 'rotation', label: 'Rotation',     fields: [
      { key: 'rotation', short: 'R', step: 1 }
    ], suffix: '°' },
  { id: 'cropL',    label: 'Crop Left',    fields: [
      { key: 'cropL', short: 'L', step: 1 }
    ], suffix: '%' },
  { id: 'cropR',    label: 'Crop Right',   fields: [
      { key: 'cropR', short: 'R', step: 1 }
    ], suffix: '%' },
  { id: 'cropT',    label: 'Crop Top',     fields: [
      { key: 'cropT', short: 'T', step: 1 }
    ], suffix: '%' },
  { id: 'cropB',    label: 'Crop Bottom',  fields: [
      { key: 'cropB', short: 'B', step: 1 }
    ], suffix: '%' }
];

const EASING_OPTIONS = [
  { key: 'linear',         label: 'Linear' },
  { key: 'sineIn',         label: 'Ease In Sine' },
  { key: 'sineOut',        label: 'Ease Out Sine' },
  { key: 'sineInOut',      label: 'Ease In Out Sine' },
  { key: 'quadIn',         label: 'Ease In Quad' },
  { key: 'quadOut',        label: 'Ease Out Quad' },
  { key: 'quadInOut',      label: 'Ease In Out Quad' },
  { key: 'cubicIn',        label: 'Ease In Cubic' },
  { key: 'cubicOut',       label: 'Ease Out Cubic' },
  { key: 'cubicInOut',     label: 'Ease In Out Cubic' },
  { key: 'quartIn',        label: 'Ease In Quart' },
  { key: 'quartOut',       label: 'Ease Out Quart' },
  { key: 'quartInOut',     label: 'Ease In Out Quart' },
  { key: 'quintIn',        label: 'Ease In Quint' },
  { key: 'quintOut',       label: 'Ease Out Quint' },
  { key: 'quintInOut',     label: 'Ease In Out Quint' },
  { key: 'expoIn',         label: 'Ease In Expo' },
  { key: 'expoOut',        label: 'Ease Out Expo' },
  { key: 'expoInOut',      label: 'Ease In Out Expo' },
  { key: 'backIn',         label: 'Ease In Back' },
  { key: 'backOut',        label: 'Ease Out Back' },
  { key: 'backInOut',      label: 'Ease In Out Back' },
  { key: 'elasticIn',      label: 'Ease In Elastic' },
  { key: 'elasticOut',     label: 'Ease Out Elastic' }
];

function makeDefaults() {
  return {
    x: 50, y: 50,
    scale: 100,
    rotation: 0,
    anchorX: 50, anchorY: 50,
    cropL: 0, cropR: 0, cropT: 0, cropB: 0
  };
}

let state = makeDefaults();
let activeClip = null;
let activeContainer = null;
let lastState = null;

// 🆕 Scroll memory
let savedShelfScrollLeft = 0;
let savedEaseShelfScrollLeft = 0;

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installTransformRenderer() {
  if (featuresRouter.__transformInstalled) return;
  featuresRouter.__transformInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'transformPanel') {
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
const CSS_ID = 'transform-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tf-panel{
      display:flex;flex-direction:column;gap:10px;
      width:100%;padding:8px 6px 200px;
      box-sizing:border-box;
    }
    .tf-panel *{box-sizing:border-box;}

    .tf-bottom-spacer{flex:0 0 auto;height:200px;width:100%;pointer-events:none;}

    /* ═══ INFO ═══ */
    .tf-info{display:flex;flex-direction:column;gap:4px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--muted);}
    .tf-info-row{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .tf-info-row b{color:var(--text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;}
    .tf-info-badge{padding:2px 8px;background:rgba(79,157,255,0.2);color:#4f9dff;border-radius:10px;font-size:10px;font-weight:700;}

    /* ═══ PROPERTY SHELF ═══ */
    .tf-props-shelf{
      display:flex;gap:10px;width:100%;min-width:0;
      overflow-x:auto;overflow-y:hidden;
      padding:2px 2px 10px;scroll-snap-type:x proximity;
      -webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
      scrollbar-width:thin;touch-action:pan-x;
    }
    .tf-props-shelf::-webkit-scrollbar{height:5px;}
    .tf-props-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}

    .tf-prop-card{
      flex:0 0 200px;width:200px;padding:10px 12px;
      background:var(--surface-2);border:1px solid var(--border);
      border-radius:10px;display:flex;flex-direction:column;gap:8px;
      scroll-snap-align:start;
    }

    .tf-card-head{display:flex;align-items:center;gap:6px;min-height:24px;}

    .tf-kf-toggle{
      flex:0 0 24px;width:24px;height:24px;
      background:transparent;border:0;cursor:pointer;
      color:#aaa;font-size:14px;line-height:1;
      display:flex;align-items:center;justify-content:center;
      padding:0;font-family:inherit;
      transition:color 0.12s ease, transform 0.12s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .tf-kf-toggle:hover{color:#fff;transform:scale(1.1);}
    .tf-kf-toggle.on{color:#4f9dff;}
    .tf-kf-toggle.partial{color:#4f9dff;opacity:0.6;}

    .tf-label{
      flex:1 1 auto;min-width:0;
      font-size:12px;font-weight:700;color:var(--text);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      letter-spacing:0.02em;
    }

    .tf-kf-status{
      flex:0 0 18px;width:18px;height:18px;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;color:#555;transition:color 0.12s ease;
      pointer-events:none;
    }
    .tf-kf-status.on{color:#4f9dff;}
    .tf-kf-status.has-selected{color:#ff3b3b;}

    /* ═══ CONTROL ROWS ═══ */
    .tf-ctrl-row{
      display:flex;
      align-items:center;
      gap:6px;
      padding:4px 0;
    }
    .tf-ctrl-label{
      flex:0 0 26px;
      font-size:11px;
      font-weight:800;
      color:#4f9dff;
      text-align:center;
      letter-spacing:0.05em;
      font-variant-numeric:tabular-nums;
    }

    /* − / + buttons */
    .tf-step-btn{
      flex:0 0 32px;
      width:32px;
      height:32px;
      padding:0;
      border-radius:8px;
      border:1px solid var(--border);
      background:var(--surface);
      color:var(--text);
      cursor:pointer;
      font-size:16px;
      font-weight:800;
      font-family:inherit;
      display:flex;
      align-items:center;
      justify-content:center;
      -webkit-tap-highlight-color:transparent;
      user-select:none;
      -webkit-user-select:none;
      transition:all 0.1s ease;
      line-height:1;
    }
    .tf-step-btn:active{
      background:linear-gradient(135deg, #4f9dff 0%, #7c3aed 100%);
      color:#fff;
      border-color:#4f9dff;
      transform:scale(0.94);
    }
    .tf-step-btn.minus{color:#ff6b6b;}
    .tf-step-btn.plus{color:#00FF87;}

    /* Value input */
    .tf-value-wrap{
      flex:1 1 auto;
      min-width:0;
      position:relative;
      display:flex;
      align-items:center;
    }
    .tf-value{
      width:100%;
      padding:6px 22px 6px 8px;
      background:rgba(79,157,255,0.08);
      border:1px solid transparent;
      border-radius:8px;
      color:#4f9dff;
      font-size:13px;
      font-weight:800;
      font-variant-numeric:tabular-nums;
      text-align:center;
      outline:none;
      font-family:inherit;
      transition:background 0.12s ease, border-color 0.12s ease;
    }
    .tf-value:hover{background:rgba(79,157,255,0.16);}
    .tf-value:focus{background:rgba(79,157,255,0.2);border-color:#4f9dff;color:#fff;}
    .tf-value::-webkit-outer-spin-button,
    .tf-value::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
    .tf-value[type=number]{ -moz-appearance:textfield; }

    .tf-value-suffix{
      position:absolute;
      right:8px;
      top:50%;
      transform:translateY(-50%);
      font-size:10px;
      color:var(--muted);
      pointer-events:none;
      font-weight:700;
      opacity:0.7;
    }
    .tf-value-wrap.has-suffix .tf-value{padding-right:20px;}

    /* ═══ KEYFRAME PANEL ═══ */
    .tf-kf-panel{
      display:flex;flex-direction:column;gap:8px;
      padding:10px 12px;
      background:rgba(255,59,59,0.08);
      border:1px solid #ff3b3b;border-radius:10px;width:100%;
    }
    .tf-kf-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .tf-kf-title{font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#ff6b6b;display:flex;align-items:center;gap:6px;}
    .tf-kf-time{color:#fff;font-weight:700;font-variant-numeric:tabular-nums;font-size:11px;}
    .tf-kf-close{background:transparent;border:0;color:#ff6b6b;font-size:18px;cursor:pointer;padding:0 6px;font-family:inherit;font-weight:700;}
    .tf-kf-props{display:flex;flex-wrap:wrap;gap:4px;}
    .tf-kf-prop{padding:2px 8px;background:rgba(255,255,255,0.08);color:#fff;border-radius:10px;font-size:10px;font-weight:600;}

    .tf-ease-row{display:flex;flex-direction:column;gap:6px;width:100%;min-width:0;}
    .tf-ease-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
    .tf-ease-shelf{
      display:flex;gap:8px;width:100%;min-width:0;
      overflow-x:auto;overflow-y:hidden;
      padding:2px 2px 12px;scroll-snap-type:x proximity;
      -webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
      scrollbar-width:thin;touch-action:pan-x;
    }
    .tf-ease-shelf::-webkit-scrollbar{height:5px;}
    .tf-ease-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}

    .tf-ease-card{
      flex:0 0 108px;width:108px;height:82px;
      padding:4px 4px 3px;
      background:var(--surface);border:1px solid var(--border);
      border-radius:9px;color:var(--text);cursor:pointer;
      display:flex;flex-direction:column;gap:3px;
      scroll-snap-align:start;font-family:inherit;
    }
    .tf-ease-card.active{
      border-color:var(--accent);
      box-shadow:inset 0 0 0 1px var(--accent);
      background:var(--surface-2);
    }
    .tf-ease-card-curve{
      width:100%;height:42px;display:block;border-radius:5px;
      background:var(--surface-2);flex-shrink:0;
    }
    .tf-ease-card.active .tf-ease-card-curve{background:var(--surface);}
    .tf-ease-card-name{
      font-size:8.5px;font-weight:600;text-align:center;
      color:var(--muted);white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;line-height:1.15;padding:0 2px;
    }
    .tf-ease-card.active .tf-ease-card-name{color:var(--text);}

    .tf-reset-all{
      padding:10px 16px;min-height:44px;
      background:var(--surface);color:var(--danger);
      border:1px solid var(--border);border-radius:10px;
      font-size:13px;font-weight:700;cursor:pointer;
      font-family:inherit;width:100%;margin-top:4px;
    }

    .tf-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 16px;background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;text-align:center;color:var(--muted);font-size:12px;line-height:1.45;}
    .tf-empty-icon{font-size:26px;opacity:.55;line-height:1;}
    .tf-empty-title{font-size:13px;font-weight:700;color:var(--text);}
    .tf-empty-text{font-size:11px;color:var(--muted);max-width:280px;}

    @media (max-width:380px){
      .tf-panel{padding-bottom:220px;}
      .tf-bottom-spacer{height:220px;}
      .tf-prop-card{flex:0 0 180px;width:180px;padding:8px 10px;}
      .tf-label{font-size:11px;}
      .tf-step-btn{flex:0 0 30px;width:30px;height:30px;font-size:15px;}
      .tf-value{font-size:12px;padding:5px 20px 5px 6px;}
      .tf-ease-card{flex:0 0 96px;width:96px;height:76px;}
      .tf-ease-card-curve{height:36px;}
      .tf-ease-card-name{font-size:8px;}
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER ENTRY
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  if (!document.querySelector('.clip.selected')) {
    autoSelectFirstVisualClip();
  }
  router.openLevel('transform', [], {
    title: 'Transform',
    level: 2,
    renderMode: 'transformPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER (with scroll preservation)
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();

  // Save scroll positions BEFORE replacing content
  if (activeContainer) {
    const oldPropsShelf = activeContainer.querySelector('.tf-props-shelf');
    if (oldPropsShelf) savedShelfScrollLeft = oldPropsShelf.scrollLeft;

    const oldEaseShelf = activeContainer.querySelector('.tf-ease-shelf');
    if (oldEaseShelf) savedEaseShelfScrollLeft = oldEaseShelf.scrollLeft;
  }

  container.replaceChildren();
  activeContainer = container;

  const panel = document.createElement('div');
  panel.className = 'tf-panel';

  const found = findSelectedVisualClip();
  if (!found) {
    panel.appendChild(buildEmptyState({
      icon: '👆',
      title: 'No visual layer selected',
      text: 'Select a video, image, text or sticker layer on the timeline first.'
    }));
    panel.appendChild(buildBottomSpacer());
    container.appendChild(panel);
    return;
  }

  activeClip = found.clip;

  const eng = window.__playbackEngine;
  const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  let base = found.clip.__transform || {};

  if (found.clip.__textId && found.clip.textState) {
    const ts = found.clip.textState;
    base = Object.assign({}, base, {
      x: ts.positionX != null ? ts.positionX : 50,
      y: ts.positionY != null ? ts.positionY : 50,
      scale: ts.scale != null ? ts.scale : 100,
      rotation: ts.rotation != null ? ts.rotation : 0
    });
  }

  if (found.clip.__stickerId && found.clip.stickerState) {
    const ss = found.clip.stickerState;
    base = Object.assign({}, base, {
      x: ss.x != null ? ss.x : 50,
      y: ss.y != null ? ss.y : 50,
      scale: ss.scale != null ? ss.scale : 100,
      rotation: ss.rotation != null ? ss.rotation : 0
    });
  }

  if (hasAnyKeyframes(found.clip)) {
    state = Object.assign(makeDefaults(), sampleAll(found.clip, t, base));
  } else {
    state = Object.assign(makeDefaults(), base);
  }

  lastState = Object.assign({}, state);

  // ─── Info bar ─────────────────────────────────────────────
  const info = document.createElement('div');
  info.className = 'tf-info';
  const r1 = document.createElement('div');
  r1.className = 'tf-info-row';
  const layerType = found.clip.__textId ? 'Text'
    : found.clip.__stickerId ? 'Sticker'
    : found.clip.type && found.clip.type.indexOf('video/') === 0 ? 'Video'
    : found.clip.type && found.clip.type.indexOf('image/') === 0 ? 'Image'
    : 'Layer';
  r1.innerHTML = 'Layer: <b>' + escapeHtml(found.clip.name || layerType) + '</b>';
  const r2 = document.createElement('div');
  r2.className = 'tf-info-row';
  r2.innerHTML = 'Track: <b>' + found.trackLabel + '</b>' +
    (hasAnyKeyframes(found.clip) ? ' <span class="tf-info-badge">KF</span>' : '');
  info.append(r1, r2);
  panel.appendChild(info);

  // ─── Property cards ───────────────────────────────────────
  const propsShelf = document.createElement('div');
  propsShelf.className = 'tf-props-shelf';
  PROP_GROUPS.forEach(group => {
    propsShelf.appendChild(buildPropCard(group, found.clip));
  });
  panel.appendChild(propsShelf);

  // ─── Easing graph panel ───────────────────────────────────
  const kfPanel = buildKeyframeGraphPanel(found.clip);
  if (kfPanel) panel.appendChild(kfPanel);

  // ─── Graph button ─────────────────────────────────────────
  if (hasAnyKeyframes(found.clip)) {
    const graphBtn = document.createElement('button');
    graphBtn.type = 'button';
    graphBtn.className = 'tf-reset-all';
    graphBtn.style.cssText = 'background: linear-gradient(135deg, #4f9dff 0%, #7c3aed 100%); color: #fff; border: 0; margin-bottom: 8px;';
    graphBtn.textContent = '📊 View Keyframe Graph';
    graphBtn.addEventListener('click', () => {
      openKeyframeGraph();
    });
    panel.appendChild(graphBtn);
  }

  // ─── Reset all ────────────────────────────────────────────
  const resetAll = document.createElement('button');
  resetAll.type = 'button';
  resetAll.className = 'tf-reset-all';
  resetAll.textContent = '↺ Reset All Transform';
  resetAll.addEventListener('click', () => {
    state = makeDefaults();
    lastState = Object.assign({}, state);
    activeClip.__transform = Object.assign({}, state);
    if (activeClip.__textId && activeClip.textState) {
      activeClip.textState.positionX = state.x;
      activeClip.textState.positionY = state.y;
      activeClip.textState.scale = state.scale;
      activeClip.textState.rotation = state.rotation;
    }
    if (activeClip.__stickerId && activeClip.stickerState) {
      activeClip.stickerState.x = state.x;
      activeClip.stickerState.y = state.y;
      activeClip.stickerState.scale = state.scale;
      activeClip.stickerState.rotation = state.rotation;
    }
    ANIMATABLE_PROPS.forEach(p => {
      if (activeClip.__keyframes && activeClip.__keyframes[p]) {
        delete activeClip.__keyframes[p];
      }
    });
    document.dispatchEvent(new CustomEvent('keyframe:changed'));
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transform:changed'));
    renderTo(container);
  });
  panel.appendChild(resetAll);

  panel.appendChild(buildBottomSpacer());
  container.appendChild(panel);

  // Restore scroll positions AFTER render
  requestAnimationFrame(function () {
    const newPropsShelf = container.querySelector('.tf-props-shelf');
    if (newPropsShelf && savedShelfScrollLeft > 0) {
      newPropsShelf.scrollLeft = savedShelfScrollLeft;
    }

    const newEaseShelf = container.querySelector('.tf-ease-shelf');
    if (newEaseShelf && savedEaseShelfScrollLeft > 0) {
      newEaseShelf.scrollLeft = savedEaseShelfScrollLeft;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  PROPERTY CARD — new layout: [−] [value] [+]
// ═══════════════════════════════════════════════════════════════
function buildPropCard(group, clip) {
  const card = document.createElement('div');
  card.className = 'tf-prop-card';

  const eng = window.__playbackEngine;
  const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  const fieldKeys = group.fields.map(f => f.key);
  const kfCount = fieldKeys.filter(f => hasKeyframeAt(clip, f, t)).length;
  const hasAny = kfCount > 0;
  const hasAll = kfCount === fieldKeys.length;

  // ─── Card head ─────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'tf-card-head';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tf-kf-toggle';
  toggle.textContent = '◆';
  if (hasAll) toggle.classList.add('on');
  else if (hasAny) toggle.classList.add('partial');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleKeyframeForGroup(clip, group, t);
  });
  head.appendChild(toggle);

  const label = document.createElement('span');
  label.className = 'tf-label';
  label.textContent = group.label;
  head.appendChild(label);

  const status = document.createElement('span');
  status.className = 'tf-kf-status';
  status.textContent = '◆';
  if (hasAny) status.classList.add('on');

  const sel = getSelectedKeyframe();
  if (sel && sel.clip === clip && Math.abs(sel.time - t) < 0.05) {
    const selProps = getPropsWithKeyframeAt(clip, t);
    const selInGroup = fieldKeys.some(f => selProps.indexOf(f) >= 0);
    if (selInGroup) status.classList.add('has-selected');
  }
  head.appendChild(status);

  card.appendChild(head);

  // ─── Control rows ──────────────────────────────────────
  group.fields.forEach(fieldDef => {
    card.appendChild(buildCtrlRow(fieldDef, group, clip));
  });

  return card;
}

// ═══════════════════════════════════════════════════════════════
//  CONTROL ROW — [−] [value] [+] with label
// ═══════════════════════════════════════════════════════════════
function buildCtrlRow(fieldDef, group, clip) {
  const row = document.createElement('div');
  row.className = 'tf-ctrl-row';

  // Label on left (X, Y, AX, AY, S, R, L, R, T, B)
  const lbl = document.createElement('span');
  lbl.className = 'tf-ctrl-label';
  lbl.textContent = fieldDef.short;
  row.appendChild(lbl);

  // − button
  const decBtn = document.createElement('button');
  decBtn.type = 'button';
  decBtn.className = 'tf-step-btn minus';
  decBtn.textContent = '−';
  decBtn.title = 'Decrease';
  row.appendChild(decBtn);

  // Value input
  const wrap = document.createElement('div');
  wrap.className = 'tf-value-wrap' + (group.suffix ? ' has-suffix' : '');

  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'tf-value';
  inp.step = String(fieldDef.step || 1);
  inp.value = formatNum(state[fieldDef.key]);
  wrap.appendChild(inp);

  if (group.suffix) {
    const suf = document.createElement('span');
    suf.className = 'tf-value-suffix';
    suf.textContent = group.suffix;
    wrap.appendChild(suf);
  }

  row.appendChild(wrap);

  // + button
  const incBtn = document.createElement('button');
  incBtn.type = 'button';
  incBtn.className = 'tf-step-btn plus';
  incBtn.textContent = '+';
  incBtn.title = 'Increase';
  row.appendChild(incBtn);

  // ═══ Change handlers ═══
  function commitValue(v) {
    if (!Number.isFinite(v)) {
      inp.value = formatNum(state[fieldDef.key]);
      return;
    }
    const min = TRANSFORM_RANGES[fieldDef.key] ? TRANSFORM_RANGES[fieldDef.key][0] : -99999;
    const max = TRANSFORM_RANGES[fieldDef.key] ? TRANSFORM_RANGES[fieldDef.key][1] : 99999;
    const clamped = Math.max(min, Math.min(max, v));
    state[fieldDef.key] = clamped;
    inp.value = formatNum(clamped);
    applyTransform();
  }

  decBtn.addEventListener('click', () => {
    const step = fieldDef.step || 1;
    commitValue((Number(state[fieldDef.key]) || 0) - step);
  });

  incBtn.addEventListener('click', () => {
    const step = fieldDef.step || 1;
    commitValue((Number(state[fieldDef.key]) || 0) + step);
  });

  inp.addEventListener('change', () => {
    const v = parseFloat(inp.value);
    commitValue(v);
  });

  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      inp.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      commitValue((Number(state[fieldDef.key]) || 0) + (fieldDef.step || 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commitValue((Number(state[fieldDef.key]) || 0) - (fieldDef.step || 1));
    }
  });

  return row;
}

const TRANSFORM_RANGES = {
  scale:    [10, 500],
  rotation: [-360, 360],
  x:        [-9999, 9999],
  y:        [-9999, 9999],
  anchorX:  [0, 100],
  anchorY:  [0, 100],
  cropL:    [0, 95],
  cropR:    [0, 95],
  cropT:    [0, 95],
  cropB:    [0, 95]
};

// ═══════════════════════════════════════════════════════════════
//  KEYFRAME TOGGLE FOR GROUP
// ═══════════════════════════════════════════════════════════════
function toggleKeyframeForGroup(clip, group, time) {
  const fieldKeys = group.fields.map(f => f.key);
  const existing = fieldKeys.filter(f => hasKeyframeAt(clip, f, time));
  if (existing.length > 0) {
    fieldKeys.forEach(f => removeKeyframe(clip, f, time));
    showToast('Keyframe removed');
  } else {
    fieldKeys.forEach(f => setKeyframe(clip, f, time, state[f]));
    showToast('Keyframe added');
  }
  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));
  if (activeContainer) renderTo(activeContainer);
}

// ═══════════════════════════════════════════════════════════════
//  EASING GRAPH PANEL
// ═══════════════════════════════════════════════════════════════
function buildKeyframeGraphPanel(clip) {
  const sel = getSelectedKeyframe();
  if (!sel || sel.clip !== clip) return null;

  const wrap = document.createElement('div');
  wrap.className = 'tf-kf-panel';

  const head = document.createElement('div');
  head.className = 'tf-kf-header';

  const title = document.createElement('div');
  title.className = 'tf-kf-title';
  title.innerHTML = '◆ Keyframe <span class="tf-kf-time">' + sel.time.toFixed(2) + 's</span>';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tf-kf-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    clearKeyframeSelection();
    renderTo(activeContainer);
  });

  head.append(title, closeBtn);
  wrap.appendChild(head);

  const props = getPropsWithKeyframeAt(clip, sel.time);
  if (props.length) {
    const propRow = document.createElement('div');
    propRow.className = 'tf-kf-props';
    props.forEach(p => {
      const chip = document.createElement('span');
      chip.className = 'tf-kf-prop';
      chip.textContent = p;
      propRow.appendChild(chip);
    });
    wrap.appendChild(propRow);
  }

  const row = document.createElement('div');
  row.className = 'tf-ease-row';

  const label = document.createElement('div');
  label.className = 'tf-ease-label';
  label.textContent = 'Easing (swipe →)';
  row.appendChild(label);

  const shelf = document.createElement('div');
  shelf.className = 'tf-ease-shelf';

  const cards = {};
  const currentEase = getEaseAtTime(clip, sel.time);

  EASING_OPTIONS.forEach(opt => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tf-ease-card';
    if (currentEase === opt.key) card.classList.add('active');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('tf-ease-card-curve');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('d', buildCurvePath(opt.key, 100, 40, 4));
    svg.appendChild(path);

    const name = document.createElement('div');
    name.className = 'tf-ease-card-name';
    name.textContent = opt.label;

    card.append(svg, name);

    card.addEventListener('click', () => {
      setAllEasesAtTime(clip, sel.time, opt.key);
      Object.values(cards).forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      document.dispatchEvent(new CustomEvent('keyframe:changed'));
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('transform:changed'));
    });

    cards[opt.key] = card;
    shelf.appendChild(card);
  });

  row.appendChild(shelf);
  wrap.appendChild(row);

  setTimeout(() => {
    if (savedEaseShelfScrollLeft === 0) {
      const active = shelf.querySelector('.tf-ease-card.active');
      if (active && shelf.scrollWidth > shelf.clientWidth) {
        const target = active.offsetLeft - shelf.clientWidth / 2 + active.offsetWidth / 2;
        shelf.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      }
    }
  }, 60);

  return wrap;
}

function buildCurvePath(ease, w, h, pad) {
  const N = 48;
  const pts = [];
  const usableH = h - pad * 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = easeFn(t, ease);
    const px = t * w;
    const py = h - pad - y * usableH;
    pts.push(px.toFixed(2) + ',' + py.toFixed(2));
  }
  return 'M ' + pts.join(' L ');
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION + APPLY
// ═══════════════════════════════════════════════════════════════
function findSelectedVisualClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const trackLabel = el.dataset.track;
  if (!trackLabel || trackLabel.charAt(0) !== 'V') return null;
  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return { clip, trackIdx, clipIdx, trackLabel, el };
}

function autoSelectFirstVisualClip() {
  const el = document.querySelector('.clip[data-track^="V"]');
  if (el) {
    try {
      el.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, button: 0
      }));
    } catch (_) {}
  }
}

function applyTransform() {
  if (!activeClip) return;

  const prev = lastState || activeClip.__transform || {};
  const changed = {};
  ANIMATABLE_PROPS.forEach(prop => {
    if (state[prop] !== prev[prop]) changed[prop] = state[prop];
  });

  lastState = Object.assign({}, state);

  const multi = window.__multiSelect;
  const clipsToUpdate = [];

  if (multi && typeof multi.forEachSelectedClip === 'function') {
    multi.forEachSelectedClip(function (c) { clipsToUpdate.push(c); });
  }

  if (clipsToUpdate.indexOf(activeClip) < 0) {
    clipsToUpdate.push(activeClip);
  }

  const changedKeys = Object.keys(changed);
  const ks = window.__keyframeStore;

  for (let i = 0; i < clipsToUpdate.length; i++) {
    const clip = clipsToUpdate[i];

    let newState;
    if (clip === activeClip) {
      newState = Object.assign({}, state);
    } else {
      const base = Object.assign({}, clip.__transform || {});
      if (clip.__textId && clip.textState) {
        if (base.x == null) base.x = clip.textState.positionX != null ? clip.textState.positionX : 50;
        if (base.y == null) base.y = clip.textState.positionY != null ? clip.textState.positionY : 50;
        if (base.scale == null) base.scale = clip.textState.scale != null ? clip.textState.scale : 100;
        if (base.rotation == null) base.rotation = clip.textState.rotation || 0;
      }
      if (clip.__stickerId && clip.stickerState) {
        if (base.x == null) base.x = clip.stickerState.x != null ? clip.stickerState.x : 50;
        if (base.y == null) base.y = clip.stickerState.y != null ? clip.stickerState.y : 50;
        if (base.scale == null) base.scale = clip.stickerState.scale != null ? clip.stickerState.scale : 100;
        if (base.rotation == null) base.rotation = clip.stickerState.rotation || 0;
      }
      newState = Object.assign({}, base);
      for (let k = 0; k < changedKeys.length; k++) {
        newState[changedKeys[k]] = changed[changedKeys[k]];
      }
    }

    clip.__transform = Object.assign({}, newState);

    if (clip.__textId && clip.textState) {
      clip.textState.positionX = newState.x;
      clip.textState.positionY = newState.y;
      clip.textState.scale = newState.scale;
      clip.textState.rotation = newState.rotation;
    }
    if (clip.__stickerId && clip.stickerState) {
      clip.stickerState.x = newState.x;
      clip.stickerState.y = newState.y;
      clip.stickerState.scale = newState.scale;
      clip.stickerState.rotation = newState.rotation;
    }

    // Auto-keyframe if clip has keyframes
    if (changedKeys.length > 0 &&
        ks && typeof ks.autoKeyframeIfActive === 'function') {

      const eng = window.__playbackEngine;
      const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
      const clipStart = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const clipDur = Number.isFinite(clip.duration) ? clip.duration : 3;
      const clipEnd = clipStart + clipDur;

      if (t >= clipStart - 0.001 && t <= clipEnd + 0.001) {
        for (let k = 0; k < changedKeys.length; k++) {
          const prop = changedKeys[k];
          ks.autoKeyframeIfActive(clip, prop, t, newState[prop]);
        }
      }
    }
  }

  document.dispatchEvent(new CustomEvent('keyframe:changed'));
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transform:changed'));
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function formatNum(v) {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 10) / 10;
  return r.toString();
}

function buildBottomSpacer() {
  const sp = document.createElement('div');
  sp.className = 'tf-bottom-spacer';
  return sp;
}

function buildEmptyState(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'tf-empty';
  const ic = document.createElement('div');
  ic.className = 'tf-empty-icon';
  ic.textContent = opts.icon;
  const t = document.createElement('div');
  t.className = 'tf-empty-title';
  t.textContent = opts.title;
  const d = document.createElement('div');
  d.className = 'tf-empty-text';
  d.textContent = opts.text;
  wrap.append(ic, t, d);
  return wrap;
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
    'padding:8px 16px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

document.addEventListener('keyframe:selected', () => {
  if (activeContainer && document.body.contains(activeContainer)) {
    renderTo(activeContainer);
  }
});