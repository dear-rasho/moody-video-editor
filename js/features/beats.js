// ================================================================
//  js/features/beats.js
//  Beats panel — manual beat detection + beats edit.
//  Same design as filters/adjustments panels.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { runDetectBeats, runBeatsEditing } from '../codebase/beatsEngine.js';

export const featureKey = 'beats';
export const featureLabel = 'Beats';
export const featureIcon = '🥁';

// ─── Range options for detect ───────────────────────────────
const RANGES = [
  { key: 'all',     label: 'All',      sub: 'Every beat' },
  { key: 'hard',    label: 'Hard',     sub: '🔴 Punchy' },
  { key: 'medium',  label: 'Medium',   sub: '🟡 Standard' },
  { key: 'soft',    label: 'Soft',     sub: '🟢 Gentle' },
  { key: 'hard,med',label: 'Hard+Med', sub: '🔴🟡 Drop' },
  { key: 'med,soft',label: 'Med+Soft', sub: '🟡🟢 Chill' }
];

// ─── Effect pattern presets ─────────────────────────────────
const PRESETS = [
  { label: 'Shake → Zoom → Pulse',  pattern: 'shake, zoom, pulse' },
  { label: 'Hard Stack',            pattern: 'hard: shake+glow ; rest: zoom, pulse, bounce' },
  { label: 'Bounce Cycle',          pattern: 'bounce, pulse, glitch, wobble' },
  { label: 'Color Pop',             pattern: 'warm, cool, vivid, cinematic' },
  { label: 'Full Motion',           pattern: 'shake, zoom, pulse, glitch, bounce, flicker' }
];

// ─── Panel state (persists across opens) ────────────────────
let state = {
  range: 'all',
  pattern: 'shake, zoom, pulse',
  lastMsg: '',
  lastOk: true
};

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installBeatsRenderer() {
  if (featuresRouter.__beatsInstalled) return;
  featuresRouter.__beatsInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'beatsPanel') {
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
const CSS_ID = 'beats-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .bt-panel{display:flex;flex-direction:column;gap:10px;padding:10px 8px 14px;width:100%;box-sizing:border-box;}
    .bt-panel *{box-sizing:border-box;}
    .bt-card{display:flex;flex-direction:column;gap:10px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;}
    .bt-card-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .bt-status{padding:8px 12px;border-radius:8px;font-size:11px;font-weight:700;line-height:1.4;letter-spacing:.02em;}
    .bt-status.info{background:rgba(79,157,255,0.12);border:1px solid #4f9dff;color:#7ab5ff;}
    .bt-status.ok{background:rgba(34,197,94,0.12);border:1px solid #22c55e;color:#4ade80;}
    .bt-status.err{background:rgba(255,107,107,0.12);border:1px solid #ff6b6b;color:#ff8888;}
    .bt-status.warn{background:rgba(245,158,11,0.12);border:1px solid #f59e0b;color:#fbbf24;}
    .bt-status .bt-badge{display:inline-block;padding:2px 8px;border-radius:10px;background:rgba(255,0,102,0.85);color:#fff;font-size:10px;font-weight:800;margin-left:6px;}
    .bt-range-shelf{display:flex;gap:6px;width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0 6px;scrollbar-width:thin;touch-action:pan-x;-webkit-overflow-scrolling:touch;}
    .bt-range-shelf::-webkit-scrollbar{height:5px;}
    .bt-range-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .bt-range-btn{flex:0 0 auto;min-width:74px;padding:8px 10px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .12s ease;-webkit-tap-highlight-color:transparent;}
    .bt-range-btn:active{background:var(--surface-3);}
    .bt-range-btn.active{background:linear-gradient(135deg,#ff0066 0%,#ff5588 100%);border-color:#ff3388;color:#fff;box-shadow:0 2px 10px rgba(255,0,102,.4);}
    .bt-range-lbl{font-size:11.5px;font-weight:700;white-space:nowrap;}
    .bt-range-sub{font-size:9px;font-weight:600;opacity:.75;white-space:nowrap;}
    .bt-row{display:flex;gap:8px;}
    .bt-btn{flex:1;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .12s ease;-webkit-tap-highlight-color:transparent;}
    .bt-btn:active{transform:scale(.98);}
    .bt-btn.primary{background:linear-gradient(135deg,#ff0066 0%,#ff5588 100%);border-color:#ff3388;color:#fff;box-shadow:0 4px 14px rgba(255,0,102,.35);}
    .bt-btn.primary:disabled{opacity:.5;cursor:not-allowed;}
    .bt-btn.danger{color:var(--danger);}
    .bt-input{width:100%;min-height:60px;max-height:140px;padding:10px 12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;line-height:1.45;resize:vertical;outline:none;transition:border-color .14s ease;}
    .bt-input:focus{border-color:#ff3388;}
    .bt-input::placeholder{color:var(--muted);opacity:.65;}
    .bt-preset-shelf{display:flex;gap:6px;width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0 6px;scrollbar-width:thin;touch-action:pan-x;-webkit-overflow-scrolling:touch;}
    .bt-preset-shelf::-webkit-scrollbar{height:5px;}
    .bt-preset-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .bt-preset-chip{flex:0 0 auto;padding:7px 12px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:16px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .12s ease;-webkit-tap-highlight-color:transparent;}
    .bt-preset-chip:active{background:var(--surface-3);color:var(--text);border-color:#ff3388;}
    .bt-hint{font-size:10.5px;color:var(--muted);line-height:1.5;padding:0 4px;letter-spacing:.02em;opacity:.8;}
    .bt-hint b{color:var(--text);font-weight:700;}
    .bt-hint code{background:var(--surface);padding:1px 5px;border-radius:4px;font-family:'Courier New',monospace;font-size:10px;color:#ff5588;}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  OPEN
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('beats', [], {
    title: 'Beats',
    level: 2,
    renderMode: 'beatsPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function getSelectedAudioBeatInfo() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const label = el.dataset.track;
  if (!label || label[0] !== 'A') return null;
  const trackIdx = Number(label.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline.audio[trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return {
    clip: clip,
    beatsCount: Array.isArray(clip.__beats) ? clip.__beats.length : 0,
    hasBeats: Array.isArray(clip.__beats) && clip.__beats.length > 0
  };
}

function getVisualSelectionCount() {
  const multi = document.querySelectorAll('.clip.multi-selected');
  if (multi.length > 0) return multi.length;
  const sel = document.querySelector('.clip.selected');
  if (!sel) return 0;
  const label = sel.dataset.track;
  if (!label || label[0] !== 'V') return 0;
  return 1;
}

function findAnyAudioWithBeats() {
  const appState = window.__appState;
  if (!appState) return null;
  const tracks = appState.timeline.audio || [];
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (clip && Array.isArray(clip.__beats) && clip.__beats.length > 0) {
        return clip;
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'bt-panel';

  panel.appendChild(buildDetectCard());
  panel.appendChild(buildEditCard());
  panel.appendChild(buildHelpCard());

  container.appendChild(panel);
}

// ─── DETECT CARD ────────────────────────────────────────────
function buildDetectCard() {
  const card = document.createElement('div');
  card.className = 'bt-card';

  const title = document.createElement('div');
  title.className = 'bt-card-title';
  title.innerHTML = '<span>🥁 Step 1 — Detect Beats</span>';
  card.appendChild(title);

  // Status
  const audioInfo = getSelectedAudioBeatInfo();
  const status = document.createElement('div');

  if (!audioInfo) {
    status.className = 'bt-status info';
    status.textContent = '👆 Select an audio clip on the timeline first';
  } else if (audioInfo.hasBeats) {
    status.className = 'bt-status ok';
    status.innerHTML =
      '✅ ' + audioInfo.beatsCount + ' beats on "<b>' +
      escapeHtml((audioInfo.clip.name || 'Audio').slice(0, 20)) + '</b>"' +
      '<span class="bt-badge">🥁 ' + audioInfo.beatsCount + '</span>';
  } else {
    status.className = 'bt-status info';
    status.textContent = 'Ready — audio selected, no beats detected yet';
  }
  card.appendChild(status);

  // Range selector
  const rangeLabel = document.createElement('div');
  rangeLabel.className = 'bt-card-title';
  rangeLabel.style.fontSize = '10px';
  rangeLabel.textContent = 'Beat Range Filter';
  card.appendChild(rangeLabel);

  const rangeShelf = document.createElement('div');
  rangeShelf.className = 'bt-range-shelf';

  RANGES.forEach(r => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bt-range-btn';
    if (state.range === r.key) btn.classList.add('active');

    const lbl = document.createElement('span');
    lbl.className = 'bt-range-lbl';
    lbl.textContent = r.label;

    const sub = document.createElement('span');
    sub.className = 'bt-range-sub';
    sub.textContent = r.sub;

    btn.append(lbl, sub);
    btn.addEventListener('click', () => {
      state.range = r.key;
      renderTo(document.querySelector('#feature-shelf'));
    });
    rangeShelf.appendChild(btn);
  });
  card.appendChild(rangeShelf);

  // Buttons
  const row = document.createElement('div');
  row.className = 'bt-row';

  const detectBtn = document.createElement('button');
  detectBtn.type = 'button';
  detectBtn.className = 'bt-btn primary';
  detectBtn.textContent = '🥁 Detect Beats';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'bt-btn danger';
  clearBtn.style.flex = '0 0 auto';
  clearBtn.style.minWidth = '100px';
  clearBtn.textContent = '🗑 Clear';
  clearBtn.disabled = !audioInfo || !audioInfo.hasBeats;
  if (clearBtn.disabled) clearBtn.style.opacity = '0.5';

  detectBtn.addEventListener('click', async () => {
    detectBtn.disabled = true;
    detectBtn.textContent = '⏳ Detecting…';

    try {
      const filterStr = state.range === 'all' ? '' : state.range;
      const res = await runDetectBeats(filterStr);
      if (res.ok) {
        const extra = (res.totalDetected && res.totalDetected !== res.beatsCount)
          ? ' (from ' + res.totalDetected + ')'
          : '';
        state.lastMsg = '🥁 ' + res.beatsCount + ' beats detected' + extra;
        state.lastOk = true;
        showToast('🥁 ' + res.beatsCount + ' beats detected');
      } else {
        state.lastMsg = '❌ ' + (res.error || 'Failed');
        state.lastOk = false;
        showToast(res.error || 'Detection failed', false);
      }
    } catch (e) {
      state.lastMsg = '❌ ' + (e.message || 'Unknown error');
      state.lastOk = false;
    }

    renderTo(document.querySelector('#feature-shelf'));
  });

  clearBtn.addEventListener('click', () => {
    const info = getSelectedAudioBeatInfo();
    if (!info || !info.clip) return;
    delete info.clip.__beats;
    delete info.clip.__beatsDetectedAt;
    delete info.clip.__beatsFilter;
    delete info.clip.__beatsTotalDetected;

    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('beats:changed'));

    state.lastMsg = '🗑 Beats cleared';
    state.lastOk = true;
    showToast('Beats cleared');
    renderTo(document.querySelector('#feature-shelf'));
  });

  row.append(detectBtn, clearBtn);
  card.appendChild(row);

  return card;
}

// ─── EDIT CARD ──────────────────────────────────────────────
function buildEditCard() {
  const card = document.createElement('div');
  card.className = 'bt-card';

  const title = document.createElement('div');
  title.className = 'bt-card-title';
  title.innerHTML = '<span>🎬 Step 2 — Beats Edit</span>';
  card.appendChild(title);

  // Status
  const visCount = getVisualSelectionCount();
  const beats = findAnyAudioWithBeats();
  const status = document.createElement('div');

  if (!beats) {
    status.className = 'bt-status warn';
    status.textContent = '⚠️ No beats detected yet — do Step 1 first';
  } else if (visCount === 0) {
    status.className = 'bt-status info';
    status.textContent = '👆 Select visual clips (tap ⏩ button on timeline)';
  } else {
    status.className = 'bt-status ok';
    status.innerHTML =
      '✅ <b>' + visCount + '</b> clip' + (visCount > 1 ? 's' : '') +
      ' selected · <b>' + beats.__beats.length + '</b> beats available';
  }
  card.appendChild(status);

  // Pattern input
  const patternLabel = document.createElement('div');
  patternLabel.className = 'bt-card-title';
  patternLabel.style.fontSize = '10px';
  patternLabel.textContent = 'Effect Pattern';
  card.appendChild(patternLabel);

  const input = document.createElement('textarea');
  input.className = 'bt-input';
  input.placeholder = 'e.g. shake, zoom, pulse';
  input.rows = 3;
  input.spellcheck = false;
  input.value = state.pattern;
  input.addEventListener('input', () => {
    state.pattern = input.value;
  });
  card.appendChild(input);

  // Presets
  const presetShelf = document.createElement('div');
  presetShelf.className = 'bt-preset-shelf';

  PRESETS.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bt-preset-chip';
    chip.textContent = p.label;
    chip.addEventListener('click', () => {
      state.pattern = p.pattern;
      input.value = p.pattern;
    });
    presetShelf.appendChild(chip);
  });
  card.appendChild(presetShelf);

  // Apply button
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'bt-btn primary';
  applyBtn.textContent = '✨ Apply Beats Edit';

  const canApply = !!beats && visCount > 0;
  applyBtn.disabled = !canApply;
  if (!canApply) applyBtn.style.opacity = '0.5';

  applyBtn.addEventListener('click', async () => {
    const pattern = input.value.trim();
    if (!pattern) {
      showToast('Enter an effect pattern', false);
      return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = '⏳ Applying…';

    try {
      const res = await runBeatsEditing(pattern);
      if (res.ok) {
        state.lastMsg = '✅ ' + res.effectsApplied + ' effects on ' + res.beatsCount + ' beats';
        state.lastOk = true;
        showToast('🥁 ' + res.effectsApplied + ' effects applied');
      } else {
        state.lastMsg = '❌ ' + (res.error || 'Failed');
        state.lastOk = false;
        showToast(res.error || 'Apply failed', false);
      }
    } catch (e) {
      state.lastMsg = '❌ ' + (e.message || 'Unknown error');
      state.lastOk = false;
    }

    renderTo(document.querySelector('#feature-shelf'));
  });

  card.appendChild(applyBtn);

  // Last message
  if (state.lastMsg) {
    const msg = document.createElement('div');
    msg.className = 'bt-status ' + (state.lastOk ? 'ok' : 'err');
    msg.textContent = state.lastMsg;
    card.appendChild(msg);
  }

  return card;
}

// ─── HELP CARD ──────────────────────────────────────────────
function buildHelpCard() {
  const card = document.createElement('div');
  card.className = 'bt-card';

  const title = document.createElement('div');
  title.className = 'bt-card-title';
  title.textContent = '💡 How It Works';
  card.appendChild(title);

  const hint = document.createElement('div');
  hint.className = 'bt-hint';
  hint.innerHTML = `
    <b>Step 1:</b> Select an <b>audio clip</b> on timeline → choose range → tap Detect<br>
    <b>Step 2:</b> Tap ⏩ to select <b>visual clips</b> → enter pattern → Apply<br><br>
    <b>Pattern examples:</b><br>
    • <code>shake, zoom, pulse</code> — simple cycle<br>
    • <code>hard: shake+glow ; rest: zoom, pulse</code> — strength-aware<br>
    • <code>warm, cool, vivid</code> — color only<br><br>
    <b>Symbols:</b><br>
    • <code>,</code> — cycle effects across beats<br>
    • <code>+</code> — stack multiple on same beat<br>
    • <code>;</code> — separate strength sections
  `;
  card.appendChild(hint);

  return card;
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:99999',
    'pointer-events:none','opacity:0',
    'transition:opacity .2s ease, transform .2s ease',
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
  }, 1600);
}