// ================================================================
//  js/workspace/playbackControls.js
//  Play / pause / delete.
//  🆕 Delete button is SMART:
//     - Transition selected → delete transition
//     - Keyframe selected   → delete keyframe
//     - Otherwise           → delete selected layer
// ================================================================

import { removeAllKeyframesAtTime } from './keyframeStore.js';

export function initPlaybackControls({ play, undo, redo, deleteButton, engine }) {
  if (!play) return;

  const updateButton = () => {
    const isPlaying = engine && engine.isPlaying ? engine.isPlaying() : false;
    play.textContent = isPlaying ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  };

  play.addEventListener('click', (e) => {
    e.preventDefault();
    if (!engine) return;
    if (engine.isPlaying()) engine.pause();
    else engine.play();
    updateButton();
  });

  document.addEventListener('playback:state', updateButton);

  if (deleteButton) {
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      handleSmartDelete();
    });
  }

  updateButton();
}

// ═══════════════════════════════════════════════════════════════
//  🆕 SMART DELETE — transition > keyframe > layer
// ═══════════════════════════════════════════════════════════════
function handleSmartDelete() {
  // Priority 1: Transition selected?
  const trUI = window.__transitionUI;
  const selTr = (trUI && typeof trUI.getSelectedTransition === 'function')
    ? trUI.getSelectedTransition()
    : null;

  if (selTr) {
    const trType = (selTr.__transitionIn && selTr.__transitionIn.key) || 'transition';
    if (typeof trUI.deleteSelectedTransition === 'function') {
      const ok = trUI.deleteSelectedTransition();
      if (ok) {
        showToast('⇄ Transition "' + trType + '" removed');
        return;
      }
    }
  }

  // Priority 2: Keyframe selected?
  const kfUI = window.__keyframeUI;
  const selKf = (kfUI && typeof kfUI.getSelectedKeyframe === 'function')
    ? kfUI.getSelectedKeyframe()
    : null;

  if (selKf && selKf.clip) {
    const { clip, time } = selKf;

    try {
      removeAllKeyframesAtTime(clip, time);
    } catch (err) {
      console.warn('[delete] keyframe removal failed', err);
    }

    if (typeof kfUI.clearKeyframeSelection === 'function') {
      try { kfUI.clearKeyframeSelection(); } catch (_) {}
    }

    document.dispatchEvent(new CustomEvent('keyframe:changed'));
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
    document.dispatchEvent(new CustomEvent('transform:changed'));

    showToast('◆ Keyframe removed at ' + (time || 0).toFixed(2) + 's');
    return;
  }

  // Priority 3: Delete selected layer
  document.dispatchEvent(new CustomEvent('editor:delete-selected'));
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg) {
  if (!msg) return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:99999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0','transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 1400);
}