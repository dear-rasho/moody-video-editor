// ================================================================
//  js/features/effect.js
//  Effects shelf — creates effect layers as presets.
//  Applies DOWNWARD only (hierarchy).
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  createEffectLayerAtRange,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'effect';
export const featureLabel = 'Effects';
export const featureIcon = '✨';

const PRESETS = [
  // Motion effects
  { key: 'shake',      label: 'Shake',       icon: '📳', kind: 'motion',
    motion: { type: 'shake', intensity: 90, speed: 1.2 } },
  { key: 'bounce',     label: 'Bounce',      icon: '🏀', kind: 'motion',
    motion: { type: 'bounce', intensity: 100, speed: 1.4 } },
  { key: 'pulse',      label: 'Pulse',       icon: '💓', kind: 'motion',
    motion: { type: 'pulse', intensity: 100, speed: 1.2 } },
  { key: 'zoomPulse',  label: 'Zoom Pulse',  icon: '🔍', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 100, speed: 1.0 } },
  { key: 'glitch',     label: 'Glitch',      icon: '⚡', kind: 'motion',
    motion: { type: 'glitch', intensity: 100, speed: 2.0 },
    filters: { saturation: 115, contrast: 108 } },
  { key: 'wobble',     label: 'Wobble',      icon: '🔄', kind: 'motion',
    motion: { type: 'rotate', intensity: 80, speed: 1.0 } },

  // Color grades
  { key: 'warm',       label: 'Warm Glow',   icon: '🌅',
    filters: { brightness: 108, contrast: 105, saturation: 115, temperature: 25 } },
  { key: 'cool',       label: 'Cool Blue',   icon: '❄️',
    filters: { brightness: 100, contrast: 108, saturation: 95, temperature: -30 } },
  { key: 'vintage',    label: 'Vintage',     icon: '📼',
    filters: { brightness: 98, contrast: 92, saturation: 80, sepia: 25 } },
  { key: 'cinematic',  label: 'Cinematic',   icon: '🎬',
    filters: { brightness: 98, contrast: 118, saturation: 90 } },
  { key: 'bw',         label: 'Black & White', icon: '⚫',
    filters: { grayscale: 100, contrast: 110 } },
  { key: 'dreamy',     label: 'Dreamy',      icon: '✨',
    filters: { brightness: 105, contrast: 92, saturation: 105, blur: 0.6 } },
  { key: 'vivid',      label: 'Vivid',       icon: '🎨',
    filters: { brightness: 102, contrast: 112, saturation: 145 } },
  { key: 'faded',      label: 'Faded',       icon: '🌫️',
    filters: { brightness: 108, contrast: 82, saturation: 75 } },
  { key: 'dramatic',   label: 'Dramatic',    icon: '🎭',
    filters: { contrast: 130, saturation: 110 } },
  { key: 'negative',   label: 'Negative',    icon: '🔄',
    filters: { invert: 100 } },
  { key: 'softGlow',   label: 'Soft Glow',   icon: '💫',
    filters: { brightness: 112, contrast: 95, saturation: 108, blur: 0.4 } },
  { key: 'noir',       label: 'Noir',        icon: '🖤',
    filters: { grayscale: 100, contrast: 135, brightness: 92 } }
];

let editingLayer = null;

(function installEffectRenderer() {
  if (featuresRouter.__effectInstalled) return;
  featuresRouter.__effectInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'effectPanel') {
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

const CSS_ID = 'effect-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .ef-panel { display:flex;flex-direction:column;gap:10px;padding:10px 8px 14px;width:100%;box-sizing:border-box; }
    .ef-panel * { box-sizing:border-box; }
    .ef-warn { padding:10px 12px;background:rgba(255,107,107,0.12);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);font-weight:700; }
    .ef-badge { padding:8px 12px;background:rgba(255,209,102,0.15);border:1px solid #ffd166;border-radius:8px;font-size:11px;color:#ffd166;font-weight:700; }
    .ef-section-label { font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);padding:0 4px;opacity:0.7; }
    .ef-shelf-hint { font-size:9px;color:var(--muted);letter-spacing:0.04em;text-transform:uppercase;opacity:0.6;padding:0 2px; }
    .ef-shelf { display:flex;gap:8px;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin;touch-action:pan-x; }
    .ef-shelf::-webkit-scrollbar { height:5px; }
    .ef-shelf::-webkit-scrollbar-thumb { background:var(--border);border-radius:3px; }
    .ef-card { flex:0 0 92px;width:92px;min-height:92px;padding:8px 6px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;scroll-snap-align:start;transition:all 0.12s ease;-webkit-tap-highlight-color:transparent; }
    .ef-card:active { background:var(--surface-3); }
    .ef-card.active { border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent); }
    .ef-card.motion { border-left:3px solid #a78bfa; }
    .ef-icon { width:38px;height:38px;border-radius:50%;border:1px solid var(--border);display:grid;place-items:center;font-size:18px;background:var(--surface); }
    .ef-card.active .ef-icon { background:var(--accent);color:#000;border-color:var(--accent); }
    .ef-label { font-size:10.5px;font-weight:600;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%; }
    .ef-actions { display:flex;gap:8px;margin-top:6px; }
    .ef-btn { flex:1;padding:10px 12px;min-height:44px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit; }
    .ef-btn.danger { color:var(--danger); }
  `;
  document.head.appendChild(s);
}
export function open({ router }) {
  // 🆕 No editingLayer — always create new on preset click
  editingLayer = null;

  router.openLevel('effect', [], {
    title: 'Effects',
    level: 2,
    renderMode: 'effectPanel'
  });
}
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'ef-panel';

  if (!hasSelectedLayer()) {
    const warn = document.createElement('div');
    warn.className = 'ef-warn';
    warn.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(warn);
  } else if (editingLayer) {
    const badge = document.createElement('div');
    badge.className = 'ef-badge';
    badge.textContent = '✏️ Editing: ' + (editingLayer.clip.name || 'Effect');
    panel.appendChild(badge);
  }
  // 🆕 Highlight currently selected effect's preset (if any)
  const currentSel = getSelectedEffectLayer('effect');
  const activeKey = currentSel && currentSel.clip && currentSel.clip.effectState
    ? currentSel.clip.effectState.presetKey
    : null;

  panel.appendChild(buildSectionLabel('Motion (Animated)'));
  panel.appendChild(buildShelf(
    PRESETS.filter(p => p.kind === 'motion'),
    activeKey,
    true
  ));

  panel.appendChild(buildSectionLabel('Color Grade'));
  panel.appendChild(buildShelf(
    PRESETS.filter(p => p.kind !== 'motion'),
    activeKey,
    false
  ));

  // 🆕 Show remove button when an effect layer is selected
  const selectedFx = getSelectedEffectLayer('effect');
  if (selectedFx && selectedFx.clip) {
    const actions = document.createElement('div');
    actions.className = 'ef-actions';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ef-btn danger';
    removeBtn.textContent = '🗑 Remove "' +
      (selectedFx.clip.name || 'Effect').slice(0, 20) + '"';
    removeBtn.addEventListener('click', removeCurrentLayer);

    actions.appendChild(removeBtn);
    panel.appendChild(actions);
  }
  container.appendChild(panel);
}

function buildSectionLabel(text) {
  const el = document.createElement('div');
  el.className = 'ef-section-label';
  el.textContent = text;
  return el;
}

function buildShelf(list, activeKey, isMotion) {
  const hint = document.createElement('div');
  hint.className = 'ef-shelf-hint';
  hint.textContent = '← Swipe →';

  const shelf = document.createElement('div');
  shelf.className = 'ef-shelf';

  list.forEach(preset => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ef-card';
    if (isMotion) card.classList.add('motion');
    if (activeKey === preset.key) card.classList.add('active');

    const ico = document.createElement('span');
    ico.className = 'ef-icon';
    ico.textContent = preset.icon;

    const lbl = document.createElement('span');
    lbl.className = 'ef-label';
    lbl.textContent = preset.label;

    card.append(ico, lbl);
    card.addEventListener('click', () => applyPreset(preset));
    shelf.appendChild(card);
  });

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '4px';
  wrap.style.minWidth = '0';
  wrap.append(hint, shelf);
  return wrap;
}

function applyPreset(preset) {
  if (!hasSelectedLayer()) {
    showToast('Select a timeline layer first', false);
    return;
  }

  // 🆕 Compute range: playhead → clip end
  const range = computeEffectRange();
  if (!range) {
    showToast('Move playhead onto a clip first', false);
    return;
  }

  const baseFilters = {
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
  };
  const filters = Object.assign(baseFilters, preset.filters || {});

  const payload = {
    presetKey: preset.key,
    filters: filters,
    motion: preset.motion || null
  };

  // 🆕 ALWAYS create a NEW effect layer (never update existing)
  const state = Object.assign({ kind: 'effect' }, payload);
  const id = createEffectLayerAtRange(
    'effect',
    state,
    preset.label,
    range.start,
    range.duration
  );

  if (id) {
    showToast('Added ' + preset.label + ' · ' + range.duration.toFixed(2) + 's');
  } else {
    showToast('Failed to add effect', false);
    return;
  }

  document.dispatchEvent(new CustomEvent('effects:refresh'));

  // Re-render after auto-select (double rAF)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  }));
}

// ═══════════════════════════════════════════════════════════════
//  🆕 Compute effect range: playhead → clip end
//  Prefers top display clip at playhead.
//  Falls back to selected visual clip.
// ═══════════════════════════════════════════════════════════════
function computeEffectRange() {
  const appState = window.__appState;
  if (!appState) return null;

  const eng = window.__playbackEngine;
  const playhead = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();

  // 1. Try to find display clip at playhead
  let clipAtPlayhead = null;
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.type) continue;
      const isV = clip.type.indexOf('video/') === 0;
      const isI = clip.type.indexOf('image/') === 0;
      if (!isV && !isI) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (playhead >= s && playhead < s + d) {
        clipAtPlayhead = clip;
        break;
      }
    }
    if (clipAtPlayhead) break;
  }

  // 2. Fallback: selected clip if it's a display clip
  let target = clipAtPlayhead;
  if (!target) {
    const el = document.querySelector('.clip.selected');
    if (el) {
      const label = el.dataset.track;
      const clipIdx = Number(el.dataset.clip);
      if (label && label.charAt(0) === 'V' && Number.isFinite(clipIdx)) {
        const ti = Number(label.slice(1)) - 1;
        const tr = tracks[ti];
        if (Array.isArray(tr)) {
          const c = tr[clipIdx];
          if (c && c.type &&
              (c.type.indexOf('video/') === 0 || c.type.indexOf('image/') === 0)) {
            target = c;
          }
        }
      }
    }
  }

  if (!target) return null;

  const clipStart = Number.isFinite(target.startTime) ? target.startTime : 0;
  const clipDur = Number.isFinite(target.duration) ? target.duration : 3;
  const clipEnd = clipStart + clipDur;

  // Start = later of (clipStart, playhead), clamped inside clip
  let start = Math.max(clipStart, Math.min(playhead, clipEnd - 0.15));
  let end = clipEnd;

  if (end - start < 0.15) {
    start = clipStart;
    end = clipEnd;
  }

  return { start, end, duration: Math.max(0.15, end - start) };
}

function removeCurrentLayer() {
  // 🆕 Look for currently selected effect layer
  const sel = getSelectedEffectLayer('effect');
  if (!sel || !sel.clip) {
    showToast('No effect layer selected', false);
    return;
  }

  const clip = sel.clip;
  const appState = window.__appState;

  const allTracks = (appState && appState.timeline.visual) || [];
  let removed = false;
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__effectId === clip.__effectId);
    if (idx >= 0) {
      track.splice(idx, 1);
      removed = true;
      break;
    }
  }

  if (!removed) {
    showToast('Effect layer not found', false);
    return;
  }

  editingLayer = null;
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  showToast('Effect layer removed');

  const c = document.querySelector('#feature-shelf');
  if (c) renderTo(c);
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','opacity:0',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit','max-width:80vw','white-space:nowrap',
    'overflow:hidden','text-overflow:ellipsis'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, 1500);
}