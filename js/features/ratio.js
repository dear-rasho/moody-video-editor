// ================================================================
//  js/features/ratio.js
//  Self-contained Aspect Ratio feature.
//
//  - Panel with 7 presets: Original / 9:16 / 1:1 / 16:9 / 4:5 / 3:4 / 21:9
//  - Applies a "frame overlay" on the preview wrap that shows the
//    chosen ratio and masks (clips) anything outside it.
//  - Persists in localStorage so export can read it.
//  - User can change ratio anytime by reopening the panel.
//
//  All code + CSS lives in this file. No other file is touched.
// ================================================================

import { featuresRouter } from './featuresRouter.js';

export const featureKey = 'ratio';

// ─── Ratio presets ─────────────────────────────────────────────
const RATIOS = [
  { key: 'original', label: 'Original',  sub: 'Source aspect',  w: 0,  h: 0  },
  { key: '9:16',     label: '9:16',      sub: 'TikTok / Shorts',w: 9,  h: 16 },
  { key: '1:1',      label: '1:1',       sub: 'Instagram',      w: 1,  h: 1  },
  { key: '16:9',     label: '16:9',      sub: 'YouTube',        w: 16, h: 9  },
  { key: '4:5',      label: '4:5',       sub: 'IG Portrait',    w: 4,  h: 5  },
  { key: '3:4',      label: '3:4',       sub: 'Portrait',       w: 3,  h: 4  },
  { key: '21:9',     label: '21:9',      sub: 'Cinematic',      w: 21, h: 9  }
];

// ─── State ─────────────────────────────────────────────────────
const STORAGE_KEY = 'offline-editor-ratio';

const state = {
  ratioKey: 'original',
  w: 0,
  h: 0
};

// Load saved
(function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.ratioKey) {
      state.ratioKey = saved.ratioKey;
      state.w = Number(saved.w) || 0;
      state.h = Number(saved.h) || 0;
    }
  } catch (_) { /* ignore */ }
})();

// ─── Router self-install (no other file touched) ───────────────
(function installRatioRenderer() {
  if (featuresRouter.__ratioInstalled) return;
  featuresRouter.__ratioInstalled = true;

  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'ratioPanel') {
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

// ─── CSS ───────────────────────────────────────────────────────
const CSS_ID = 'ratio-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    /* ─── Panel ─── */
    .rn-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 8px 14px;
      overflow-y: auto;
      max-height: 72vh;
      width: 100%;
    }
    .rn-section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 0 4px;
    }
    .rn-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .rn-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.12s ease;
      text-align: left;
      color: var(--text);
      font-family: inherit;
    }
    .rn-card:active { background: var(--surface-3); }
    .rn-card.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .rn-icon {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rn-icon-box {
      border: 2px solid var(--muted);
      border-radius: 4px;
      background: transparent;
      box-sizing: border-box;
    }
    .rn-card.active .rn-icon-box { border-color: var(--accent); }
    .rn-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .rn-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }
    .rn-sub {
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rn-hint {
      font-size: 10px;
      color: var(--muted);
      line-height: 1.4;
      padding: 6px 4px 0;
      opacity: 0.75;
    }

    /* ─── Preview frame overlay ─── */
    .ratio-frame-outline {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      aspect-ratio: var(--rn-w, auto) / var(--rn-h, auto);
      height: 100%;
      width: auto;
      max-width: 100%;
      max-height: 100%;
      /* Big spread shadow acts as the outside mask */
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.78);
      border: 1.5px solid rgba(255, 255, 255, 0.55);
      box-sizing: border-box;
      pointer-events: none;
      z-index: 12;
      border-radius: 2px;
    }
    /* Ratio badge (top-right) */
    .ratio-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      z-index: 60;
      pointer-events: none;
      font-variant-numeric: tabular-nums;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  router.openLevel('ratio', [], {
    title: 'Aspect Ratio',
    level: 2,
    renderMode: 'ratioPanel'
  });
}

// ─── Render panel ──────────────────────────────────────────────
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'rn-panel';

  const title = document.createElement('div');
  title.className = 'rn-section-title';
  title.textContent = 'Choose Frame Ratio';
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'rn-grid';

  const cards = {};

  RATIOS.forEach(r => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'rn-card';
    card.dataset.ratioKey = r.key;
    if (state.ratioKey === r.key) card.classList.add('active');

    // Icon: proportional mini rectangle inside a 40x40 box
    const icon = document.createElement('div');
    icon.className = 'rn-icon';

    const box = document.createElement('div');
    box.className = 'rn-icon-box';

    if (!r.w || !r.h) {
      box.style.width = '34px';
      box.style.height = '26px';
    } else {
      const ar = r.w / r.h;
      const MAX = 34;
      if (ar >= 1) {
        box.style.width = MAX + 'px';
        box.style.height = Math.round(MAX / ar) + 'px';
      } else {
        box.style.height = MAX + 'px';
        box.style.width = Math.round(MAX * ar) + 'px';
      }
    }
    icon.appendChild(box);

    const info = document.createElement('div');
    info.className = 'rn-info';

    const lbl = document.createElement('div');
    lbl.className = 'rn-label';
    lbl.textContent = r.label;

    const sub = document.createElement('div');
    sub.className = 'rn-sub';
    sub.textContent = r.sub;

    info.append(lbl, sub);
    card.append(icon, info);

    card.addEventListener('click', () => {
      selectRatio(r.key);
      Object.values(cards).forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    cards[r.key] = card;
    grid.appendChild(card);
  });

  panel.appendChild(grid);

  const hint = document.createElement('div');
  hint.className = 'rn-hint';
  hint.textContent =
    'Selected ratio is used for the preview frame and will be used for export. ' +
    'Content that extends outside the frame is clipped.';
  panel.appendChild(hint);

  container.appendChild(panel);

  // Make sure preview has the frame applied (in case it wasn't yet)
  applyRatio(state.ratioKey);
}

// ─── Select ratio ──────────────────────────────────────────────
function selectRatio(key) {
  const def = RATIOS.find(r => r.key === key);
  if (!def) return;
  state.ratioKey = def.key;
  state.w = def.w;
  state.h = def.h;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ratioKey: state.ratioKey,
      w: state.w,
      h: state.h
    }));
  } catch (_) { /* ignore */ }

  applyRatio(key);

  // Global hook so other modules (e.g., export) can read it
  window.__offlineEditorRatio = { key: state.ratioKey, w: state.w, h: state.h };
}

// ─── Apply ratio to preview wrap ───────────────────────────────
function applyRatio(key) {
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;

  const def = RATIOS.find(r => r.key === key) || RATIOS[0];

  // Clear previous
  wrap.querySelector('.ratio-frame-outline')?.remove();
  wrap.querySelector('.ratio-badge')?.remove();

  if (def.key === 'original' || !def.w || !def.h) {
    return;
  }

  // Frame overlay with massive shadow-mask
  const frame = document.createElement('div');
  frame.className = 'ratio-frame-outline';
  frame.style.setProperty('--rn-w', String(def.w));
  frame.style.setProperty('--rn-h', String(def.h));
  wrap.appendChild(frame);

  // Badge
  const badge = document.createElement('div');
  badge.className = 'ratio-badge';
  badge.textContent = def.key;
  wrap.appendChild(badge);

  // Expose global
  window.__offlineEditorRatio = { key: state.ratioKey, w: state.w, h: state.h };
}

// ─── Auto-apply on app boot ────────────────────────────────────
(function initExisting() {
  let tries = 0;
  const tick = () => {
    const wrap = document.querySelector('#preview-canvas-wrap');
    if (wrap) {
      if (state.ratioKey !== 'original') applyRatio(state.ratioKey);
      window.__offlineEditorRatio = { key: state.ratioKey, w: state.w, h: state.h };
    } else if (tries++ < 30) {
      setTimeout(tick, 100);
    }
  };
  // First attempt immediately, then poll for DOM
  setTimeout(tick, 0);
})();