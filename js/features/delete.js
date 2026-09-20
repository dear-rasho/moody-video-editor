// ================================================================
//  js/features/delete.js
//  Delete feature (from feature shelf).
//  🆕 Smart priority:
//     1. Transition selected → delete transition
//     2. Keyframe selected   → delete keyframe
//     3. Otherwise           → delete selected layer
// ================================================================

import { removeAllKeyframesAtTime } from '../workspace/keyframeStore.js';

export const featureKey = 'delete';
export const featureLabel = 'Delete';
export const featureIcon = '🗑️';

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(message, ok = true) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `
    position: fixed;
    bottom: 110px;
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    background: ${ok ? 'rgba(0,0,0,0.88)' : 'rgba(180,40,40,0.92)'};
    color: #fff;
    padding: 10px 20px;
    border-radius: 22px;
    font-size: 13px;
    font-weight: 600;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: inherit;
    max-width: 80vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, 1500);
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER ENTRY
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  // 🆕 Priority 1: Transition selected?
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

  // 🆕 Priority 2: Keyframe selected?
  const kfUI = window.__keyframeUI;
  const selKf = (kfUI && typeof kfUI.getSelectedKeyframe === 'function')
    ? kfUI.getSelectedKeyframe()
    : null;

  if (selKf && selKf.clip) {
    const { clip, time } = selKf;

    try {
      removeAllKeyframesAtTime(clip, time);
    } catch (err) {
      console.warn('[delete feature] keyframe removal failed', err);
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

  // ─── Priority 3: Delete selected layer ────────────────────
  const selectedEl = document.querySelector('.clip.selected');

  if (!selectedEl) {
    showToast('Select a clip, keyframe, or transition first', false);
    return;
  }

  const clipName = (selectedEl.textContent || 'Clip')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    selectedEl.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0
    }));
  } catch (_) {}

  document.dispatchEvent(new CustomEvent('editor:delete-selected'));

  showToast(`Deleted "${clipName}"`);
}