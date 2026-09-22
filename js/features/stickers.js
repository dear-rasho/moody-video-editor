// ================================================================
//  js/features/stickers.js
//  Self-contained Stickers feature with keyframes + easing.
//  Integrates with timelineEngine via placeClipAtTime + custom event.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { placeClipAtTime } from '../layers/layersManager.js';

export const featureKey = 'stickers';

const CATEGORIES = [
  { key: 'faces',   label: 'Faces',   icon: '😀',
    items: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😍','😘','😎','🤩','🥳','😜','🤪','😇','🙃','😌','🥺'] },
  { key: 'hearts',  label: 'Hearts',  icon: '❤️',
    items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','💟','❣️','💔','💌','🫶'] },
  { key: 'stars',   label: 'Stars',   icon: '⭐',
    items: ['⭐','🌟','✨','💫','⚡','🔥','💥','💢','✴️','✳️','❇️','🌠','☄️','🌌','💫','🌟','✨','⭐','💫','🌟'] },
  { key: 'arrows',  label: 'Arrows',  icon: '➡️',
    items: ['⬅️','➡️','⬆️','⬇️','↗️','↘️','↙️','↖️','↔️','↕️','🔄','🔃','🔁','🔂','▶️','◀️','🔼','🔽','⏩','⏪'] },
  { key: 'shapes',  label: 'Shapes',  icon: '🔴',
    items: ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔺','🔻'] },
  { key: 'weather', label: 'Weather', icon: '☀️',
    items: ['☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌈','☂️','☔','⚡'] },
  { key: 'nature',  label: 'Nature',  icon: '🌸',
    items: ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🌿','🍀','🍁','🍂','🌱','🌴','🌵','🌾','🍄','🌳','🌲','🪴','🌷'] },
  { key: 'party',   label: 'Party',   icon: '🎉',
    items: ['🎉','🎊','🎈','🎁','🎂','🍰','🥂','🍾','🎀','🎊','🎉','🎈','🎁','🎂','🍭','🍬','🍫','🥳','🎊','🎉'] },
  { key: 'symbols', label: 'Symbols', icon: '✅',
    items: ['✅','❌','❗','❓','⚠️','🚫','💯','🔞','🔆','🔅','♻️','🆗','🆕','🆒','🆓','🆙','🔝','🔙','🔚','🔛'] },
  { key: 'animals', label: 'Animals', icon: '🐶',
    items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝'] }
];

const EASING_OPTIONS = [
  { key: 'linear',        label: 'Linear' },
  { key: 'easeIn',        label: 'Ease In' },
  { key: 'easeOut',       label: 'Ease Out' },
  { key: 'easeInOut',     label: 'Ease In-Out' },
  { key: 'easeInCubic',   label: 'Cubic In' },
  { key: 'easeOutCubic',  label: 'Cubic Out' },
  { key: 'easeInOutCubic',label: 'Cubic In-Out' },
  { key: 'easeInBack',    label: 'Back In' },
  { key: 'easeOutBack',   label: 'Back Out' },
  { key: 'easeInOutBack', label: 'Back In-Out' },
  { key: 'easeOutBounce', label: 'Bounce Out' },
  { key: 'easeOutElastic',label: 'Elastic Out' }
];

const st = {
  categoryKey: 'faces',
  sticker: {
    id: null,
    emoji: '',
    x: 50,
    y: 50,
    scale: 100,
    rotation: 0
  },
  kfPosition: [],
  kfScale: [],
  kfRotation: [],
  easePosition: 'easeInOut',
  easeScale:    'easeInOut',
  easeRotation: 'easeInOut'
};

let overlayEl = null;
let baseFontSize = 96;
let previewRAF = null;

(function installStickersRenderer() {
  if (featuresRouter.__stickersInstalled) return;
  featuresRouter.__stickersInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'stickersPanel') {
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

const CSS_ID = 'stickers-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .sk-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 8px 14px;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: 72vh;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .sk-panel * { box-sizing: border-box; }
    .sk-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      width: 100%;
      min-width: 0;
    }
    .sk-card-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .sk-cat-shelf {
      display: flex;
      gap: 8px;
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 8px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }
    .sk-cat-btn {
      flex: 0 0 auto;
      min-width: 76px;
      padding: 8px 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      scroll-snap-align: start;
    }
    .sk-cat-btn.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }
    .sk-cat-icon { font-size: 22px; line-height: 1; }
    .sk-cat-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
    }
    .sk-cat-btn.active .sk-cat-label { color: var(--text); }
    .sk-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
      gap: 6px;
      width: 100%;
      min-width: 0;
    }
    .sk-item {
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      color: var(--text);
      padding: 0;
    }
    .sk-item.selected {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }
    .sk-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      min-width: 0;
    }
    .sk-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .sk-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }
    .sk-slider-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }
    .sk-slider {
      flex: 1;
      accent-color: var(--accent);
      height: 4px;
      cursor: pointer;
      min-width: 0;
    }
    .sk-num {
      width: 62px;
      padding: 4px 6px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      outline: none;
      font-family: inherit;
      flex-shrink: 0;
    }
    .sk-kf-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 10px;
      margin-top: 4px;
      border-top: 1px solid var(--border);
      width: 100%;
      min-width: 0;
    }
    .sk-kf-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .sk-kf-actions {
      display: flex;
      gap: 8px;
    }
    .sk-kf-btn {
      flex: 1;
      padding: 8px 10px;
      min-height: 38px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      white-space: nowrap;
    }
    .sk-kf-btn.primary {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .sk-kf-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 140px;
      overflow-y: auto;
      width: 100%;
      min-width: 0;
    }
    .sk-kf-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
    }
    .sk-kf-time {
      font-weight: 700;
      color: var(--accent);
      min-width: 48px;
      font-variant-numeric: tabular-nums;
    }
    .sk-kf-value {
      flex: 1;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sk-kf-del {
      background: transparent;
      border: 0;
      color: var(--muted);
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      flex-shrink: 0;
    }
    .sk-kf-empty {
      font-size: 11px;
      color: var(--muted);
      opacity: 0.65;
      padding: 4px;
      text-align: center;
    }
    .sk-ease-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 8px;
      margin-top: 2px;
      border-top: 1px dashed var(--border);
      width: 100%;
      min-width: 0;
    }
    .sk-ease-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .sk-ease-shelf {
      display: flex;
      gap: 8px;
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 8px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }
    .sk-ease-card {
      flex: 0 0 90px;
      width: 90px;
      height: 68px;
      padding: 4px 4px 3px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      scroll-snap-align: start;
      font-family: inherit;
    }
    .sk-ease-card.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }
    .sk-ease-card-curve {
      width: 100%;
      height: 40px;
      display: block;
      border-radius: 5px;
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .sk-ease-card.active .sk-ease-card-curve { background: var(--surface); }
    .sk-ease-card-name {
      font-size: 9px;
      font-weight: 600;
      text-align: center;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
    }
    .sk-ease-card.active .sk-ease-card-name { color: var(--text); }
    .sk-remove-btn {
      padding: 12px 16px;
      min-height: 46px;
      background: var(--surface);
      color: var(--danger);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      width: 100%;
    }
    .sk-overlay {
      position: absolute !important;
      z-index: 200 !important;
      pointer-events: none;
      user-select: none;
      line-height: 1;
      transform-origin: 50% 50%;
      will-change: transform;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", sans-serif !important;
    }
  `;
  document.head.appendChild(style);
}

export function open({ router }) {
  // 🆕 Notify timeline renderer that panel is active
  window.__stickersActiveId = st.sticker.id || null;

  router.openLevel('stickers', [], {
    title: 'Stickers',
    level: 2,
    renderMode: 'stickersPanel'
  });
}
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'sk-panel';

  const catCard = document.createElement('div');
  catCard.className = 'sk-card';

  const catTitle = document.createElement('div');
  catTitle.className = 'sk-card-title';
  catTitle.textContent = 'Sticker Type (swipe →)';

  const catShelf = document.createElement('div');
  catShelf.className = 'sk-cat-shelf';

  const catBtns = {};

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sk-cat-btn';
    btn.dataset.cat = cat.key;
    if (st.categoryKey === cat.key) btn.classList.add('active');

    const ico = document.createElement('span');
    ico.className = 'sk-cat-icon';
    ico.textContent = cat.icon;

    const lbl = document.createElement('span');
    lbl.className = 'sk-cat-label';
    lbl.textContent = cat.label;

    btn.append(ico, lbl);

    btn.addEventListener('click', () => {
      st.categoryKey = cat.key;
      Object.values(catBtns).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStickerGrid(gridContainer);
    });

    catBtns[cat.key] = btn;
    catShelf.appendChild(btn);
  });

  catCard.append(catTitle, catShelf);
  panel.appendChild(catCard);

  const gridCard = document.createElement('div');
  gridCard.className = 'sk-card';

  const gridTitle = document.createElement('div');
  gridTitle.className = 'sk-card-title';
  gridTitle.textContent = 'Tap to add';

  const gridContainer = document.createElement('div');
  gridContainer.className = 'sk-grid';

  gridCard.append(gridTitle, gridContainer);
  panel.appendChild(gridCard);
  renderStickerGrid(gridContainer);

  const posCard = document.createElement('div');
  posCard.className = 'sk-card';

  const posTitle = document.createElement('div');
  posTitle.className = 'sk-card-title';
  posTitle.textContent = 'Position';
  posCard.appendChild(posTitle);

  posCard.appendChild(makeSlider('X (%)', 0, 100, 0.1, st.sticker.x, v => {
    st.sticker.x = v;
    refreshOverlay();
    syncStickerToTimeline();
  }));
  posCard.appendChild(makeSlider('Y (%)', 0, 100, 0.1, st.sticker.y, v => {
    st.sticker.y = v;
    refreshOverlay();
    syncStickerToTimeline();
  }));

  posCard.appendChild(makeKeyframeSection({
    kind: 'position',
    list: st.kfPosition,
    easeKey: 'easePosition',
    capture: () => ({ time: getCurrentTime(), x: st.sticker.x, y: st.sticker.y }),
    format: kf => `X ${kf.x.toFixed(1)}  Y ${kf.y.toFixed(1)}`,
    load: kf => {
      st.sticker.x = kf.x;
      st.sticker.y = kf.y;
      refreshOverlay();
    }
  }));

  panel.appendChild(posCard);

  const scCard = document.createElement('div');
  scCard.className = 'sk-card';

  const scTitle = document.createElement('div');
  scTitle.className = 'sk-card-title';
  scTitle.textContent = 'Scale';
  scCard.appendChild(scTitle);

  scCard.appendChild(makeSlider('Size (%)', 10, 500, 1, st.sticker.scale, v => {
    st.sticker.scale = v;
    refreshOverlay();
    syncStickerToTimeline();
  }));

  scCard.appendChild(makeKeyframeSection({
    kind: 'scale',
    list: st.kfScale,
    easeKey: 'easeScale',
    capture: () => ({ time: getCurrentTime(), value: st.sticker.scale }),
    format: kf => `${kf.value.toFixed(1)}%`,
    load: kf => {
      st.sticker.scale = kf.value;
      refreshOverlay();
    }
  }));

  panel.appendChild(scCard);

  const rotCard = document.createElement('div');
  rotCard.className = 'sk-card';

  const rotTitle = document.createElement('div');
  rotTitle.className = 'sk-card-title';
  rotTitle.textContent = 'Rotation';
  rotCard.appendChild(rotTitle);

  rotCard.appendChild(makeSlider('Angle (°)', -180, 180, 0.5, st.sticker.rotation, v => {
    st.sticker.rotation = v;
    refreshOverlay();
    syncStickerToTimeline();
  }));

  rotCard.appendChild(makeKeyframeSection({
    kind: 'rotation',
    list: st.kfRotation,
    easeKey: 'easeRotation',
    capture: () => ({ time: getCurrentTime(), value: st.sticker.rotation }),
    format: kf => `${kf.value.toFixed(1)}°`,
    load: kf => {
      st.sticker.rotation = kf.value;
      refreshOverlay();
    }
  }));

  panel.appendChild(rotCard);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'sk-remove-btn';
  removeBtn.textContent = '🗑 Remove Sticker';
  removeBtn.addEventListener('click', removeSticker);
  panel.appendChild(removeBtn);

  container.appendChild(panel);

  if (st.sticker.id && st.sticker.emoji) {
    ensureOverlay();
    refreshOverlay();
  }
}

function renderStickerGrid(gridContainer) {
  if (!gridContainer) return;
  gridContainer.replaceChildren();

  const cat = CATEGORIES.find(c => c.key === st.categoryKey) || CATEGORIES[0];

  cat.items.forEach(emoji => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sk-item';
    item.textContent = emoji;
    if (st.sticker.emoji === emoji) item.classList.add('selected');

    item.addEventListener('click', () => {
      gridContainer.querySelectorAll('.sk-item').forEach(x => x.classList.remove('selected'));
      item.classList.add('selected');
      addSticker(emoji);
    });

    gridContainer.appendChild(item);
  });
}

function addSticker(emoji) {
  if (!st.sticker.id) {
    st.sticker.id = 'sk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
  }
  st.sticker.emoji = emoji;

  // 🆕 Tell timeline renderer to skip this sticker
  window.__stickersActiveId = st.sticker.id;

  // Force create + render
  ensureOverlay();
  refreshOverlay();
  commitToTimeline();

  // Re-verify after DOM settles
  requestAnimationFrame(function () {
    ensureOverlay();
    refreshOverlay();
    requestAnimationFrame(function () {
      ensureOverlay();
      refreshOverlay();
    });
  });
}

function makeKeyframeSection({ kind, list, easeKey, capture, format, load }) {
  const section = document.createElement('div');
  section.className = 'sk-kf-section';

  const title = document.createElement('div');
  title.className = 'sk-kf-title';
  title.textContent = 'Keyframes';

  const actions = document.createElement('div');
  actions.className = 'sk-kf-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'sk-kf-btn';
  previewBtn.textContent = '▶ Preview';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'sk-kf-btn primary';
  addBtn.textContent = '+ Add at ' + formatTime(getCurrentTime());

  addBtn.addEventListener('click', () => {
    const kf = capture();
    const filtered = list.filter(k => Math.abs(k.time - kf.time) > 0.05);
    filtered.push(kf);
    filtered.sort((a, b) => a.time - b.time);
    list.length = 0;
    filtered.forEach(k => list.push(k));
    refreshPanel();
  });

  previewBtn.addEventListener('click', () => {
    if (!list.length) return;
    previewKeyframes(kind);
  });

  actions.append(previewBtn, addBtn);
  section.append(title, actions);

  const listEl = document.createElement('div');
  listEl.className = 'sk-kf-list';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'sk-kf-empty';
    empty.textContent = 'No keyframes yet. Scrub timeline then "+ Add".';
    listEl.appendChild(empty);
  } else {
    list.forEach(kf => {
      const item = document.createElement('div');
      item.className = 'sk-kf-item';

      const t = document.createElement('span');
      t.className = 'sk-kf-time';
      t.textContent = formatTime(kf.time);

      const v = document.createElement('span');
      v.className = 'sk-kf-value';
      v.textContent = format(kf);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sk-kf-del';
      del.textContent = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = list.indexOf(kf);
        if (idx >= 0) list.splice(idx, 1);
        refreshPanel();
      });

      item.addEventListener('click', () => {
        const video = document.querySelector('#preview-video');
        if (video && Number.isFinite(kf.time)) {
          video.currentTime = kf.time;
        }
        load(kf);
      });

      item.append(t, v, del);
      listEl.appendChild(item);
    });
  }

  section.appendChild(listEl);
  section.appendChild(makeEasingSelector(easeKey));

  return section;
}

function makeEasingSelector(easeKey) {
  const row = document.createElement('div');
  row.className = 'sk-ease-row';

  const label = document.createElement('div');
  label.className = 'sk-ease-label';
  label.textContent = 'Easing (swipe →)';
  row.appendChild(label);

  const shelf = document.createElement('div');
  shelf.className = 'sk-ease-shelf';

  const cards = {};

  EASING_OPTIONS.forEach(opt => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sk-ease-card';
    card.dataset.ease = opt.key;
    if (st[easeKey] === opt.key) card.classList.add('active');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('sk-ease-card-curve');

    const mid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mid.setAttribute('x1', '0');   mid.setAttribute('y1', '20');
    mid.setAttribute('x2', '100'); mid.setAttribute('y2', '20');
    mid.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    mid.setAttribute('stroke-width', '0.6');
    svg.appendChild(mid);

    const dotA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dotA.setAttribute('cx', '4');   dotA.setAttribute('cy', '36');
    dotA.setAttribute('r', '1.8');
    dotA.setAttribute('fill', 'var(--muted)');
    const dotB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dotB.setAttribute('cx', '96');  dotB.setAttribute('cy', '4');
    dotB.setAttribute('r', '1.8');
    dotB.setAttribute('fill', 'var(--muted)');
    svg.append(dotA, dotB);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('d', buildCurvePath(opt.key, 100, 40, 4));
    svg.appendChild(path);

    const name = document.createElement('div');
    name.className = 'sk-ease-card-name';
    name.textContent = opt.label;

    card.append(svg, name);

    card.addEventListener('click', () => {
      st[easeKey] = opt.key;
      Object.values(cards).forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    cards[opt.key] = card;
    shelf.appendChild(card);
  });

  row.appendChild(shelf);

  setTimeout(() => {
    const active = cards[st[easeKey]];
    if (active && shelf.scrollWidth > shelf.clientWidth) {
      const target = active.offsetLeft - shelf.clientWidth / 2 + active.offsetWidth / 2;
      shelf.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, 60);

  return row;
}

function buildCurvePath(ease, w, h, pad) {
  const N = 48;
  const pts = [];
  const usableH = h - pad * 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = getEasedValue(t, ease);
    const px = t * w;
    const py = h - pad - y * usableH;
    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return 'M ' + pts.join(' L ');
}

function getEasedValue(t, ease) {
  t = Math.max(0, Math.min(1, t));
  switch (ease) {
    case 'linear':        return t;
    case 'easeIn':        return t * t;
    case 'easeOut':       return 1 - (1 - t) * (1 - t);
    case 'easeInOut':     return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':   return t * t * t;
    case 'easeOutCubic':  return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeInBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'easeOutBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'easeInOutBack': {
      const c1 = 1.70158, c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 'easeOutBounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'easeOutElastic': {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    default:
      return t;
  }
}

function refreshPanel() {
  const c = document.querySelector('#feature-shelf');
  if (c) renderTo(c);
}

function previewKeyframes(kind) {
  const video = document.querySelector('#preview-video');
  if (!video) return;
  stopPreview();

  const list =
    kind === 'position' ? st.kfPosition :
    kind === 'scale'    ? st.kfScale    :
                          st.kfRotation;
  const lastKf = list[list.length - 1];
  const endTime = lastKf ? lastKf.time : 0;

  video.currentTime = 0;
  video.play().catch(() => {});

  const loop = () => {
    if (video.paused || video.ended) {
      previewRAF = null;
      return;
    }
    const t = video.currentTime;

    if (kind === 'position' && st.kfPosition.length) {
      const p = interpolatePosition(t);
      if (p) { st.sticker.x = p.x; st.sticker.y = p.y; }
    } else if (kind === 'scale' && st.kfScale.length) {
      const s = interpolateScale(t);
      if (s !== null) st.sticker.scale = s;
    } else if (kind === 'rotation' && st.kfRotation.length) {
      const r = interpolateRotation(t);
      if (r !== null) st.sticker.rotation = r;
    }

    refreshOverlay();

    if (endTime && t >= endTime) {
      video.pause();
      previewRAF = null;
      return;
    }
    previewRAF = requestAnimationFrame(loop);
  };
  previewRAF = requestAnimationFrame(loop);
}

function stopPreview() {
  if (previewRAF) cancelAnimationFrame(previewRAF);
  previewRAF = null;
}

function interpolatePosition(t) {
  const kfs = st.kfPosition;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time)
    return { x: kfs[0].x, y: kfs[0].y };
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return { x: last.x, y: last.y };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, st.easePosition);
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }
  }
  return { x: last.x, y: last.y };
}

function interpolateScale(t) {
  const kfs = st.kfScale;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, st.easeScale);
      return a.value + (b.value - a.value) * local;
    }
  }
  return last.value;
}

function interpolateRotation(t) {
  const kfs = st.kfRotation;
  if (!kfs.length) return null;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const raw = (t - a.time) / (b.time - a.time || 1);
      const local = getEasedValue(raw, st.easeRotation);
      return a.value + (b.value - a.value) * local;
    }
  }
  return last.value;
}

function getCurrentTime() {
  const video = document.querySelector('#preview-video');
  return video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
}

function formatTime(s) {
  if (!Number.isFinite(s)) s = 0;
  return s.toFixed(2) + 's';
}

function makeSlider(label, min, max, step, value, onChange) {
  const row = document.createElement('div');
  row.className = 'sk-row';

  const head = document.createElement('div');
  head.className = 'sk-row-head';

  const lbl = document.createElement('span');
  lbl.className = 'sk-label';
  lbl.textContent = label;
  head.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'sk-slider-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;
  slider.className = 'sk-slider';

  const num = document.createElement('input');
  num.type = 'number';
  num.min = min;
  num.max = max;
  num.step = step;
  num.value = Number(value).toFixed(step < 1 ? 1 : 0);
  num.className = 'sk-num';

  const commit = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, n));
    slider.value = clamped;
    num.value = clamped.toFixed(step < 1 ? 1 : 0);
    onChange(clamped);
  };

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    num.value = v.toFixed(step < 1 ? 1 : 0);
    onChange(v);
  });
  num.addEventListener('change', () => commit(num.value));
  num.addEventListener('blur', () => commit(num.value));

  wrap.append(slider, num);
  row.append(head, wrap);
  return row;
}
function ensureOverlay() {
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return null;

  // 🆕 Robust re-verification every call
  const stillValid = overlayEl &&
                     overlayEl.parentNode &&
                     document.body.contains(overlayEl) &&
                     wrap.contains(overlayEl);

  if (!stillValid) {
    // Remove any orphan .sk-overlay elements
    document.querySelectorAll('.sk-overlay').forEach(function (n) {
      if (n !== overlayEl) n.remove();
    });

    overlayEl = document.createElement('div');
    overlayEl.className = 'sk-overlay';
    wrap.appendChild(overlayEl);
  }

  // 🆕 Force visibility — defensive
  overlayEl.style.position = 'absolute';
  overlayEl.style.zIndex = '200';
  overlayEl.style.display = 'block';
  overlayEl.style.visibility = 'visible';
  overlayEl.style.opacity = '1';
  overlayEl.style.pointerEvents = 'none';

  return overlayEl;
}
function refreshOverlay() {
  // 🆕 Ensure overlay exists (self-healing)
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!wrap) return;

  if (!overlayEl ||
      !overlayEl.parentNode ||
      !wrap.contains(overlayEl)) {
    ensureOverlay();
  }
  if (!overlayEl) return;

  const s = st.sticker;
  if (!s || !s.emoji) return;

  overlayEl.textContent = s.emoji;
  overlayEl.style.fontSize = baseFontSize + 'px';
  overlayEl.style.left = s.x + '%';
  overlayEl.style.top  = s.y + '%';
  overlayEl.style.transform =
    'translate(-50%, -50%) scale(' + (s.scale / 100) + ') rotate(' + s.rotation + 'deg)';
  overlayEl.style.transformOrigin = '50% 50%';
  overlayEl.style.display = 'block';
  overlayEl.style.visibility = 'visible';
  overlayEl.style.opacity = '1';
  overlayEl.style.zIndex = '200';
  overlayEl.style.lineHeight = '1';
}

function removeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Timeline integration — uses layersManager (collision-aware)
// ═══════════════════════════════════════════════════════════════
function commitToTimeline() {
  const s = st.sticker;
  if (!s.id || !s.emoji) return;
  if (!Array.isArray(appState.timeline.visual)) appState.timeline.visual = [];

  const video = document.querySelector('#preview-video');
  const atTime = (video && Number.isFinite(video.currentTime)) ? video.currentTime : 0;
  const dur = 3;

  const clipData = {
    name: s.emoji,
    url: 'sticker://' + s.id,
    type: 'sticker/plain',
    __stickerId: s.id,
    stickerState: Object.assign({}, s),
    startTime: atTime,
    duration: dur
  };

  let found = false;
  for (let t = 0; t < appState.timeline.visual.length; t++) {
    const track = appState.timeline.visual[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__stickerId === s.id);
    if (idx >= 0) {
      track[idx] = Object.assign({}, track[idx], clipData);
      found = true;
      break;
    }
  }

  if (!found) {
    placeClipAtTime(appState.timeline.visual, clipData, atTime);
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

function syncStickerToTimeline() {
  const s = st.sticker;
  if (!s.id) return;
  if (!Array.isArray(appState.timeline.visual)) return;
  for (let t = 0; t < appState.timeline.visual.length; t++) {
    const track = appState.timeline.visual[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__stickerId === s.id);
    if (idx >= 0) {
      track[idx].stickerState = Object.assign({}, s);
      break;
    }
  }
}

function removeSticker() {
  const s = st.sticker;
  if (!s.id) return;

  removeOverlay();
  stopPreview();

  if (Array.isArray(appState.timeline.visual)) {
    for (let t = 0; t < appState.timeline.visual.length; t++) {
      const track = appState.timeline.visual[t];
      if (!Array.isArray(track)) continue;
      const idx = track.findIndex(c => c && c.__stickerId === s.id);
      if (idx >= 0) { track.splice(idx, 1); break; }
    }
  }

  st.sticker = {
    id: null,
    emoji: '',
    x: 50,
    y: 50,
    scale: 100,
    rotation: 0
  };
  st.kfPosition = [];
  st.kfScale = [];
  st.kfRotation = [];

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  refreshPanel();
}