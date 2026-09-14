// ================================================================
//  js/features/trim.js
//  Split / Trim Left / Trim Right with correct independent clips.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';
import { applyTrimToLinked } from '../workspace/clipLink.js';

export const featureKey = 'trim';

(function installTrimRenderer() {
  if (featuresRouter.__trimInstalled) return;
  featuresRouter.__trimInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'trimPanel') {
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

const CSS_ID = 'trim-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .tr-panel{display:flex;flex-direction:column;gap:8px;width:100%;padding:0;box-sizing:border-box;}
    .tr-panel *{box-sizing:border-box;}
    .tr-info{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--muted);}
    .tr-info-row{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .tr-info-row b{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}
    .tr-hint{font-size:10px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;opacity:0.6;padding:0 2px;}
    .tr-shelf{display:flex;gap:8px;width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 2px 10px;scroll-snap-type:x proximity;scrollbar-width:thin;}
    .tr-shelf::-webkit-scrollbar{height:4px;}
    .tr-shelf::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .tr-btn{flex:0 0 150px;width:150px;min-height:118px;padding:14px 12px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:8px;scroll-snap-align:start;}
    .tr-btn:active{background:var(--surface-3);transform:scale(0.97);}
    .tr-btn.danger{border-color:#7f1d1d;}
    .tr-btn-icon{width:40px;height:40px;display:grid;place-items:center;background:var(--surface);border:1px solid var(--border);border-radius:9px;font-size:20px;}
    .tr-btn.danger .tr-btn-icon{border-color:#7f1d1d;background:#2a1414;}
    .tr-btn-body{flex:1;min-width:0;width:100%;display:flex;flex-direction:column;gap:4px;}
    .tr-btn-title{font-size:13px;font-weight:700;color:var(--text);line-height:1.2;}
    .tr-btn-desc{font-size:10.5px;color:var(--muted);line-height:1.35;}
    .tr-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 16px;background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;text-align:center;color:var(--muted);font-size:12px;line-height:1.45;}
    .tr-empty-icon{font-size:26px;opacity:0.55;}
    .tr-empty-title{font-size:13px;font-weight:700;color:var(--text);}
    .tr-empty-text{font-size:11px;color:var(--muted);max-width:280px;}
    .tr-empty.warn{border-color:#7f1d1d;background:#231010;}
    .tr-empty.warn .tr-empty-title{color:#ff9e9e;}
  `;
  document.head.appendChild(s);
}

export function open({ router }) {
  router.openLevel('trim', [], {
    title: 'Trim',
    level: 2,
    renderMode: 'trimPanel'
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
  return { el, group, trackIndex, clipIndex, clip, track };
}

function getPlayheadTime() {
  const eng = window.__playbackEngine;
  if (eng && typeof eng.getTime === 'function') return eng.getTime();
  return 0;
}

function clipRange(clip) {
  const start = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const dur = Number.isFinite(clip.duration) ? clip.duration : 3;
  return { start, end: start + dur, duration: dur };
}

function commit() {
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

function autoSelectFirstClip() {
  if (document.querySelector('.clip.selected')) return true;
  const clips = document.querySelectorAll('.clip');
  if (clips.length) {
    try {
      clips[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      return true;
    } catch (_) {}
  }
  return false;
}

function showToast(message, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.88)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  if (!document.querySelector('.clip.selected')) autoSelectFirstClip();

  const panel = document.createElement('div');
  panel.className = 'tr-panel';

  const sel = getSelectedClip();
  const playhead = getPlayheadTime();

  if (!sel) {
    panel.appendChild(buildEmptyState({
      icon: '👆',
      title: 'No clip selected',
      text: 'Tap a clip on the timeline first.'
    }));
    container.appendChild(panel);
    return;
  }

  const r = clipRange(sel.clip);

  const info = document.createElement('div');
  info.className = 'tr-info';
  const nameRow = document.createElement('div');
  nameRow.className = 'tr-info-row';
  nameRow.innerHTML = 'Clip: <b>' + escapeHtml(sel.clip.name || 'Untitled') + '</b>';
  const timeRow = document.createElement('div');
  timeRow.className = 'tr-info-row';
  timeRow.innerHTML = 'Playhead: <b>' + playhead.toFixed(2) + 's</b>';
  info.append(nameRow, timeRow);
  panel.appendChild(info);

  const insideClip = playhead > r.start && playhead < r.end;
  if (!insideClip) {
    panel.appendChild(buildEmptyState({
      icon: '🎯',
      title: 'Move playhead inside the clip',
      text: 'Playhead at ' + playhead.toFixed(2) + 's but clip spans ' + r.start.toFixed(2) + 's – ' + r.end.toFixed(2) + 's.',
      warn: true
    }));
    container.appendChild(panel);
    return;
  }

  const hint = document.createElement('div');
  hint.className = 'tr-hint';
  hint.textContent = '← Swipe for more options →';
  panel.appendChild(hint);

  const shelf = document.createElement('div');
  shelf.className = 'tr-shelf';

  shelf.appendChild(makeActionCard({
    icon: '✂️', title: 'Split',
    desc: 'Cut clip into two independent clips at playhead',
    onClick: doSplit
  }));

  shelf.appendChild(makeActionCard({
    icon: '⬅️', title: 'Trim Left',
    desc: 'Remove from clip start up to the playhead',
    onClick: doTrimLeft
  }));

  shelf.appendChild(makeActionCard({
    icon: '➡️', title: 'Trim Right',
    desc: 'Remove from playhead to clip end',
    onClick: doTrimRight, danger: true
  }));

  panel.appendChild(shelf);
  container.appendChild(panel);
}

function buildEmptyState(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'tr-empty' + (opts.warn ? ' warn' : '');
  const ic = document.createElement('div');
  ic.className = 'tr-empty-icon';
  ic.textContent = opts.icon;
  const t = document.createElement('div');
  t.className = 'tr-empty-title';
  t.textContent = opts.title;
  const d = document.createElement('div');
  d.className = 'tr-empty-text';
  d.textContent = opts.text;
  wrap.append(ic, t, d);
  return wrap;
}

function makeActionCard(opts) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tr-btn' + (opts.danger ? ' danger' : '');

  const ic = document.createElement('div');
  ic.className = 'tr-btn-icon';
  ic.textContent = opts.icon;

  const body = document.createElement('div');
  body.className = 'tr-btn-body';

  const t = document.createElement('div');
  t.className = 'tr-btn-title';
  t.textContent = opts.title;

  const d = document.createElement('div');
  d.className = 'tr-btn-desc';
  d.textContent = opts.desc;

  body.append(t, d);
  btn.append(ic, body);

  btn.addEventListener('click', function () {
    opts.onClick();
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  });

  return btn;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════
//  SPLIT — create two independent clips
// ═══════════════════════════════════════════════════════════════
function doSplit() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start + 0.01 || playhead >= r.end - 0.01) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  const originalClip = sel.clip;
  const firstDur  = playhead - r.start;
  const secondDur = r.end - playhead;

  const origSourceIn = Number.isFinite(originalClip.sourceIn) ? originalClip.sourceIn : 0;
  const origSourceTotal = Number.isFinite(originalClip.__sourceTotalDuration)
    ? originalClip.__sourceTotalDuration
    : origSourceIn + r.duration;

  // ─── Modify existing clip → left piece ────────────────────
  originalClip.startTime = r.start;
  originalClip.duration = firstDur;
  originalClip.sourceIn = origSourceIn;
  originalClip.__trimmed = true;

  // ─── Create new clip → right piece ────────────────────────
  const secondClip = Object.assign({}, originalClip);
  secondClip.startTime = playhead;
  secondClip.duration = secondDur;
  secondClip.sourceIn = origSourceIn + firstDur;
  secondClip.name = (originalClip.name || 'Clip') + ' (2)';
  secondClip.__trimmed = true;
  secondClip.__sourceTotalDuration = origSourceTotal;

  // Clear shared references (deep-ish copy)
  if (originalClip.__keyframes) {
    secondClip.__keyframes = JSON.parse(JSON.stringify(originalClip.__keyframes));
    // Remove keyframes outside right piece; rebase times
    for (const prop of Object.keys(secondClip.__keyframes)) {
      secondClip.__keyframes[prop] = (secondClip.__keyframes[prop] || [])
        .filter(k => k.time >= playhead)
        .map(k => ({ time: k.time, value: k.value, ease: k.ease }));
    }
  }
  if (originalClip.__transform) {
    secondClip.__transform = JSON.parse(JSON.stringify(originalClip.__transform));
  }
  if (originalClip.__transitionIn) {
    secondClip.__transitionIn = JSON.parse(JSON.stringify(originalClip.__transitionIn));
  }

  // Remove left-piece-only keyframes
  if (originalClip.__keyframes) {
    for (const prop of Object.keys(originalClip.__keyframes)) {
      originalClip.__keyframes[prop] = (originalClip.__keyframes[prop] || [])
        .filter(k => k.time < playhead);
    }
  }
  // Remove transition from left piece (transition was on the "in" of original)
  delete originalClip.__transitionIn;

  // ─── Insert into same track, right after original ────────
  sel.track.splice(sel.clipIndex + 1, 0, secondClip);

  // ─── Propagate to linked audio clips ──────────────────────
  splitLinked(originalClip, playhead, secondClip);

  commit();
  showToast('Split at ' + playhead.toFixed(2) + 's');
}

// 🆕 Split linked clips (audio) at the same point
function splitLinked(originalClip, playhead, secondVisual) {
  if (!originalClip.__linkedId) return;
  const linkedId = originalClip.__linkedId;
  const allTracks = [].concat(
    appState.timeline.visual || [],
    appState.timeline.audio || []
  );

  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const other = track[c];
      if (other === originalClip) continue;
      if (!other || other.__linkedId !== linkedId) continue;

      const oRange = clipRange(other);
      if (playhead <= oRange.start + 0.01 || playhead >= oRange.end - 0.01) continue;

      const firstDur = playhead - oRange.start;
      const secondDur = oRange.end - playhead;
      const oSourceIn = Number.isFinite(other.sourceIn) ? other.sourceIn : 0;

      // Left = keep original
      other.startTime = oRange.start;
      other.duration = firstDur;
      other.sourceIn = oSourceIn;
      other.__trimmed = true;

      // Right = copy
      const otherSecond = Object.assign({}, other);
      otherSecond.startTime = playhead;
      otherSecond.duration = secondDur;
      otherSecond.sourceIn = oSourceIn + firstDur;
      otherSecond.name = (other.name || 'Audio') + ' (2)';
      otherSecond.__trimmed = true;

      track.splice(c + 1, 0, otherSecond);
      break;
    }
  }
}

function doTrimLeft() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start + 0.01 || playhead >= r.end - 0.01) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  const cutAmount = playhead - r.start;
  sel.clip.startTime = playhead;
  sel.clip.duration  = r.end - playhead;
  sel.clip.sourceIn  = (Number.isFinite(sel.clip.sourceIn) ? sel.clip.sourceIn : 0) + cutAmount;
  sel.clip.__trimmed = true;

  applyTrimToLinked(sel.clip, {
    startTime: sel.clip.startTime,
    duration:  sel.clip.duration,
    sourceIn:  sel.clip.sourceIn
  });

  commit();
  showToast('Trimmed left');
}

function doTrimRight() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start + 0.01 || playhead >= r.end - 0.01) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  sel.clip.startTime = r.start;
  sel.clip.duration  = playhead - r.start;
  sel.clip.__trimmed = true;

  applyTrimToLinked(sel.clip, {
    startTime: sel.clip.startTime,
    duration:  sel.clip.duration,
    sourceIn:  sel.clip.sourceIn
  });

  commit();
  showToast('Trimmed right');
}