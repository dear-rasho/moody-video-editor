// ================================================================
//  js/features/transitions.js
//  Transitions panel — smart targeting:
//   • Clip selected → transition between it and NEXT clip
//   • No selection  → use playhead position (nearest edge)
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { TRANSITIONS, getTransition } from '../workspace/transitionEngine.js';

export const featureKey = 'transitions';
export const featureLabel = 'Transitions';
export const featureIcon = '⇄';

const ADJACENCY_TOLERANCE = 0.5;

const CSS_ID = 'transitions-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tr-panel{display:flex;flex-direction:column;gap:10px;width:100%;padding:10px 8px 14px;box-sizing:border-box;}
    .tr-panel *{box-sizing:border-box;}
    .tr-warn{padding:10px 12px;background:rgba(255,107,107,0.12);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);font-weight:700;line-height:1.4;}
    .tr-info{padding:8px 12px;background:rgba(79,157,255,0.15);border:1px solid #4f9dff;border-radius:8px;font-size:11px;color:#7ab5ff;font-weight:700;letter-spacing:.02em;line-height:1.4;}
    .tr-info b{color:#fff;}
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
  router.openLevel('transitions', [], {
    title: 'Transitions',
    level: 2,
    renderMode: 'transitionsPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  SMART TARGET RESOLVER
//  Returns { leftClip, rightClip, trackIdx } or { error }
// ═══════════════════════════════════════════════════════════════
function resolveTransitionTarget() {
  const appState = window.__appState;
  if (!appState) return { error: 'App state missing' };

  // ─── Case 1: Clip selected → left clip of pair ────────────
  const sel = findSelectedVisualClip();
  if (sel) {
    const track = appState.timeline.visual[sel.trackIdx];
    if (!Array.isArray(track)) return { error: 'Track missing' };

    const sorted = track.slice().sort(function (a, b) {
      return (a.startTime || 0) - (b.startTime || 0);
    });
    const selIdx = sorted.indexOf(sel.clip);
    if (selIdx < 0) return { error: 'Selected clip not found' };
    if (selIdx >= sorted.length - 1) {
      return { error: 'No clip after this one (last clip selected)' };
    }

    const leftClip = sel.clip;
    const rightClip = sorted[selIdx + 1];
    const leftEnd = (leftClip.startTime || 0) + (leftClip.duration || 0);
    const rightStart = rightClip.startTime || 0;

    if (Math.abs(leftEnd - rightStart) > ADJACENCY_TOLERANCE) {
      return {
        error: 'Selected clip and next clip are not adjacent (' +
               Math.abs(leftEnd - rightStart).toFixed(2) + 's gap). Close gaps with magnet 🧲 first.'
      };
    }

    return { leftClip: leftClip, rightClip: rightClip, trackIdx: sel.trackIdx };
  }

  // ─── Case 2: No selection → use playhead ──────────────────
  const eng = window.__playbackEngine;
  const playhead = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  const vTracks = appState.timeline.visual || [];

  for (let t = 0; t < vTracks.length; t++) {
    const track = vTracks[t];
    if (!Array.isArray(track) || !track.length) continue;

    const sorted = track.slice().sort(function (a, b) {
      return (a.startTime || 0) - (b.startTime || 0);
    });

    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i];
      const s = clip.startTime || 0;
      const d = clip.duration || 0;
      const e = s + d;

      if (playhead < s || playhead >= e) continue;

      // Playhead is inside this clip
      const distToStart = playhead - s;
      const distToEnd = e - playhead;

      if (distToEnd <= distToStart) {
        // Closer to END → this clip is LEFT, next is RIGHT
        if (i >= sorted.length - 1) {
          return { error: 'No clip after playhead position (last clip)' };
        }
        const leftClip = clip;
        const rightClip = sorted[i + 1];
        const leftEnd = s + d;
        const rightStart = rightClip.startTime || 0;
        if (Math.abs(leftEnd - rightStart) > ADJACENCY_TOLERANCE) {
          return { error: 'Clips at playhead are not adjacent' };
        }
        return { leftClip: leftClip, rightClip: rightClip, trackIdx: t };
      } else {
        // Closer to START → previous is LEFT, this is RIGHT
        if (i === 0) {
          return { error: 'No clip before playhead position (first clip)' };
        }
        const leftClip = sorted[i - 1];
        const rightClip = clip;
        const leftEnd = (leftClip.startTime || 0) + (leftClip.duration || 0);
        const rightStart = s;
        if (Math.abs(leftEnd - rightStart) > ADJACENCY_TOLERANCE) {
          return { error: 'Clips at playhead are not adjacent' };
        }
        return { leftClip: leftClip, rightClip: rightClip, trackIdx: t };
      }
    }
  }

  return { error: 'No clip at playhead position' };
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'tr-panel';

  const target = resolveTransitionTarget();

  if (target.error) {
    const warn = document.createElement('div');
    warn.className = 'tr-warn';
    warn.innerHTML = '⚠️ <b>' + target.error + '</b><br><br>' +
      'Select a clip to apply transition AFTER it, OR position playhead inside a clip.';
    panel.appendChild(warn);

    const hint = document.createElement('div');
    hint.className = 'tr-hint';
    hint.textContent = 'Rules: • Selected clip → transition with next clip • No selection → playhead edge decides';
    panel.appendChild(hint);
    container.appendChild(panel);
    return;
  }

  const leftClip = target.leftClip;
  const rightClip = target.rightClip;

  // ─── Info bar ────────────────────────────────────────────
  const info = document.createElement('div');
  info.className = 'tr-info';
  const cur = rightClip.__transitionIn;

  const leftName = (leftClip.name || 'clip').slice(0, 15);
  const rightName = (rightClip.name || 'clip').slice(0, 15);

  if (cur && cur.key && cur.key !== 'none') {
    const def = getTransition(cur.key);
    info.innerHTML =
      '⇄ <b>' + (def ? def.label : cur.key) + '</b> · ' +
      (Number(cur.duration) || 0.5).toFixed(2) + 's<br>' +
      'Between: <b>' + leftName + '</b> → <b>' + rightName + '</b>';
  } else {
    info.innerHTML =
      'Ready<br>Between: <b>' + leftName + '</b> → <b>' + rightName + '</b>';
  }
  panel.appendChild(info);

  // ─── Transition shelf ────────────────────────────────────
  const shelf = document.createElement('div');
  shelf.className = 'tr-shelf';

  const currentKey = rightClip.__transitionIn ? rightClip.__transitionIn.key : 'none';

  TRANSITIONS.forEach(function (tr) {
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
    card.addEventListener('click', function () {
      applyTransition(rightClip, tr.key);
      renderTo(container);
    });

    shelf.appendChild(card);
  });

  panel.appendChild(shelf);

  // ─── Duration + Remove ───────────────────────────────────
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

    slider.addEventListener('input', function () {
      const v = parseFloat(slider.value);
      val.textContent = v.toFixed(2) + 's';
      rightClip.__transitionIn.duration = v;
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('transition:changed'));
    });

    box.append(head, slider);
    panel.appendChild(box);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tr-remove';
    removeBtn.textContent = '🗑 Remove Transition';
    removeBtn.addEventListener('click', function () {
      delete rightClip.__transitionIn;
      document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
      document.dispatchEvent(new CustomEvent('transition:changed'));
      renderTo(container);
    });
    panel.appendChild(removeBtn);
  }

  // ─── Rules hint ──────────────────────────────────────────
  const hint = document.createElement('div');
  hint.className = 'tr-hint';
  hint.textContent = 'Transition stored on right clip (' + rightName + ')';
  panel.appendChild(hint);

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  APPLY / REMOVE
// ═══════════════════════════════════════════════════════════════
function applyTransition(rightClip, key) {
  if (!rightClip) return;
  if (key === 'none') {
    delete rightClip.__transitionIn;
  } else {
    const prev = rightClip.__transitionIn || {};
    rightClip.__transitionIn = {
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
  return { clip: clip, trackIdx: trackIdx, clipIdx: clipIdx, trackLabel: trackLabel, el: el };
}