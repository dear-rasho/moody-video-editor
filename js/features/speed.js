// ================================================================
//  js/features/speed.js
//  Speed panel. Slider only commits on 'change' (release), so
//  history captures ONE step per drag.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { registerSpeed, getEasedValue } from './keyframeEngine.js';

export const featureKey = 'speed';

(function installSpeedRenderer() {
  if (featuresRouter.__speedInstalled) return;
  featuresRouter.__speedInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'speedPanel') {
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

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];

const st = {
  currentSpeed: 1.0,
  baseDuration: 3,
  ease: 'easeInOut',
  kf: []
};

const CSS_ID = 'speed-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = [
    '.sp-panel{display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%;min-width:0;padding:0;margin:0;box-sizing:border-box;}',
    '.sp-panel *{box-sizing:border-box;}',
    '.sp-info{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--muted);letter-spacing:.02em;flex:0 0 auto;}',
    '.sp-info-row{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.sp-info-row b{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}',
    '.sp-card{display:flex;flex-direction:column;gap:10px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;width:100%;min-width:0;flex:0 0 auto;}',
    '.sp-card-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}',
    '.sp-row{display:flex;flex-direction:column;gap:4px;width:100%;min-width:0;}',
    '.sp-row-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.sp-label{font-size:12px;font-weight:600;color:var(--text);}',
    '.sp-value{font-size:14px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;}',
    '.sp-slider{width:100%;accent-color:var(--accent);height:5px;cursor:pointer;}',
    '.sp-presets{display:flex;gap:6px;flex-wrap:wrap;}',
    '.sp-chip{padding:7px 12px;min-height:34px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:18px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}',
    '.sp-chip.active{background:var(--accent);color:#000;border-color:var(--accent);}',
    '.sp-kf-section{display:flex;flex-direction:column;gap:10px;width:100%;min-width:0;}',
    '.sp-kf-actions{display:flex;gap:8px;}',
    '.sp-kf-btn{flex:1;padding:8px 10px;min-height:38px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--surface);color:var(--text);white-space:nowrap;}',
    '.sp-kf-btn.primary{background:var(--accent);color:#000;border-color:var(--accent);}',
    '.sp-ease-row{display:flex;flex-direction:column;gap:8px;width:100%;min-width:0;}',
    '.sp-ease-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}',
    '.sp-ease-shelf{display:flex;gap:8px;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin;touch-action:pan-x;}',
    '.sp-ease-shelf::-webkit-scrollbar{height:5px;}',
    '.sp-ease-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}',
    '.sp-ease-card{flex:0 0 96px;width:96px;height:78px;padding:5px 5px 4px;background:var(--surface);border:1px solid var(--border);border-radius:9px;color:var(--text);cursor:pointer;display:flex;flex-direction:column;gap:4px;scroll-snap-align:start;font-family:inherit;}',
    '.sp-ease-card.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:var(--surface-2);}',
    '.sp-ease-card-curve{width:100%;height:48px;display:block;border-radius:5px;background:var(--surface-2);flex-shrink:0;}',
    '.sp-ease-card.active .sp-ease-card-curve{background:var(--surface);}',
    '.sp-ease-card-name{font-size:9.5px;font-weight:600;text-align:center;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;}',
    '.sp-ease-card.active .sp-ease-card-name{color:var(--text);}',
    '.sp-kf-list{display:flex;flex-direction:column;gap:4px;max-height:130px;overflow-y:auto;width:100%;min-width:0;}',
    '.sp-kf-item{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer;}',
    '.sp-kf-time{font-weight:700;color:var(--accent);min-width:48px;font-variant-numeric:tabular-nums;}',
    '.sp-kf-value{flex:1;color:var(--muted);font-variant-numeric:tabular-nums;font-size:11px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sp-kf-del{background:transparent;border:0;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px;flex-shrink:0;}',
    '.sp-kf-empty{font-size:11px;color:var(--muted);opacity:.65;padding:8px;text-align:center;}',
    '.sp-reset{padding:11px 16px;min-height:44px;background:var(--surface);color:var(--danger);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;flex:0 0 auto;}',
    '.sp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 16px;background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;text-align:center;color:var(--muted);font-size:12px;line-height:1.45;flex:0 0 auto;}',
    '.sp-empty-icon{font-size:26px;opacity:.55;line-height:1;}',
    '.sp-empty-title{font-size:13px;font-weight:700;color:var(--text);}',
    '.sp-empty-text{font-size:11px;color:var(--muted);max-width:280px;}'
  ].join('\n');
  document.head.appendChild(s);
}

export function open({ router }) {
  router.openLevel('speed', [], {
    title: 'Speed',
    level: 2,
    renderMode: 'speedPanel'
  });
}

function getSelectedClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const trackLabel = el.dataset.track;
  if (!trackLabel) return null;
  const group = trackLabel[0] === 'A' ? 'audio' : 'visual';
  const trackIndex = Number(trackLabel.slice(1)) - 1;
  const clipIndex = Number(el.dataset.clip);
  if (!Number.isFinite(trackIndex) || !Number.isFinite(clipIndex)) return null;
  const list = appState.timeline[group];
  if (!Array.isArray(list)) return null;
  const track = list[trackIndex];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIndex];
  if (!clip) return null;
  return { group, trackIndex, clipIndex, clip, track };
}

function getPlayheadTime() {
  const v = document.querySelector('#preview-video');
  return v && Number.isFinite(v.currentTime) ? v.currentTime : 0;
}

function isSpeedCapable(clip) {
  const t = clip && clip.type ? clip.type : '';
  return t.indexOf('video/') === 0 || t.indexOf('audio/') === 0;
}

function commit() {
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

function ensureBase(clip) {
  if (!Number.isFinite(clip.__speedBase) || clip.__speedBase <= 0) {
    clip.__speedBase = Number.isFinite(clip.duration) ? clip.duration : 3;
  }
  return clip.__speedBase;
}

function applySpeed(clip, speed) {
  const base = ensureBase(clip);
  clip.__speed = speed;
  clip.duration = base / speed;
}

function showToast(message, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:' + (ok ? 'rgba(0,0,0,0.88)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','opacity:0',
    'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit','max-width:80vw','white-space:nowrap',
    'overflow:hidden','text-overflow:ellipsis'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(function () {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(function () { el.remove(); }, 260);
  }, 1500);
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'sp-panel';

  const sel = getSelectedClip();

  if (!sel) {
    panel.appendChild(buildEmptyState({
      icon: '👆',
      title: 'No clip selected',
      text: 'Tap a video or audio clip on the timeline first.'
    }));
    container.appendChild(panel);
    return;
  }

  if (!isSpeedCapable(sel.clip)) {
    panel.appendChild(buildEmptyState({
      icon: '🚫',
      title: 'Speed not available',
      text: 'Speed only works on video and audio clips. This clip is "' +
            (sel.clip.type || 'unknown') + '".'
    }));
    container.appendChild(panel);
    return;
  }

  const base = ensureBase(sel.clip);
  const speed = Number.isFinite(sel.clip.__speed) ? sel.clip.__speed : 1.0;
  st.baseDuration = base;
  st.currentSpeed = speed;
  st.kf = Array.isArray(sel.clip.__speedKf) ? sel.clip.__speedKf.slice() : [];
  st.ease = sel.clip.__speedEase || 'easeInOut';

  registerSpeed(sel.clip);

  // Info
  const info = document.createElement('div');
  info.className = 'sp-info';
  const nameRow = document.createElement('div');
  nameRow.className = 'sp-info-row';
  nameRow.innerHTML = 'Clip: <b>' + escapeHtml(sel.clip.name || 'Clip') + '</b>';
  const durRow = document.createElement('div');
  durRow.className = 'sp-info-row';
  durRow.innerHTML = 'Duration: <b class="sp-dur">' + (base / speed).toFixed(2) + 's</b>';
  info.append(nameRow, durRow);
  panel.appendChild(info);

  // Speed card
  const card = document.createElement('div');
  card.className = 'sp-card';

  const cardTitle = document.createElement('div');
  cardTitle.className = 'sp-card-title';
  cardTitle.textContent = 'Playback Speed';
  card.appendChild(cardTitle);

  const rowHead = document.createElement('div');
  rowHead.className = 'sp-row-head';
  const lbl = document.createElement('span');
  lbl.className = 'sp-label';
  lbl.textContent = 'Speed';
  const val = document.createElement('span');
  val.className = 'sp-value';
  val.textContent = speed.toFixed(2) + 'x';
  rowHead.append(lbl, val);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'sp-slider';
  slider.min = '0.25';
  slider.max = '4';
  slider.step = '0.05';
  slider.value = String(speed);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'sp-row';
  sliderRow.append(rowHead, slider);
  card.appendChild(sliderRow);

  const presets = document.createElement('div');
  presets.className = 'sp-presets';
  const chipRefs = [];
  PRESETS.forEach(function (p) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sp-chip' + (Math.abs(p - speed) < 0.01 ? ' active' : '');
    chip.textContent = p + 'x';
    chip.addEventListener('click', function () {
      slider.value = String(p);
      // Preset = discrete action → commit immediately
      applySpeedValue(sel.clip, p, true);
    });
    chipRefs.push(chip);
    presets.appendChild(chip);
  });
  card.appendChild(presets);

  function applySpeedValue(clip, v, doCommit) {
    st.currentSpeed = v;
    val.textContent = v.toFixed(2) + 'x';
    applySpeed(clip, v);
    const durEl = panel.querySelector('.sp-dur');
    if (durEl) durEl.textContent = (base / v).toFixed(2) + 's';
    registerSpeed(clip);
    chipRefs.forEach(function (c) {
      const cp = parseFloat(c.textContent);
      c.classList.toggle('active', Math.abs(cp - v) < 0.01);
    });
    if (doCommit) commit();
  }

  // Slider input: update visual only, NO history
  slider.addEventListener('input', function () {
    applySpeedValue(sel.clip, parseFloat(slider.value), false);
  });

  // Slider release: this is one undo step
  slider.addEventListener('change', function () {
    applySpeedValue(sel.clip, parseFloat(slider.value), true);
  });

  panel.appendChild(card);

  // Keyframes card
  const kfCard = document.createElement('div');
  kfCard.className = 'sp-card';
  const kfTitle = document.createElement('div');
  kfTitle.className = 'sp-card-title';
  kfTitle.textContent = 'Speed Keyframes';
  kfCard.appendChild(kfTitle);
  kfCard.appendChild(buildKeyframeSection(sel));
  panel.appendChild(kfCard);

  // Reset
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'sp-reset';
  resetBtn.textContent = '↺ Reset Speed';
  resetBtn.addEventListener('click', function () {
    st.kf = [];
    st.ease = 'easeInOut';
    applySpeed(sel.clip, 1.0);
    delete sel.clip.__speedKf;
    delete sel.clip.__speedEase;
    registerSpeed(sel.clip);
    commit();
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
    showToast('Speed reset');
  });
  panel.appendChild(resetBtn);

  container.appendChild(panel);
}

function buildKeyframeSection(sel) {
  const section = document.createElement('div');
  section.className = 'sp-kf-section';

  const actions = document.createElement('div');
  actions.className = 'sp-kf-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'sp-kf-btn';
  previewBtn.textContent = '▶ Preview';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'sp-kf-btn primary';
  addBtn.textContent = '+ Add at ' + getPlayheadTime().toFixed(2) + 's';

  addBtn.addEventListener('click', function () {
    const t = getPlayheadTime();
    const v = st.currentSpeed;
    const filtered = st.kf.filter(function (k) { return Math.abs(k.time - t) > 0.05; });
    filtered.push({ time: t, value: v });
    filtered.sort(function (a, b) { return a.time - b.time; });
    st.kf = filtered;
    sel.clip.__speedKf = st.kf.slice();
    sel.clip.__speedEase = st.ease;
    registerSpeed(sel.clip);
    commit();
    refreshPanel();
  });

  previewBtn.addEventListener('click', function () {
    const video = document.querySelector('#preview-video');
    if (!video) return;
    if (!video.src || !sel.clip.url || video.src !== sel.clip.url) {
      showToast('Open this clip in preview first', false);
      return;
    }
    try { video.currentTime = 0; } catch (_) {}
    video.play().catch(function () {});
  });

  actions.append(previewBtn, addBtn);
  section.appendChild(actions);

  section.appendChild(buildEasingSelector(sel));

  const listLabel = document.createElement('div');
  listLabel.className = 'sp-ease-label';
  listLabel.textContent = 'Keyframes';
  section.appendChild(listLabel);

  const listEl = document.createElement('div');
  listEl.className = 'sp-kf-list';

  if (!st.kf.length) {
    const empty = document.createElement('div');
    empty.className = 'sp-kf-empty';
    empty.textContent = 'No keyframes. Scrub playhead and tap "+ Add".';
    listEl.appendChild(empty);
  } else {
    st.kf.forEach(function (kf) {
      const item = document.createElement('div');
      item.className = 'sp-kf-item';

      const t = document.createElement('span');
      t.className = 'sp-kf-time';
      t.textContent = kf.time.toFixed(2) + 's';

      const v = document.createElement('span');
      v.className = 'sp-kf-value';
      v.textContent = kf.value.toFixed(2) + 'x';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sp-kf-del';
      del.textContent = '🗑';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        const idx = st.kf.indexOf(kf);
        if (idx >= 0) st.kf.splice(idx, 1);
        sel.clip.__speedKf = st.kf.slice();
        registerSpeed(sel.clip);
        commit();
        refreshPanel();
      });

      item.addEventListener('click', function () {
        const video = document.querySelector('#preview-video');
        if (video && Number.isFinite(kf.time)) video.currentTime = kf.time;
      });

      item.append(t, v, del);
      listEl.appendChild(item);
    });
  }

  section.appendChild(listEl);
  return section;
}

function buildEasingSelector(sel) {
  const row = document.createElement('div');
  row.className = 'sp-ease-row';

  const label = document.createElement('div');
  label.className = 'sp-ease-label';
  label.textContent = 'Easing (swipe →)';
  row.appendChild(label);

  const shelf = document.createElement('div');
  shelf.className = 'sp-ease-shelf';

  const cards = {};

  EASING_OPTIONS.forEach(function (opt) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sp-ease-card';
    if (st.ease === opt.key) card.classList.add('active');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 48');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('sp-ease-card-curve');

    const mid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mid.setAttribute('x1', '0');   mid.setAttribute('y1', '24');
    mid.setAttribute('x2', '100'); mid.setAttribute('y2', '24');
    mid.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    mid.setAttribute('stroke-width', '0.6');
    svg.appendChild(mid);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('d', buildCurvePath(opt.key, 100, 48, 4));
    svg.appendChild(path);

    const name = document.createElement('div');
    name.className = 'sp-ease-card-name';
    name.textContent = opt.label;

    card.append(svg, name);

    card.addEventListener('click', function () {
      st.ease = opt.key;
      sel.clip.__speedEase = opt.key;
      Object.keys(cards).forEach(function (k) { cards[k].classList.remove('active'); });
      card.classList.add('active');
      registerSpeed(sel.clip);
      commit();
    });

    cards[opt.key] = card;
    shelf.appendChild(card);
  });

  row.appendChild(shelf);
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
    pts.push(px.toFixed(2) + ',' + py.toFixed(2));
  }
  return 'M ' + pts.join(' L ');
}

function refreshPanel() {
  const c = document.querySelector('#feature-shelf');
  if (c) renderTo(c);
}

function buildEmptyState(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'sp-empty';

  const ic = document.createElement('div');
  ic.className = 'sp-empty-icon';
  ic.textContent = opts.icon;

  const t = document.createElement('div');
  t.className = 'sp-empty-title';
  t.textContent = opts.title;

  const d = document.createElement('div');
  d.className = 'sp-empty-text';
  d.textContent = opts.text;

  wrap.append(ic, t, d);
  return wrap;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}