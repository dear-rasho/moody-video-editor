// ================================================================
//  js/features/delete.js
//  Deletes the currently selected timeline clip.
//
//  How it works (fully self-contained):
//   1. Look for .clip.selected in the timeline DOM
//   2. Ensure timelineEngine's internal `selected` var is synced
//      (important on touch devices — mousedown may not have fired)
//   3. Dispatch the SAME event that the timeline's delete button
//      already fires (`editor:delete-selected`).
//      timelineEngine's listener then:
//        - removes the clip from appState.timeline
//        - calls onDeleteSelected() (in app.js) for media cleanup
//        - re-renders the timeline
//   4. Show a toast with the deleted clip's name.
// ================================================================

export const featureKey = 'delete';

// ─── Toast feedback (same style as duplicate.js) ───────────────
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
    z-index: 9999;
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

// ─── Router entry ──────────────────────────────────────────────
export function open({ router }) {
  const selectedEl = document.querySelector('.clip.selected');

  if (!selectedEl) {
    showToast('Select a clip first', false);
    return;
  }

  const clipName = (selectedEl.textContent || 'Clip')
    .replace(/\s+/g, ' ')
    .trim();

  // Make sure timelineEngine's internal `selected` variable points
  // to this clip (needed on touch where mousedown may not have run).
  // The mousedown handler is idempotent — safe to dispatch again.
  try {
    selectedEl.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0
    }));
  } catch (_) {
    // Ignore — fallback to whatever `selected` currently is
  }

  // Fire the same event the timeline's delete button uses.
  // timelineEngine handles state removal + re-render; app.js's
  // onDeleteSelected callback cleans up the media library.
  document.dispatchEvent(new CustomEvent('editor:delete-selected'));

  // Confirm to the user
  showToast(`Deleted "${clipName}"`);
}