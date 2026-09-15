// ================================================================
//  js/features/duplicate.js
//  Duplicates the selected clip into the next layer ABOVE.
//
//  How it works (self-contained, no synthetic events):
//   1. Read selected clip from appState
//   2. Deep-copy it with a fresh ID + unique name
//   3. Push to the NEXT track (auto-create if needed)
//   4. Re-render timeline + auto-select the copy
// ================================================================

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

  const trackLabel = selectedEl.dataset.track || '';
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

  // 2) Get appState
  const appState = window.__appState;
  if (!appState) {
    return { ok: false, message: 'App state missing' };
  }

  const list = group === 'visual'
    ? appState.timeline.visual
    : appState.timeline.audio;
  if (!Array.isArray(list)) {
    return { ok: false, message: 'Invalid timeline' };
  }

  const clipIdx = Number(selectedEl.dataset.clip);
  const clip = list[trackIndex]?.[clipIdx];
  if (!clip) {
    return { ok: false, message: 'Clip not found' };
  }

  // ═══════════════════════════════════════════════════════════
  //  🆕 Deep copy with fresh IDs (no shared references)
  // ═══════════════════════════════════════════════════════════
  let copy;
  try {
    copy = JSON.parse(JSON.stringify(clip));
  } catch (_) {
    copy = Object.assign({}, clip);
  }

  copy.name = (clip.name || 'Layer') + ' copy';

  // Generate unique timestamps
  const now = Date.now();
  const rnd = Math.random().toString(36).slice(2, 7);

  // Remove linked ID so it doesn't auto-mirror with original
  delete copy.__linkedId;

  // Regenerate IDs so filter/effect/text/sticker layers don't conflict
  if (copy.__effectId) {
    copy.__effectId = 'fx-' + now + '-' + rnd;
    copy.url = 'effect://' + copy.__effectId;
  }
  if (copy.__textId) {
    copy.__textId = 'tx-' + now + '-' + rnd;
    copy.url = 'text://' + copy.__textId;
  }
  if (copy.__stickerId) {
    copy.__stickerId = 'sk-' + now + '-' + rnd;
    copy.url = 'sticker://' + copy.__stickerId;
  }
  if (copy.__audioFxId) {
    copy.__audioFxId = 'afx-' + now + '-' + rnd;
    copy.url = 'audiofx://' + copy.__audioFxId;
  }
  if (copy.__soundId) {
    copy.__soundId = 'se-' + now + '-' + rnd;
  }

  // ═══════════════════════════════════════════════════════════
  //  3) Ensure next track exists, then push copy
  // ═══════════════════════════════════════════════════════════
  while (list.length <= nextIndex) list.push([]);

  list[nextIndex].push(copy);

  // Sort target track by startTime
  list[nextIndex].sort((a, b) => {
    const sa = Number.isFinite(a.startTime) ? a.startTime : 0;
    const sb = Number.isFinite(b.startTime) ? b.startTime : 0;
    return sa - sb;
  });

  // 4) Fire timeline change
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));

  // 5) Auto-select the new copy after re-render
  const copyUrl = copy.url;
  setTimeout(() => {
    const appState2 = window.__appState;
    if (!appState2) return;
    const list2 = group === 'visual'
      ? appState2.timeline.visual
      : appState2.timeline.audio;
    const newTrack = list2[nextIndex];
    if (!Array.isArray(newTrack)) return;
    const newIdx = newTrack.indexOf(copy);
    if (newIdx < 0) return;
    const label = (group === 'visual' ? 'V' : 'A') + (nextIndex + 1);
    const el = document.querySelector(
      '.clip[data-track="' + label + '"][data-clip="' + newIdx + '"]'
    );
    if (el) {
      try {
        el.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true, cancelable: true, button: 0
        }));
      } catch (_) {}
    }
  }, 60);

  const finalLabel = (group === 'visual' ? 'V' : 'A') + (nextIndex + 1);
  return { ok: true, message: 'Duplicated to ' + finalLabel };
}