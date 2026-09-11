// ================================================================
//  js/workspace/previewHud.js
//  Small overlay HUD on the preview monitor showing:
//    • Elapsed playback time (HH:MM:SS)     — left side
//    • Video aspect ratio (e.g. 9:16)       — right side
//    • Total video duration (HH:MM:SS)      — right side
//
//  Self-contained: injects its own CSS, listens to the <video>
//  element directly, no external dependencies.
// ================================================================

const HUD_CSS_ID = 'preview-hud-styles';

function injectStyles() {
  if (document.getElementById(HUD_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = HUD_CSS_ID;
  s.textContent = `
    .preview-hud {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      pointer-events: none;
      z-index: 30;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      user-select: none;
      -webkit-user-select: none;
    }
    .preview-hud-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .preview-hud-chip {
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 10px;
      letter-spacing: 0.05em;
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      line-height: 1;
    }
    .preview-hud-ratio {
      font-size: 10px;
      padding: 4px 8px;
      opacity: 0.85;
      letter-spacing: 0.08em;
    }
    @media (max-width: 380px) {
      .preview-hud-chip { font-size: 10px; padding: 3px 8px; }
      .preview-hud-ratio { font-size: 9px; padding: 3px 6px; }
    }
  `;
  document.head.appendChild(s);
}

// ─── HH:MM:SS formatter ────────────────────────────────────────
function formatHMS(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0')
  );
}

// ─── Aspect-ratio helper ───────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

function aspectRatioLabel(w, h) {
  if (!w || !h) return '—';

  // Match a common ratio within 2% tolerance first
  const target = w / h;
  const COMMON = [
    { w: 16, h: 9  }, { w: 9,  h: 16 },
    { w: 4,  h: 3  }, { w: 3,  h: 4  },
    { w: 1,  h: 1  },
    { w: 21, h: 9  }, { w: 9,  h: 21 },
    { w: 4,  h: 5  }, { w: 5,  h: 4  }
  ];
  for (const r of COMMON) {
    const ar = r.w / r.h;
    if (Math.abs(ar - target) / ar < 0.02) return `${r.w}:${r.h}`;
  }

  // Fallback: reduce by GCD
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

// ─── Public API ────────────────────────────────────────────────
export function initPreviewHud({ wrap, video }) {
  if (!wrap || !video) {
    return { refresh() {}, destroy() {} };
  }

  injectStyles();

  // Build DOM
  const hud = document.createElement('div');
  hud.className = 'preview-hud';

  const elapsed = document.createElement('div');
  elapsed.className = 'preview-hud-chip preview-hud-elapsed';
  elapsed.textContent = '00:00:00';

  const right = document.createElement('div');
  right.className = 'preview-hud-right';

  const ratio = document.createElement('div');
  ratio.className = 'preview-hud-chip preview-hud-ratio';
  ratio.textContent = '—';

  const total = document.createElement('div');
  total.className = 'preview-hud-chip preview-hud-total';
  total.textContent = '00:00:00';

  right.append(ratio, total);
  hud.append(elapsed, right);
  wrap.appendChild(hud);

  // ─── Update routine ───
  function refresh() {
    elapsed.textContent = formatHMS(video.currentTime);
    total.textContent = formatHMS(
      Number.isFinite(video.duration) ? video.duration : 0
    );
    ratio.textContent = aspectRatioLabel(video.videoWidth, video.videoHeight);
  }

  const events = [
    'timeupdate',
    'loadedmetadata',
    'durationchange',
    'seeking',
    'seeked',
    'play',
    'pause',
    'ended',
    'emptied'
  ];
  events.forEach(ev => video.addEventListener(ev, refresh));

  // Initial paint
  refresh();

  return {
    refresh,
    destroy() {
      events.forEach(ev => video.removeEventListener(ev, refresh));
      hud.remove();
    }
  };
}