// ================================================================
//  js/workspace/historyManager.js
//  Snapshot-based undo / redo.
//  NO debounce — pushes on every distinct event.
//  Features that fire slider events during drag (speed) now only
//  fire on release, so this works cleanly.
// ================================================================

const MAX_HISTORY = 100;

let stack = [];
let index = -1;
let isRestoring = false;
let undoBtn = null;
let redoBtn = null;
let timelineRef = null;

function clone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return null; }
}

function snapshot() {
  if (!timelineRef) return null;
  return {
    visual: clone(timelineRef.visual || []),
    audio:  clone(timelineRef.audio  || [])
  };
}

function sameAsCurrent(snap) {
  if (index < 0 || index >= stack.length) return false;
  const cur = stack[index];
  if (!cur || !snap) return false;
  try { return JSON.stringify(cur) === JSON.stringify(snap); } catch (_) { return false; }
}

function updateButtons() {
  const canUndo = index > 0;
  const canRedo = index < stack.length - 1;
  if (undoBtn) {
    undoBtn.classList.toggle('history-disabled', !canUndo);
    undoBtn.setAttribute('aria-disabled', String(!canUndo));
  }
  if (redoBtn) {
    redoBtn.classList.toggle('history-disabled', !canRedo);
    redoBtn.setAttribute('aria-disabled', String(!canRedo));
  }
}

export function pushHistory() {
  if (isRestoring) return;

  const snap = snapshot();
  if (!snap) return;
  if (sameAsCurrent(snap)) return;

  stack = stack.slice(0, index + 1);
  stack.push(snap);
  index = stack.length - 1;

  if (stack.length > MAX_HISTORY) {
    const excess = stack.length - MAX_HISTORY;
    stack.splice(0, excess);
    index -= excess;
  }

  updateButtons();
}

function schedulePush() {
  if (isRestoring) return;
  // Push immediately — no debounce.
  pushHistory();
}

function restore(snap) {
  if (!snap || !timelineRef) return;
  isRestoring = true;

  timelineRef.visual = clone(snap.visual) || [];
  timelineRef.audio  = clone(snap.audio)  || [];

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  updateButtons();

  // Very short guard — just enough to skip the synchronous re-render events
  setTimeout(function () { isRestoring = false; }, 0);
}

export function undo() {
  if (index <= 0) return;
  index--;
  restore(stack[index]);
}

export function redo() {
  if (index >= stack.length - 1) return;
  index++;
  restore(stack[index]);
}

const CSS_ID = 'history-manager-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = '.icon-button.history-disabled{opacity:0.35;pointer-events:none;transition:opacity 0.15s ease;}.icon-button:not(.history-disabled){transition:opacity 0.15s ease;}';
  document.head.appendChild(s);
}

export function initHistory(opts) {
  injectStyles();

  timelineRef = (opts && opts.timeline) || null;
  undoBtn = (opts && opts.undoButton) || null;
  redoBtn = (opts && opts.redoButton) || null;

  stack = [snapshot()];
  index = 0;

  if (undoBtn) {
    undoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      undo();
    });
  }
  if (redoBtn) {
    redoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      redo();
    });
  }

  document.addEventListener('editor:timeline-changed', schedulePush);

  document.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const key = (e.key || '').toLowerCase();

    if (!e.shiftKey && key === 'z') { e.preventDefault(); undo(); }
    else if (e.shiftKey && key === 'z') { e.preventDefault(); redo(); }
    else if (key === 'y') { e.preventDefault(); redo(); }
  });

  updateButtons();
}