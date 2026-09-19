// ================================================================
//  js/workspace/errorNotifier.js
//  Copyable error notifications — for export / playback / prompt.
// ================================================================

const CSS_ID = 'error-notifier-styles';

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .err-box {
      position: fixed;
      bottom: 110px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      width: min(92vw, 480px);
      background: linear-gradient(135deg, #2a0e0e 0%, #1a0808 100%);
      border: 1.5px solid #ff6b6b;
      border-radius: 14px;
      padding: 14px 16px 12px;
      z-index: 100001;
      font-family: inherit;
      color: #fff;
      box-shadow: 0 8px 32px rgba(255, 107, 107, 0.35), 0 4px 16px rgba(0,0,0,0.6);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      max-height: 60vh;
      display: flex;
      flex-direction: column;
    }
    .err-box.err-show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: auto;
    }
    .err-box.err-ok {
      background: linear-gradient(135deg, #0e2a15 0%, #081a0d 100%);
      border-color: #00FF87;
      box-shadow: 0 8px 32px rgba(0, 255, 135, 0.3), 0 4px 16px rgba(0,0,0,0.6);
    }

    .err-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .err-icon { font-size: 18px; flex-shrink: 0; }
    .err-title {
      flex: 1;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #ff8888;
    }
    .err-box.err-ok .err-title { color: #00FF87; }

    .err-close {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(0,0,0,0.3);
      color: #fff;
      cursor: pointer;
      font-size: 15px;
      display: grid;
      place-items: center;
      font-family: inherit;
      flex-shrink: 0;
    }
    .err-close:active { background: rgba(0,0,0,0.5); }

    .err-message {
      font-size: 12px;
      line-height: 1.5;
      color: #ffe5e5;
      margin-bottom: 10px;
      word-break: break-word;
    }
    .err-box.err-ok .err-message { color: #d5ffe5; }

    .err-details {
      display: none;
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 8px 10px;
      font-family: 'Courier New', monospace;
      font-size: 10.5px;
      line-height: 1.45;
      color: #cccccc;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 160px;
      overflow-y: auto;
      margin-bottom: 10px;
      scrollbar-width: thin;
    }
    .err-details.err-expanded { display: block; }
    .err-details::-webkit-scrollbar { width: 5px; }
    .err-details::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
    }

    .err-actions {
      display: flex;
      gap: 8px;
    }
    .err-btn {
      flex: 1;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      letter-spacing: 0.02em;
      transition: all 0.12s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      white-space: nowrap;
    }
    .err-btn:active { background: rgba(255,255,255,0.12); transform: scale(0.97); }
    .err-btn.err-copy {
      background: linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%);
      border-color: #ff8888;
      color: #fff;
    }
    .err-btn.err-copy:active { background: #ff4444; }
    .err-btn.err-copy.copied {
      background: linear-gradient(135deg, #00FF87 0%, #00cc66 100%);
      border-color: #00FF87;
      color: #000;
    }
    .err-btn.err-toggle {
      flex: 0 0 auto;
      min-width: 44px;
      font-size: 16px;
      padding: 8px;
    }

    @media (max-width: 380px) {
      .err-box { width: 94vw; padding: 12px 12px 10px; }
      .err-btn { font-size: 11px; min-height: 38px; }
    }
  `;
  document.head.appendChild(s);
}

let activeBox = null;
let dismissTimer = null;

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Show error
// ═══════════════════════════════════════════════════════════════
export function showError(title, message, details) {
  showNotification({
    title: title || 'Error',
    message: message || '',
    details: details || '',
    ok: false
  });
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — Show success/info
// ═══════════════════════════════════════════════════════════════
export function showInfo(title, message, details) {
  showNotification({
    title: title || 'Info',
    message: message || '',
    details: details || '',
    ok: true
  });
}

// ═══════════════════════════════════════════════════════════════
//  CORE
// ═══════════════════════════════════════════════════════════════
function showNotification(opts) {
  injectStyles();

  // Replace existing
  if (activeBox) {
    activeBox.remove();
    activeBox = null;
  }
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  const hasDetails = !!(opts.details && String(opts.details).trim());

  const box = document.createElement('div');
  box.className = 'err-box' + (opts.ok ? ' err-ok' : '');

  // Header
  const header = document.createElement('div');
  header.className = 'err-header';

  const icon = document.createElement('span');
  icon.className = 'err-icon';
  icon.textContent = opts.ok ? '✅' : '⚠️';

  const title = document.createElement('span');
  title.className = 'err-title';
  title.textContent = opts.title || (opts.ok ? 'OK' : 'Error');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'err-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', dismiss);

  header.append(icon, title, closeBtn);

  // Message
  const msg = document.createElement('div');
  msg.className = 'err-message';
  msg.textContent = opts.message || '';

  // Details (hidden by default)
  let detailsEl = null;
  if (hasDetails) {
    detailsEl = document.createElement('pre');
    detailsEl.className = 'err-details';
    detailsEl.textContent = opts.details;
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'err-actions';

  if (hasDetails) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'err-btn err-toggle';
    toggleBtn.type = 'button';
    toggleBtn.textContent = '▼';
    toggleBtn.title = 'Show details';
    toggleBtn.addEventListener('click', function () {
      const open = detailsEl.classList.toggle('err-expanded');
      toggleBtn.textContent = open ? '▲' : '▼';
      toggleBtn.title = open ? 'Hide details' : 'Show details';
    });
    actions.appendChild(toggleBtn);
  }

  // Copy button — always present (copies everything)
  const copyBtn = document.createElement('button');
  copyBtn.className = 'err-btn err-copy';
  copyBtn.type = 'button';
  copyBtn.textContent = '📋 Copy';
  copyBtn.addEventListener('click', async function () {
    const payload = buildCopyPayload(opts);
    const ok = await copyToClipboard(payload);
    if (ok) {
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✅ Copied!';
      setTimeout(function () {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋 Copy';
      }, 1600);
    }
  });
  actions.appendChild(copyBtn);

  // Assemble
  box.appendChild(header);
  if (opts.message) box.appendChild(msg);
  if (detailsEl) box.appendChild(detailsEl);
  box.appendChild(actions);

  document.body.appendChild(box);
  activeBox = box;

  requestAnimationFrame(function () {
    box.classList.add('err-show');
  });

  // Auto-dismiss: 12s for errors, 4s for info
  const autoMs = opts.ok ? 4000 : 12000;
  dismissTimer = setTimeout(dismiss, autoMs);

  function dismiss() {
    if (!activeBox) return;
    activeBox.classList.remove('err-show');
    const b = activeBox;
    activeBox = null;
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    setTimeout(function () {
      try { b.remove(); } catch (_) {}
    }, 260);
  }
}

// ═══════════════════════════════════════════════════════════════
//  COPY
// ═══════════════════════════════════════════════════════════════
function buildCopyPayload(opts) {
  const lines = [];
  lines.push('=== MOODY EDITOR ERROR ===');
  lines.push('Title:   ' + (opts.title || ''));
  lines.push('Time:    ' + new Date().toISOString());
  lines.push('');

  if (opts.message) {
    lines.push('Message:');
    lines.push(opts.message);
    lines.push('');
  }

  if (opts.details) {
    lines.push('Details:');
    lines.push(String(opts.details));
    lines.push('');
  }

  // Environment info
  try {
    lines.push('Environment:');
    lines.push('  User Agent: ' + (navigator.userAgent || 'n/a'));
    lines.push('  Platform:   ' + (navigator.platform || 'n/a'));
    lines.push('  WebCodecs:  ' + (typeof VideoEncoder !== 'undefined' ? 'yes' : 'no'));
    lines.push('  Viewport:   ' + window.innerWidth + '×' + window.innerHeight);
    const ratio = window.__offlineEditorRatio;
    if (ratio) {
      lines.push('  Ratio:      ' + (ratio.key || '?') + ' (' + ratio.w + ':' + ratio.h + ')');
    }
    const appState = window.__appState;
    if (appState && appState.timeline) {
      const vt = (appState.timeline.visual || []).length;
      const at = (appState.timeline.audio || []).length;
      lines.push('  Visual tracks: ' + vt);
      lines.push('  Audio tracks:  ' + at);
    }
  } catch (_) {}

  lines.push('');
  lines.push('=== END ===');
  return lines.join('\n');
}

async function copyToClipboard(text) {
  // Modern API
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  // Fallback (older browsers / insecure contexts)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}