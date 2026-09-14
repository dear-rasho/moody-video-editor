// ================================================================
//  js/workspace/magnetTool.js
//  Magnet tool — compacts ALL clips to the RIGHT of (and including)
//  the selected clip. Gaps between them are closed.
//
//  Example:
//    V1: [A: 0-3] [B: 5-7] [C: 10-12]
//    User selects B, taps magnet.
//    Result: [A: 0-3] [B: 5-7] [C: 7-9]
//
//  First clip's startTime is preserved (B in this case).
//  All clips from B onwards are chained with no gaps.
// ================================================================

const CSS_ID = 'magnet-tool-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    #magnet-btn {
      font-size: 18px;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    #magnet-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    #magnet-btn:active {
      background: rgba(79,157,255,0.2);
    }
  `;
  document.head.appendChild(s);
}

let buttonEl = null;

export function initMagnetTool(btn) {
  injectStyles();
  buttonEl = btn || document.querySelector('#magnet-btn');
  if (!buttonEl) return;

  buttonEl.addEventListener('click', onMagnetClick);

  document.addEventListener('editor:timeline-changed', refreshButtonState);
  document.addEventListener('playback:tick', refreshButtonState);
  refreshButtonState();
}

function refreshButtonState() {
  if (!buttonEl) return;
  const hasSel = !!document.querySelector('.clip.selected');
  buttonEl.disabled = !hasSel;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ACTION
// ═══════════════════════════════════════════════════════════════
function onMagnetClick() {
  const sel = getSelectedClip();
  if (!sel) { showToast('Select a clip first', false); return; }

  const appState = window.__appState;
  if (!appState) return;

  const { group, trackIdx, clip: selClip } = sel;
  const list = appState.timeline[group];
  if (!Array.isArray(list)) return;

  const track = list[trackIdx];
  if (!Array.isArray(track) || track.length < 2) {
    showToast('Need at least 2 clips on this track', false);
    return;
  }

  // ─── Sort track by startTime (mutates in place) ───────────
  track.sort((a, b) => {
    const sa = Number.isFinite(a.startTime) ? a.startTime : 0;
    const sb = Number.isFinite(b.startTime) ? b.startTime : 0;
    return sa - sb;
  });

  // ─── Find selected clip's index after sort ────────────────
  const selIdx = track.indexOf(selClip);
  if (selIdx < 0) {
    showToast('Selected clip not found', false);
    return;
  }

  // ─── If selected clip is the LAST clip, nothing to do ─────
  if (selIdx === track.length - 1) {
    showToast('No clips to the right', false);
    return;
  }

  // ─── Chain clips from selected clip onwards ───────────────
  let prevEnd = (Number.isFinite(selClip.startTime) ? selClip.startTime : 0) +
                (Number.isFinite(selClip.duration) ? selClip.duration : 0);

  let changed = false;
  for (let i = selIdx + 1; i < track.length; i++) {
    const cur = track[i];
    const curStart = Number.isFinite(cur.startTime) ? cur.startTime : 0;
    const curDur = Number.isFinite(cur.duration) ? cur.duration : 0;

    if (Math.abs(curStart - prevEnd) > 0.001) {
      cur.startTime = prevEnd;
      changed = true;
    }
    prevEnd += curDur;
  }

  // Force re-render
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('transition:changed'));

  // ─── Re-select the same clip (index may have changed) ─────
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const newIdx = track.indexOf(selClip);
      if (newIdx < 0) return;
      const label = (group === 'visual' ? 'V' : 'A') + (trackIdx + 1);
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
    });
  });

  if (changed) {
    showToast('Gaps closed from selected clip');
  } else {
    showToast('Already aligned');
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function getSelectedClip() {
  const el = document.querySelector('.clip.selected');
  if (!el) return null;
  const trackLabel = el.dataset.track;
  if (!trackLabel) return null;
  const group = trackLabel.charAt(0) === 'A' ? 'audio' : 'visual';
  const trackIdx = Number(trackLabel.slice(1)) - 1;
  const clipIdx = Number(el.dataset.clip);
  if (!Number.isFinite(trackIdx) || !Number.isFinite(clipIdx)) return null;
  const appState = window.__appState;
  if (!appState) return null;
  const track = appState.timeline[group][trackIdx];
  if (!Array.isArray(track)) return null;
  const clip = track[clipIdx];
  if (!clip) return null;
  return { clip, trackIdx, clipIdx, group, track };
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:8px 16px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
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