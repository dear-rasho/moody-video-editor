// ================================================================
//  js/features/soundeffect.js
//  Sound Effects — Web Audio synthesized sounds as timeline layers.
//
//  Flow:
//    1. User opens Sound Effects panel
//    2. Picks a category, taps a sound
//    3. Sound is generated → WAV blob → URL
//    4. Placed on audio timeline at playhead
//    5. Trim/move/delete like any other layer
//    6. Plays during preview + export
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { placeClipAtTime } from '../layers/layersManager.js';

export const featureKey = 'soundeffect';

// ═══════════════════════════════════════════════════════════════
//  SOUND LIBRARY — categories with synthesized sounds
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
  {
    key: 'basics', label: 'Basics', icon: '🔔',
    items: [
      { key: 'pop',     label: 'Pop',      icon: '🎈', duration: 0.25 },
      { key: 'click',   label: 'Click',    icon: '👆', duration: 0.08 },
      { key: 'tick',    label: 'Tick',     icon: '⏱️', duration: 0.06 },
      { key: 'ding',    label: 'Ding',     icon: '🛎️', duration: 0.9  },
      { key: 'bell',    label: 'Bell',     icon: '🔔', duration: 1.4  },
      { key: 'coin',    label: 'Coin',     icon: '🪙', duration: 0.6  }
    ]
  },
  {
    key: 'motion', label: 'Motion', icon: '💨',
    items: [
      { key: 'whoosh',  label: 'Whoosh',   icon: '💨', duration: 0.7 },
      { key: 'swoosh',  label: 'Swoosh',   icon: '🌪️', duration: 0.9 },
      { key: 'slide',   label: 'Slide',    icon: '➡️', duration: 0.5 },
      { key: 'rise',    label: 'Riser',    icon: '📈', duration: 1.2 },
      { key: 'fall',    label: 'Dropper',  icon: '📉', duration: 1.2 }
    ]
  },
  {
    key: 'impact', label: 'Impact', icon: '💥',
    items: [
      { key: 'boom',    label: 'Boom',     icon: '💥', duration: 1.5 },
      { key: 'thud',    label: 'Thud',     icon: '🥁', duration: 0.5 },
      { key: 'clap',    label: 'Clap',     icon: '👏', duration: 0.6 },
      { key: 'heart',   label: 'Heartbeat',icon: '❤️', duration: 1.6 }
    ]
  },
  {
    key: 'electronic', label: 'Electronic', icon: '⚡',
    items: [
      { key: 'zap',     label: 'Zap',      icon: '⚡', duration: 0.35 },
      { key: 'laser',   label: 'Laser',    icon: '🔫', duration: 0.3  },
      { key: 'glitch',  label: 'Glitch',   icon: '🌐', duration: 0.4  },
      { key: 'alarm',   label: 'Alarm',    icon: '🚨', duration: 1.2  },
      { key: 'boing',   label: 'Boing',    icon: '🏀', duration: 0.7  }
    ]
  }
];

// Flatten for quick lookup
const SOUND_MAP = {};
CATEGORIES.forEach(c => c.items.forEach(s => { SOUND_MAP[s.key] = s; }));

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installSoundEffectRenderer() {
  if (featuresRouter.__soundEffectInstalled) return;
  featuresRouter.__soundEffectInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'soundeffectPanel') {
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
//  PANEL STATE
// ═══════════════════════════════════════════════════════════════
let currentCat = 'basics';
let generatingKey = null;

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'soundeffect-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .se-panel {
      display: flex; flex-direction: column; gap: 10px;
      width: 100%; max-width: 100%; min-width: 0;
      padding: 10px 8px 14px;
      box-sizing: border-box;
    }
    .se-panel * { box-sizing: border-box; }

    /* Category shelf */
    .se-cat-shelf {
      display: flex; gap: 8px;
      width: 100%; min-width: 0;
      overflow-x: auto; overflow-y: hidden;
      padding: 2px 2px 10px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      touch-action: pan-x;
    }
    .se-cat-shelf::-webkit-scrollbar { height: 5px; }
    .se-cat-shelf::-webkit-scrollbar-thumb {
      background: var(--border); border-radius: 3px;
    }
    .se-cat-btn {
      flex: 0 0 auto; min-width: 80px;
      padding: 8px 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      display: flex; flex-direction: column;
      align-items: center; gap: 4px;
      font-family: inherit;
      scroll-snap-align: start;
    }
    .se-cat-btn.active {
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
      background: var(--surface-2);
    }
    .se-cat-icon { font-size: 22px; line-height: 1; }
    .se-cat-label {
      font-size: 10px; font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
    }
    .se-cat-btn.active .se-cat-label { color: var(--text); }

    /* Sound grid */
    .se-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 8px;
      width: 100%;
    }
    .se-item {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 6px;
      min-height: 88px;
      padding: 10px 4px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .se-item:active { background: var(--surface-3); }
    .se-item.busy {
      pointer-events: none;
      opacity: 0.5;
    }
    .se-item.busy .se-icon {
      animation: se-spin 0.8s linear infinite;
    }
    @keyframes se-spin {
      from { transform: rotate(0); }
      to { transform: rotate(360deg); }
    }
    .se-icon {
      width: 38px; height: 38px;
      border-radius: 50%;
      border: 1px solid var(--border);
      display: grid; place-items: center;
      font-size: 18px;
      background: var(--surface);
      flex-shrink: 0;
    }
    .se-label {
      font-size: 11px; font-weight: 600;
      text-align: center;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    /* Selected info card */
    .se-card {
      display: flex; flex-direction: column; gap: 10px;
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      width: 100%; min-width: 0;
    }
    .se-card-title {
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--muted);
    }
    .se-info {
      display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: var(--text);
    }
    .se-info b { font-weight: 700; }
    .se-info-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }
    .se-remove-btn {
      width: 100%;
      padding: 11px 16px;
      min-height: 44px;
      background: var(--surface);
      color: var(--danger);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit;
    }
    .se-remove-btn:active { background: var(--surface-3); }

    .se-hint {
      font-size: 10px; color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.65;
      padding: 0 4px;
      line-height: 1.4;
    }

    @media (max-width: 380px) {
      .se-grid { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 6px; }
      .se-item { min-height: 80px; padding: 8px 3px; }
      .se-icon { width: 32px; height: 32px; font-size: 15px; }
      .se-label { font-size: 10px; }
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — open + render
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('soundeffect', [], {
    title: 'Sound Effects',
    level: 2,
    renderMode: 'soundeffectPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'se-panel';

  // ─── Hint ────────────────────────────────────────────────
  const hint = document.createElement('div');
  hint.className = 'se-hint';
  hint.textContent = 'Tap a sound to add it at the playhead';
  panel.appendChild(hint);

  // ─── Category shelf ──────────────────────────────────────
  const catShelf = document.createElement('div');
  catShelf.className = 'se-cat-shelf';

  const catBtns = {};
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'se-cat-btn';
    if (cat.key === currentCat) btn.classList.add('active');

    const ic = document.createElement('span');
    ic.className = 'se-cat-icon';
    ic.textContent = cat.icon;

    const lb = document.createElement('span');
    lb.className = 'se-cat-label';
    lb.textContent = cat.label;

    btn.append(ic, lb);
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      Object.values(catBtns).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildGrid();
    });

    catBtns[cat.key] = btn;
    catShelf.appendChild(btn);
  });
  panel.appendChild(catShelf);

  // ─── Sound grid container ────────────────────────────────
  const gridWrap = document.createElement('div');
  panel.appendChild(gridWrap);

  function rebuildGrid() {
    gridWrap.replaceChildren();
    const cat = CATEGORIES.find(c => c.key === currentCat);
    if (!cat) return;

    const grid = document.createElement('div');
    grid.className = 'se-grid';

    cat.items.forEach(sound => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'se-item';
      if (generatingKey === sound.key) item.classList.add('busy');

      const ic = document.createElement('span');
      ic.className = 'se-icon';
      ic.textContent = sound.icon;

      const lb = document.createElement('span');
      lb.className = 'se-label';
      lb.textContent = sound.label;

      item.append(ic, lb);
      item.addEventListener('click', () => handleAdd(sound, item));

      grid.appendChild(item);
    });

    gridWrap.appendChild(grid);
  }

  rebuildGrid();

  // ─── Selected sound card (if any) ────────────────────────
  const sel = getSelectedSoundClip();
  if (sel) {
    const card = document.createElement('div');
    card.className = 'se-card';

    const t = document.createElement('div');
    t.className = 'se-card-title';
    t.textContent = 'Selected Sound Layer';

    const info = document.createElement('div');
    info.className = 'se-info';
    const dot = document.createElement('span');
    dot.className = 'se-info-dot';
    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = '<b>' + escapeHtml(sel.clip.name || 'Sound') + '</b>';
    info.append(dot, nameSpan);
    card.appendChild(t);
    card.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'se-remove-btn';
    removeBtn.textContent = '🗑 Remove Sound Layer';
    removeBtn.addEventListener('click', () => removeSound(sel));

    card.appendChild(removeBtn);
    panel.appendChild(card);
  }

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  ADD SOUND
// ═══════════════════════════════════════════════════════════════
async function handleAdd(sound, btnEl) {
  if (generatingKey) return;
  generatingKey = sound.key;
  if (btnEl) btnEl.classList.add('busy');

  try {
    const blob = await generateSoundBlob(sound.key, sound.duration);
    const url = URL.createObjectURL(blob);

    const eng = window.__playbackEngine;
    const atTime = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

    const id = 'se-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    const clipData = {
      name: sound.icon + ' ' + sound.label,
      url: url,
      type: 'audio/wav',
      duration: sound.duration,
      startTime: atTime,
      sourceIn: 0,
      __sourceTotalDuration: sound.duration,
      __soundId: id,
      __soundKey: sound.key,
      __trimmed: true
    };

    const appState = window.__appState;
    if (!appState) throw new Error('App state missing');
    if (!Array.isArray(appState.timeline.audio)) appState.timeline.audio = [];

    placeClipAtTime(appState.timeline.audio, clipData, atTime);

    // Register with sound player
    registerSoundUrl(id, url);

    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    showToast('Added ' + sound.label);
  } catch (e) {
    console.error('[soundeffect] failed:', e);
    showToast('Failed: ' + (e.message || 'unknown'), false);
  } finally {
    generatingKey = null;
    if (btnEl) btnEl.classList.remove('busy');
  }
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION HELPERS
// ═══════════════════════════════════════════════════════════════
function getSelectedSoundClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;

  const trackLabel = el.dataset.track;
  if (!trackLabel || trackLabel.charAt(0) !== 'A') return null;

  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;

  const appState = window.__appState;
  if (!appState) return null;

  const track = appState.timeline.audio[trackIdx];
  if (!Array.isArray(track)) return null;

  const clip = track[clipIdx];
  if (!clip || !clip.__soundId) return null;

  return { clip, trackIdx, clipIdx };
}

// ═══════════════════════════════════════════════════════════════
//  REMOVE SOUND
// ═══════════════════════════════════════════════════════════════
function removeSound(sel) {
  const appState = window.__appState;
  if (!appState) return;

  const track = appState.timeline.audio[sel.trackIdx];
  if (!Array.isArray(track)) return;

  const idx = track.findIndex(c => c && c.__soundId === sel.clip.__soundId);
  if (idx >= 0) {
    unregisterSoundUrl(track[idx].__soundId);
    try { URL.revokeObjectURL(track[idx].url); } catch (_) {}
    track.splice(idx, 1);
  }

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  showToast('Sound layer removed');

  const c = document.querySelector('#feature-shelf');
  if (c) renderTo(c);
}

// ═══════════════════════════════════════════════════════════════
//  SOUND GENERATOR — Web Audio → WAV blob
// ═══════════════════════════════════════════════════════════════
async function generateSoundBlob(key, duration) {
  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(sampleRate * duration));

  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext not available');

  const ac = new OAC(1, length, sampleRate);
  renderInto(ac, key, duration, length, sampleRate);

  const buffer = await ac.startRendering();
  return encodeWav(buffer);
}

// ─── Dispatch by key ─────────────────────────────────────────
function renderInto(ac, key, dur, len, sr) {
  switch (key) {
    case 'pop':     genPop(ac, dur); break;
    case 'click':   genClick(ac, dur, len, 4); break;
    case 'tick':    genClick(ac, dur, len, 8); break;
    case 'ding':    genDing(ac, dur); break;
    case 'bell':    genBell(ac, dur); break;
    case 'coin':    genCoin(ac); break;

    case 'whoosh':  genWhoosh(ac, dur, len, 250, 3500); break;
    case 'swoosh':  genWhoosh(ac, dur, len, 400, 6000); break;
    case 'slide':   genSweep(ac, dur, 1200, 300); break;
    case 'rise':    genSweep(ac, dur, 200, 3000); break;
    case 'fall':    genSweep(ac, dur, 3000, 200); break;

    case 'boom':    genBoom(ac, dur, len, sr); break;
    case 'thud':    genThud(ac, dur); break;
    case 'clap':    genClap(ac, dur, len, sr); break;
    case 'heart':   genHeartbeat(ac); break;

    case 'zap':     genZap(ac, dur); break;
    case 'laser':   genLaser(ac, dur); break;
    case 'glitch':  genGlitch(ac, dur, len, sr); break;
    case 'alarm':   genAlarm(ac, dur); break;
    case 'boing':   genBoing(ac, dur); break;
  }
}

// ─── Simple sounds ────────────────────────────────────────────
function genPop(ac, dur) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, 0);
  osc.frequency.exponentialRampToValueAtTime(140, dur * 0.85);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.85, 0);
  g.gain.exponentialRampToValueAtTime(0.001, dur);
  osc.connect(g).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);
}

function genClick(ac, dur, len, exp) {
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, exp);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = 0.7;
  src.connect(g).connect(ac.destination);
  src.start(0);
}

function genDing(ac, dur) {
  [1046, 1568].forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.4 / (i + 1), 0);
    g.gain.exponentialRampToValueAtTime(0.001, dur * (1 - i * 0.3));
    osc.connect(g).connect(ac.destination);
    osc.start(0);
    osc.stop(dur);
  });
}

function genBell(ac, dur) {
  [880, 1320, 1760, 2640, 3520].forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3 / (i + 1), 0);
    g.gain.exponentialRampToValueAtTime(0.001, dur);
    osc.connect(g).connect(ac.destination);
    osc.start(0);
    osc.stop(dur);
  });
}

function genCoin(ac) {
  const note = (f, start, dur, vol) => {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur);
  };
  note(988,  0,    0.15, 0.3);
  note(1319, 0.08, 0.4,  0.3);
}

// ─── Whoosh / sweeps ──────────────────────────────────────────
function genWhoosh(ac, dur, len, f1, f2) {
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(f1, 0);
  filter.frequency.exponentialRampToValueAtTime(f2, dur * 0.75);
  filter.frequency.exponentialRampToValueAtTime(f1, dur);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, 0);
  g.gain.linearRampToValueAtTime(0.7, dur * 0.3);
  g.gain.linearRampToValueAtTime(0.001, dur);

  src.connect(filter).connect(g).connect(ac.destination);
  src.start(0);
  src.stop(dur);
}

function genSweep(ac, dur, f1, f2) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f1, 0);
  osc.frequency.exponentialRampToValueAtTime(f2, dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, 0);
  g.gain.linearRampToValueAtTime(0.4, dur * 0.2);
  g.gain.linearRampToValueAtTime(0.001, dur);
  osc.connect(g).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);
}

// ─── Impacts ──────────────────────────────────────────────────
function genBoom(ac, dur, len, sr) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, 0);
  osc.frequency.exponentialRampToValueAtTime(28, dur);
  const g1 = ac.createGain();
  g1.gain.setValueAtTime(0.9, 0);
  g1.gain.exponentialRampToValueAtTime(0.001, dur);
  osc.connect(g1).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);

  const nlen = Math.floor(sr * 0.15);
  const nbuf = ac.createBuffer(1, nlen, sr);
  const nd = nbuf.getChannelData(0);
  for (let i = 0; i < nlen; i++) {
    nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nlen, 3);
  }
  const nsrc = ac.createBufferSource();
  nsrc.buffer = nbuf;
  const ng = ac.createGain();
  ng.gain.value = 0.35;
  nsrc.connect(ng).connect(ac.destination);
  nsrc.start(0);
}

function genThud(ac, dur) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, 0);
  osc.frequency.exponentialRampToValueAtTime(45, dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.75, 0);
  g.gain.exponentialRampToValueAtTime(0.001, dur);
  osc.connect(g).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);
}

function genClap(ac, dur, totalLen, sr) {
  const bursts = [0, 0.02, 0.045, 0.09];
  bursts.forEach((start, i) => {
    const blen = Math.floor(sr * 0.05);
    const buf = ac.createBuffer(1, blen, sr);
    const d = buf.getChannelData(0);
    for (let j = 0; j < blen; j++) {
      d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / blen, 3);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200 + i * 300;
    filter.Q.value = 1.2;

    const g = ac.createGain();
    g.gain.value = 0.5 - i * 0.05;

    src.connect(filter).connect(g).connect(ac.destination);
    src.start(start);
  });
}

function genHeartbeat(ac) {
  const thump = (start, vol) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, start);
    osc.frequency.exponentialRampToValueAtTime(35, start + 0.15);

    const g = ac.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  };
  thump(0,    0.7);
  thump(0.32, 0.55);
}

// ─── Electronic ───────────────────────────────────────────────
function genZap(ac, dur) {
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1400, 0);
  osc.frequency.exponentialRampToValueAtTime(180, dur);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2500, 0);
  filter.frequency.exponentialRampToValueAtTime(600, dur);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.5, 0);
  g.gain.exponentialRampToValueAtTime(0.001, dur);

  osc.connect(filter).connect(g).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);
}

function genLaser(ac, dur) {
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2000, 0);
  osc.frequency.exponentialRampToValueAtTime(300, dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.4, 0);
  g.gain.exponentialRampToValueAtTime(0.001, dur);
  osc.connect(g).connect(ac.destination);
  osc.start(0);
  osc.stop(dur);
}

function genGlitch(ac, dur, len, sr) {
  const nlen = Math.floor(sr * dur);
  const buf = ac.createBuffer(1, nlen, sr);
  const d = buf.getChannelData(0);
  let lastVal = 0;
  for (let i = 0; i < nlen; i++) {
    if (Math.random() < 0.05) lastVal = Math.random() * 2 - 1;
    d[i] = lastVal;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 500;

  const g = ac.createGain();
  g.gain.value = 0.35;

  src.connect(filter).connect(g).connect(ac.destination);
  src.start(0);
}

function genAlarm(ac, dur) {
  const t1 = 800, t2 = 1200;
  const period = 0.25;
  let t = 0;
  let state = 0;
  while (t < dur) {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = state === 0 ? t1 : t2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.01);
    g.gain.setValueAtTime(0.22, t + period - 0.02);
    g.gain.linearRampToValueAtTime(0.001, t + period);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + period);
    t += period;
    state = 1 - state;
  }
}

function genBoing(ac, dur) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, 0);
  osc.frequency.exponentialRampToValueAtTime(500, dur * 0.4);
  osc.frequency.exponentialRampToValueAtTime(90, dur);

  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 22;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 40;
  lfo.connect(lfoGain).connect(osc.frequency);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.6, 0);
  g.gain.exponentialRampToValueAtTime(0.001, dur);

  osc.connect(g).connect(ac.destination);
  lfo.start(0);
  lfo.stop(dur);
  osc.start(0);
  osc.stop(dur);
}

// ═══════════════════════════════════════════════════════════════
//  WAV ENCODER
// ═══════════════════════════════════════════════════════════════
function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataLen = len * blockAlign;
  const headerSize = 44;
  const ab = new ArrayBuffer(headerSize + dataLen);
  const view = new DataView(ab);

  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let off = headerSize;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

// ═══════════════════════════════════════════════════════════════
//  SOUND PLAYER — independent from main #preview-audio
// ═══════════════════════════════════════════════════════════════
const soundPlayers = new Map(); // soundId -> { el, wasActive }

function registerSoundUrl(soundId, url) {
  if (!soundId || !url) return;
  let entry = soundPlayers.get(soundId);
  if (!entry) {
    const el = new Audio(url);
    el.preload = 'auto';
    entry = { el, wasActive: false };
    soundPlayers.set(soundId, entry);
  } else {
    entry.el.src = url;
  }
}

function unregisterSoundUrl(soundId) {
  if (!soundId) return;
  const entry = soundPlayers.get(soundId);
  if (entry) {
    try { entry.el.pause(); } catch (_) {}
    soundPlayers.delete(soundId);
  }
}

function tickSoundPlayback(time, playing) {
  const appState = window.__appState;
  if (!appState) return;

  const tracks = appState.timeline.audio || [];
  const seen = new Set();

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__soundId) continue;
      seen.add(clip.__soundId);

      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      const inRange = time >= s && time < s + d;

      let entry = soundPlayers.get(clip.__soundId);
      if (!entry) {
        registerSoundUrl(clip.__soundId, clip.url);
        entry = soundPlayers.get(clip.__soundId);
      }
      if (!entry) continue;

      if (playing && inRange) {
        const localTime = (time - s) + (clip.sourceIn || 0);
        const drift = Math.abs(entry.el.currentTime - localTime);

        if (!entry.wasActive || drift > 0.2) {
          try { entry.el.currentTime = Math.max(0, localTime); } catch (_) {}
          if (entry.el.paused) {
            entry.el.play().catch(() => {});
          }
        } else if (entry.el.paused) {
          entry.el.play().catch(() => {});
        }
      } else {
        if (!entry.el.paused) {
          try { entry.el.pause(); } catch (_) {}
        }
        if (!inRange) {
          try { entry.el.currentTime = 0; } catch (_) {}
        }
      }

      entry.wasActive = inRange;
    }
  }

  // Clean up orphaned players
  soundPlayers.forEach((entry, id) => {
    if (!seen.has(id)) {
      try { entry.el.pause(); } catch (_) {}
      soundPlayers.delete(id);
    }
  });
}

// ─── Global tick listener (installed once) ────────────────────
let tickListenerInstalled = false;
function installTickListener() {
  if (tickListenerInstalled) return;
  tickListenerInstalled = true;

  document.addEventListener('playback:tick', (e) => {
    const d = e.detail || {};
    tickSoundPlayback(Number(d.time) || 0, true);
  });

  document.addEventListener('playback:state', (e) => {
    const playing = e.detail && e.detail.playing;
    if (!playing) {
      soundPlayers.forEach(entry => {
        try { entry.el.pause(); } catch (_) {}
        entry.wasActive = false;
      });
    }
  });
}

// Install listener on module load
installTickListener();

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','opacity:0',
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}