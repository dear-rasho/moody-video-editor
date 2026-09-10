// ================================================================
//  js/features/duplicate.js
//  Duplicates the selected timeline clip into the next layer above.
//
//  How it works (all self-contained):
//   1. Read selected clip info from the DOM (.clip.selected)
//   2. Read clip data from appState.timeline
//   3. Push a copy to the SOURCE track (state only, DOM not updated)
//   4. Fire a synthetic "drop" event on the TARGET track element.
//      timelineEngine's existing drop handler moves the copy from
//      source → target AND calls render(), so DOM updates correctly.
// ================================================================

import { appState } from '../app.js';

export const featureKey = 'duplicate';

// ─── Toast feedback ────────────────────────────────────────────
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
  const result = duplicateSelected();
  showToast(result.message, result.ok);
}

// ─── Core ──────────────────────────────────────────────────────
function duplicateSelected() {
  // 1) Find the selected clip in the DOM
  const selectedEl = document.querySelector('.clip.selected');
  if (!selectedEl) {
    return { ok: false, message: 'Select a clip first' };
  }

  const trackLabel = selectedEl.dataset.track || ''; // e.g. "V1", "A2"
  if (!trackLabel) {
    return { ok: false, message: 'Invalid selection' };
  }

  const group = trackLabel[0] === 'A' ? 'audio' : 'visual';
  const trackNum = Number(trackLabel.slice(1));
  const trackIndex = trackNum - 1;
  const nextIndex = trackIndex + 1;

  if (!Number.isFinite(trackNum) || trackIndex < 0) {
    return { ok: false, message: 'Invalid track' };
  }

  if (nextIndex > 3) {
    return { ok: false, message: `No layer above ${trackLabel}` };
  }

  // 2) Read clip data from appState
  const list = group === 'visual'
    ? appState.timeline.visual
    : appState.timeline.audio;

  const clipIdx = Number(selectedEl.dataset.clip);
  const clip = list[trackIndex]?.[clipIdx];

  if (!clip) {
    return { ok: false, message: 'Clip not found' };
  }

  // Ensure both tracks exist in state
  if (!Array.isArray(list[trackIndex])) list[trackIndex] = [];
  if (!Array.isArray(list[nextIndex])) list[nextIndex] = [];

  // 3) Find the target track element
  const targetTrackEl = document.querySelector(
    `.track[data-group="${group}"][data-track-index="${nextIndex}"]`
  );

  if (!targetTrackEl) {
    return { ok: false, message: 'Timeline not ready' };
  }

  // 4) Push copy to SOURCE track (temporary home for the new clip)
  const copy = { ...clip, name: (clip.name || 'Layer') + ' copy' };
  list[trackIndex].push(copy);
  const tempCopyIndex = list[trackIndex].length - 1;

  // 5) Fire a synthetic drop that tells timelineEngine to move this
  //    clip from SOURCE track → TARGET track (and re-render).
  const moved = dispatchSyntheticDrop(
    targetTrackEl,
    `clip:${group}:${trackIndex}:${tempCopyIndex}`
  );

  if (!moved) {
    // Rollback
    list[trackIndex].pop();
    return { ok: false, message: 'Could not duplicate' };
  }

  // 6) Highlight the new clip (visual feedback)
  highlightLastClip(group, nextIndex);

  const label = (group === 'visual' ? 'V' : 'A') + (nextIndex + 1);
  return { ok: true, message: `Duplicated to ${label}` };
}

// ─── Synthetic drop event ──────────────────────────────────────
// We dispatch a plain "drop" Event with a fake dataTransfer object
// whose getData() returns the string timelineEngine's drop handler
// expects. This avoids needing any changes in timelineEngine.js.
function dispatchSyntheticDrop(targetEl, dataString) {
  const dropEvent = new Event('drop', { bubbles: true, cancelable: true });

  const fakeDataTransfer = {
    getData: (type) => (type === 'text/plain' ? dataString : ''),
    setData: () => {},
    clearData: () => {},
    types: ['text/plain'],
    files: [],
    items: [],
    dropEffect: 'none',
    effectAllowed: 'all'
  };

  try {
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: fakeDataTransfer,
      writable: false,
      configurable: true
    });
  } catch (_) {
    return false;
  }

  targetEl.dispatchEvent(dropEvent);
  return true;
}

// ─── Highlight the newest clip in the target track ─────────────
function highlightLastClip(group, targetIndex) {
  const trackEl = document.querySelector(
    `.track[data-group="${group}"][data-track-index="${targetIndex}"]`
  );
  if (!trackEl) return;
  const clips = trackEl.querySelectorAll('.clip');
  if (!clips.length) return;

  document.querySelectorAll('.clip.selected')
    .forEach(el => el.classList.remove('selected'));

  const last = clips[clips.length - 1];
  last.classList.add('selected');
}