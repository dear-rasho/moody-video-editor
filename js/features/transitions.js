// ================================================================
//  js/features/transitions.js
//  Transitions panel — applies transition to selected clip's START.
//  Requires an adjacent preceding clip on the same track.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { TRANSITIONS, getTransition } from '../workspace/transitionEngine.js';

export const featureKey = 'transitions';
export const featureLabel = 'Transitions';
export const featureIcon = '⇄';

const ADJACENCY_TOLERANCE = 0.5; // seconds

const CSS_ID = 'transitions-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tr-panel{display:flex;flex-direction:column;gap:10px;width:100%;padding:10px 8px 14px;box-sizing:border-box;}
    .tr-panel *{box-sizing:border-box;}
    .tr-warn{padding:10px 12px;background:rgba(255,107,107,0.12);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);font-weight:700;line-height:1.4;}
    .tr-info{padding:8px 12px;background:rgba(79,157,255,0.15);border:1px solid #4f9dff;border-radius:8px;font-size:11px;color:#7ab5ff;font-weight:700;letter-spacing:.02em;}
    .tr-hint{font-size:10px;color:var(--muted);padding:0 4px;line-height:1.4;letter-spacing:.02em;opacity:.75;}
    .tr-shelf{display:flex;gap:8px;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin;touch-action:pan-x;}
    .tr-shelf::-webkit-scrollbar{height:5px;}
    .tr-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .tr-card{flex:0 0 96px;width:96px;min-height:96px;padding:10px 6px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;scroll-snap-align:start;transition:all 0.12s ease;-webkit-tap-highlight-color:transparent;font-family:inherit;}
    .tr-card:active{background:var(--surface-3);}
    .tr-card.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);}
    .tr-card-icon{width:42px;height:42px;border-radius:50%;border:1px solid var(--border);display:grid;place-items:center;font-size:20px;background:var(--surface);}
    .tr-card.active .tr-card-icon{background:var(--accent);color:#000;border-color:var(--accent);}
    .tr-card-label{font-size:11px;font-weight:600;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}
    .tr-duration{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;}
    .tr-duration-head{display:flex;align-items:center;justify-content:space-between;}
    .tr-duration-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
    .tr-duration-value{font-size:14px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;}
    .tr-duration-slider{width:100%;accent-color:var(--accent);height:5px;cursor:pointer;}
    .tr-remove{padding:10px 16px;min-height:44px;background:var(--surface);color:var(--danger);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;}
    @media (max-width:380px){
      .tr-card{flex:0 0 84px;width:84px;min-height:88px;}
      .tr-card-icon{width:36px;height:36px;font-size:17px;}
      .tr-card-label{font-size:10px;}
    }
  `;
  document.head.appendChild(s);
}

(function installTransitionsRenderer() {
  if (featuresRouter.__transitionsInstalled) return;
  featuresRouter.__transitionsInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'transitionsPanel') {
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

export function open({ router }) {
  if (!document.querySelector('.clip.selected')) {
    autoSelectFirstVisualClip();
  }
  router.openLevel('transitions', [], {
    title: 'Transitions',
    level: 2,
    renderMode: 'transitionsPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'tr-panel';

  const sel = findSelectedVisualClip();

  if (!sel) {
    const warn = document.createElement('div');
    warn.className = 'tr-warn';
    warn.textContent = '⚠️ Select a clip first';
    panel.appendChild(warn);
    container.appendChild(panel);
    return;
  }

  // ─── Check for preceding adjacent clip ────────────────────
  const adjResult = findPrecedingAdjacentClip(sel.clip, sel.trackIdx);

  if (!adjResult.found) {
    const warn = document.createElement('div');
    warn.className = 'tr-warn';
    warn.innerHTML =
      '⚠️ <b>No adjacent clip before this one.</b><br><br>' +
      'Select a clip that has another clip ending right before it. ' +
      'Use the <b>🧲 magnet</b> tool to close gaps — but make sure you ' +
      'select the <b>right-side clip</b> (not the first clip).';

    const hint = document.createElement('div');
    hint.className = 'tr-hint';
    hint.textContent = 'Debug: ' + adjResult.reason;

    panel.append(warn, hint);
    container.appendChild(panel);
    return;
  }

  // ─── Info bar ────────────────────────────────────────────
  const info = document.createElement('div');
  info.className = 'tr-info';
  const cur = sel.clip.__transitionIn;
  if (cur && cur.key && cur.key !== 'none') {
    const def = getTransition(cur.key);
    info.textContent = '⇄ ' + (def ? def.label : cur.key) +
      '  •  ' + (Number(cur.duration) || 0.5).toFixed(2) + 's';
  } else {
    info.textContent = 'Ready — clip has adjacent clip before it';
  }
  panel.appendChild(info);

  // ─── Transition shelf ────────────────────────────────────
  const shelf = document.createElement('div');
  shelf.className = 'tr-shelf';

  const currentKey = sel.clip.__transitionIn ? sel.clip.__transitionIn.key : 'none';

  TRANSITIONS.forEach(tr => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tr-card';
    if (currentKey === tr.key) card.classList.add('active');

    const ic = document.createElement('span');
    ic.className = 'tr-card-icon';
    ic.textContent = tr.icon;

    const lb = document.createElement('span');
    lb.className = 'tr-card-label';
    lb.textContent = tr.label;

    card.append(ic, lb);
    card.addEventListener('click', () => {
      applyTransition(sel.clip, tr.key);
      renderTo(container);
    });

    shelf.appendChild(card);
  });

  panel.appendChild(shelf);

  // ─── Duration + remove ───────────────────────────────────
  if (cur && cur.key && cur.key !== 'none') {
    const dur = Number(cur.duration) || 0.5;

    const box = document.createElement('div');
    box.className = 'tr-duration';

    const head = document.createElement('div');
    head.className = 'tr-duration-head';

    const lbl = document.createElement('span');
    lbl.className = 'tr-duration-label';
    lbl.textContent = 'Duration';

    const val = document.createElement('span');
    val.className = 'tr-duration-value';
    val.textContent = dur.toFixed(2) + 's';

    head.append(lbl, val);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'tr-duration-slider';
    slider.min = '0.1';
    slider.max = '3';
    slider.step = '0.05';
    slider.value = String(dur);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      val.textContent = v.toFixed(2) + 's';
      sel.clip.__transitionIn.duration = v;
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('transition:changed'));
    });

    box.append(head, slider);
    panel.appendChild(box);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tr-remove';
    removeBtn.textContent = '🗑 Remove Transition';
    removeBtn.addEventListener('click', () => {
      delete sel.clip.__transitionIn;
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('transition:changed'));
      renderTo(container);
    });
    panel.appendChild(removeBtn);
  }

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  ADJACENCY DETECTION
// ═══════════════════════════════════════════════════════════════
function findPrecedingAdjacentClip(clip, trackIdx) {
  const appState = window.__appState;
  if (!appState) return { found: false, reason: 'no app state' };

  const track = appState.timeline.visual[trackIdx];
  if (!Array.isArray(track)) return { found: false, reason: 'no track' };

  const startTime = Number.isFinite(clip.startTime) ? clip.startTime : 0;

  // Nothing can precede a clip that starts at 0
  if (startTime <= 0.01) {
    return { found: false, reason: 'clip starts at 0 (no room for preceding clip)' };
  }

  let closestEnd = -1;
  let closestDiff = Infinity;
  let closestName = '';

  for (const other of track) {
    if (other === clip) continue;
    const oStart = Number.isFinite(other.startTime) ? other.startTime : 0;
    const oDur = Number.isFinite(other.duration) ? other.duration : 0;
    const oEnd = oStart + oDur;

    const diff = Math.abs(oEnd - startTime);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestEnd = oEnd;
      closestName = other.name || '?';
    }
  }

  console.log('[transition] adjacency:', {
    clipStart: startTime,
    closestClipEnd: closestEnd,
    closestName,
    diff: closestDiff,
    tolerance: ADJACENCY_TOLERANCE,
    trackClips: track.map(c => ({
      name: c.name,
      start: c.startTime,
      end: (c.startTime || 0) + (c.duration || 0)
    }))
  });

  if (closestDiff <= ADJACENCY_TOLERANCE) {
    return { found: true, reason: 'adjacent to "' + closestName + '" (diff=' + closestDiff.toFixed(3) + 's)' };
  }

  return {
    found: false,
    reason: 'nearest clip ends ' + closestDiff.toFixed(3) + 's away (tolerance ' + ADJACENCY_TOLERANCE + 's)'
  };
}

// ═══════════════════════════════════════════════════════════════
//  APPLY / REMOVE
// ═══════════════════════════════════════════════════════════════
function applyTransition(clip, key) {
  if (key === 'none') {
    delete clip.__transitionIn;
  } else {
    const prev = clip.__transitionIn || {};
    clip.__transitionIn = {
      key: key,
      duration: Number.isFinite(prev.duration) ? prev.duration : 0.5
    };
  }
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transition:changed'));
}

// ═══════════════════════════════════════════════════════════════
//  SELECTION
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