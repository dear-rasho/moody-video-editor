// ================================================================
//  js/workspace/previewHud.js
//  Overlay HUD: elapsed time / aspect ratio / TOTAL TIME.
//  Total time now reflects the TIMELINE duration (post-trim),
//  not the video file's source duration.
// ================================================================

const HUD_CSS_ID = 'preview-hud-styles';

function injectStyles() {
  if (document.getElementById(HUD_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = HUD_CSS_ID;
  s.textContent = `
    .preview-hud {
      position: absolute;
      left: 8px; right: 8px; bottom: 8px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
      pointer-events: none;
      z-index: 30;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      user-select: none;
      -webkit-user-select: none;
    }
    .preview-hud-right { display: flex; align-items: center; gap: 6px; }
    .preview-hud-chip {
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      font-size: 11px; font-weight: 700;
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
      font-size: 10px; padding: 4px 8px;
      opacity: 0.85; letter-spacing: 0.08em;
    }
    @media (max-width: 380px) {
      .preview-hud-chip { font-size: 10px; padding: 3px 8px; }
      .preview-hud-ratio { font-size: 9px; padding: 3px 6px; }
    }
  `;
  document.head.appendChild(s);
}

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

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

function aspectRatioLabel(w, h) {
  if (!w || !h) return '—';
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
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

export function initPreviewHud({ wrap, video }) {
  if (!wrap || !video) {
    return { refresh() {}, destroy() {} };
  }

  injectStyles();

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

  // 🆕 Prefer playbackEngine's timeline duration over raw video.duration
  function getTimelineDuration() {
    const eng = window.__playbackEngine;
    if (eng && typeof eng.getDuration === 'function') {
      const d = eng.getDuration();
      if (Number.isFinite(d) && d > 0) return d;
    }
    // Fallback: video element's duration (only when no timeline)
    return Number.isFinite(video.duration) ? video.duration : 0;
  }

  function getCurrentTime() {
    const eng = window.__playbackEngine;
    if (eng && typeof eng.getTime === 'function') {
      const t = eng.getTime();
      if (Number.isFinite(t)) return t;
    }
    return Number.isFinite(video.currentTime) ? video.currentTime : 0;
  }

  function refresh() {
    elapsed.textContent = formatHMS(getCurrentTime());
    total.textContent = formatHMS(getTimelineDuration());
    ratio.textContent = aspectRatioLabel(video.videoWidth, video.videoHeight);
  }

  // Listen to engine ticks (fires 60x/sec during playback + on seek)
  document.addEventListener('playback:tick', refresh);

  // Fallback: video events (for when engine is idle)
  const events = [
    'timeupdate','loadedmetadata','durationchange',
    'seeking','seeked','play','pause','ended','emptied'
  ];
  events.forEach(ev => video.addEventListener(ev, refresh));

  // Timeline changes → refresh (trim changes total duration)
  document.addEventListener('editor:timeline-changed', refresh);

  refresh();

  return {
    refresh,
    destroy() {
      document.removeEventListener('playback:tick', refresh);
      document.removeEventListener('editor:timeline-changed', refresh);
      events.forEach(ev => video.removeEventListener(ev, refresh));
      hud.remove();
    }
  };
}