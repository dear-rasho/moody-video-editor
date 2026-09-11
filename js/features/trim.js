// ================================================================
//  js/features/trim.js
//  Split + Trim Left + Trim Right (replaces 'delete').
//  REQUIRES a clip to be selected in the timeline first.
//  Options are shown in a HORIZONTALLY SCROLLABLE shelf.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import { appState } from '../app.js';

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

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'trim-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = [
    /* ─── Panel shell ─── */
    '.tr-panel{',
    '  display:flex;',
    '  flex-direction:column;',
    '  gap:8px;',
    '  width:100%;',
    '  max-width:100%;',
    '  min-width:0;',
    '  padding:0;',
    '  margin:0;',
    '  box-sizing:border-box;',
    '}',
    '.tr-panel *{box-sizing:border-box;}',

    /* ─── Info bar ─── */
    '.tr-info{',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:space-between;',
    '  flex-wrap:wrap;',
    '  gap:6px 12px;',
    '  padding:8px 12px;',
    '  background:var(--surface-2);',
    '  border:1px solid var(--border);',
    '  border-radius:8px;',
    '  font-size:11px;',
    '  color:var(--muted);',
    '  letter-spacing:0.02em;',
    '  flex:0 0 auto;',
    '}',
    '.tr-info-row{',
    '  display:flex;',
    '  align-items:center;',
    '  gap:6px;',
    '  min-width:0;',
    '  white-space:nowrap;',
    '  overflow:hidden;',
    '  text-overflow:ellipsis;',
    '}',
    '.tr-info-row b{',
    '  color:var(--text);',
    '  font-weight:700;',
    '  font-variant-numeric:tabular-nums;',
    '  overflow:hidden;',
    '  text-overflow:ellipsis;',
    '  white-space:nowrap;',
    '  max-width:140px;',
    '}',

    /* ─── Swipe hint ─── */
    '.tr-hint{',
    '  font-size:10px;',
    '  color:var(--muted);',
    '  letter-spacing:0.06em;',
    '  text-transform:uppercase;',
    '  opacity:0.6;',
    '  padding:0 2px;',
    '  flex:0 0 auto;',
    '}',

    /* ─── Horizontal scrollable shelf ─── */
    '.tr-shelf{',
    '  display:flex;',
    '  flex-direction:row;',
    '  gap:8px;',
    '  width:100%;',
    '  min-width:0;',
    '  overflow-x:auto;',
    '  overflow-y:hidden;',
    '  padding:2px 2px 10px;',
    '  scroll-snap-type:x proximity;',
    '  -webkit-overflow-scrolling:touch;',
    '  overscroll-behavior-x:contain;',
    '  scrollbar-width:thin;',
    '  flex:0 0 auto;',
    '}',
    '.tr-shelf::-webkit-scrollbar{height:4px;}',
    '.tr-shelf::-webkit-scrollbar-thumb{',
    '  background:var(--border);',
    '  border-radius:3px;',
    '}',

    /* ─── Action card ─── */
    '.tr-btn{',
    '  flex:0 0 150px;',
    '  width:150px;',
    '  min-height:118px;',
    '  padding:14px 12px;',
    '  background:var(--surface-2);',
    '  color:var(--text);',
    '  border:1px solid var(--border);',
    '  border-radius:10px;',
    '  cursor:pointer;',
    '  font-family:inherit;',
    '  text-align:left;',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:flex-start;',
    '  gap:8px;',
    '  scroll-snap-align:start;',
    '  transition:background 0.12s ease, border-color 0.12s ease, transform 0.08s ease;',
    '  -webkit-tap-highlight-color:transparent;',
    '}',
    '.tr-btn:active{background:var(--surface-3);transform:scale(0.97);}',
    '.tr-btn.danger{border-color:#7f1d1d;}',
    '.tr-btn.danger:active{background:#3b1d1d;}',

    '.tr-btn-icon{',
    '  flex:0 0 auto;',
    '  width:40px;',
    '  height:40px;',
    '  display:grid;',
    '  place-items:center;',
    '  background:var(--surface);',
    '  border:1px solid var(--border);',
    '  border-radius:9px;',
    '  font-size:20px;',
    '  line-height:1;',
    '}',
    '.tr-btn.danger .tr-btn-icon{',
    '  border-color:#7f1d1d;',
    '  background:#2a1414;',
    '}',

    '.tr-btn-body{',
    '  flex:1;',
    '  min-width:0;',
    '  width:100%;',
    '  display:flex;',
    '  flex-direction:column;',
    '  gap:4px;',
    '  justify-content:flex-start;',
    '}',
    '.tr-btn-title{',
    '  font-size:13px;',
    '  font-weight:700;',
    '  color:var(--text);',
    '  line-height:1.2;',
    '}',
    '.tr-btn-desc{',
    '  font-size:10.5px;',
    '  color:var(--muted);',
    '  line-height:1.35;',
    '  letter-spacing:0.01em;',
    '}',

    /* ─── Empty / warning state ─── */
    '.tr-empty{',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:center;',
    '  justify-content:center;',
    '  gap:6px;',
    '  padding:20px 16px;',
    '  background:var(--surface-2);',
    '  border:1px dashed var(--border);',
    '  border-radius:10px;',
    '  text-align:center;',
    '  color:var(--muted);',
    '  font-size:12px;',
    '  line-height:1.45;',
    '  flex:0 0 auto;',
    '}',
    '.tr-empty-icon{',
    '  font-size:26px;',
    '  opacity:0.55;',
    '  line-height:1;',
    '}',
    '.tr-empty-title{',
    '  font-size:13px;',
    '  font-weight:700;',
    '  color:var(--text);',
    '}',
    '.tr-empty-text{',
    '  font-size:11px;',
    '  color:var(--muted);',
    '  max-width:280px;',
    '}',
    '.tr-empty.warn{',
    '  border-color:#7f1d1d;',
    '  background:#231010;',
    '}',
    '.tr-empty.warn .tr-empty-title{',
    '  color:#ff9e9e;',
    '}',

    /* ─── Small screens ─── */
    '@media (max-width:380px){',
    '  .tr-btn{flex:0 0 130px;width:130px;min-height:110px;padding:12px 10px;}',
    '  .tr-btn-icon{width:34px;height:34px;font-size:16px;}',
    '  .tr-btn-title{font-size:12px;}',
    '  .tr-btn-desc{font-size:10px;}',
    '  .tr-info-row b{max-width:100px;}',
    '}'
  ].join('\n');
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  Router entry
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('trim', [], {
    title: 'Trim',
    level: 2,
    renderMode: 'trimPanel'
  });
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
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
  const v = document.querySelector('#preview-video');
  return v && Number.isFinite(v.currentTime) ? v.currentTime : 0;
}

function clipRange(clip) {
  const start = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const dur = Number.isFinite(clip.duration) ? clip.duration : 3;
  return { start, end: start + dur, duration: dur };
}

function commit() {
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
}

// ═══════════════════════════════════════════════════════════════
//  Toast
// ═══════════════════════════════════════════════════════════════
function showToast(message, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed',
    'bottom:110px',
    'left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'background:' + (ok ? 'rgba(0,0,0,0.88)' : 'rgba(180,40,40,0.92)'),
    'color:#fff',
    'padding:10px 20px',
    'border-radius:22px',
    'font-size:13px',
    'font-weight:600',
    'z-index:9999',
    'pointer-events:none',
    'opacity:0',
    'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit',
    'max-width:80vw',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis'
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

// ═══════════════════════════════════════════════════════════════
//  Render
// ═══════════════════════════════════════════════════════════════
export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'tr-panel';

  const sel = getSelectedClip();
  const playhead = getPlayheadTime();

  // ─── No clip selected ───
  if (!sel) {
    panel.appendChild(buildEmptyState({
      icon: '👆',
      title: 'No clip selected',
      text: 'Tap a clip on the timeline first, then come back here to trim.'
    }));
    container.appendChild(panel);
    return;
  }

  const r = clipRange(sel.clip);

  // ─── Info bar ───
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

  // ─── Playhead outside clip ───
  const insideClip = playhead > r.start && playhead < r.end;
  if (!insideClip) {
    panel.appendChild(buildEmptyState({
      icon: '🎯',
      title: 'Move playhead inside the clip',
      text: 'Playhead is at ' + playhead.toFixed(2) + 's but the clip spans ' +
            r.start.toFixed(2) + 's – ' + r.end.toFixed(2) + 's.',
      warn: true
    }));
    container.appendChild(panel);
    return;
  }

  // ─── Swipe hint ───
  const hint = document.createElement('div');
  hint.className = 'tr-hint';
  hint.textContent = '← Swipe for more options →';
  panel.appendChild(hint);

  // ─── Horizontal scrollable shelf with 3 cards ───
  const shelf = document.createElement('div');
  shelf.className = 'tr-shelf';

  shelf.appendChild(makeActionCard({
    icon: '✂️',
    title: 'Split',
    desc: 'Cut clip into two at the playhead position',
    onClick: doSplit
  }));

  shelf.appendChild(makeActionCard({
    icon: '⬅️',
    title: 'Trim Left',
    desc: 'Remove from clip start up to the playhead',
    onClick: doTrimLeft
  }));

  shelf.appendChild(makeActionCard({
    icon: '➡️',
    title: 'Trim Right',
    desc: 'Remove from the playhead to the clip end',
    onClick: doTrimRight,
    danger: true
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════
//  Operations
// ═══════════════════════════════════════════════════════════════
function doSplit() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start || playhead >= r.end) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  const firstDur  = playhead - r.start;
  const secondDur = r.end - playhead;

  sel.clip.startTime = r.start;
  sel.clip.duration  = firstDur;

  const second = Object.assign({}, sel.clip, {
    startTime: playhead,
    duration: secondDur,
    name: (sel.clip.name || 'Clip') + ' (split)'
  });
  sel.track.splice(sel.clipIndex + 1, 0, second);

  commit();
  showToast('Split at ' + playhead.toFixed(2) + 's');
}

function doTrimLeft() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start || playhead >= r.end) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  sel.clip.startTime = playhead;
  sel.clip.duration  = r.end - playhead;

  commit();
  showToast('Trimmed left');
}

function doTrimRight() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const playhead = getPlayheadTime();
  const r = clipRange(sel.clip);

  if (playhead <= r.start || playhead >= r.end) {
    showToast('Playhead must be inside the clip', false);
    return;
  }

  sel.clip.startTime = r.start;
  sel.clip.duration  = playhead - r.start;

  commit();
  showToast('Trimmed right');
}