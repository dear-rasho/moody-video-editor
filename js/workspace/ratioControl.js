// ================================================================
//  js/workspace/ratioControl.js
//  Ratio dropdown in control bar.
//  Updates preview wrapper size AND window.__offlineEditorRatio.
// ================================================================

const STORAGE_KEY = 'offline-editor-ratio-v2';

const RATIOS = {
  original: { w: 0, h: 0 },
  '16:9':   { w: 16, h: 9  },
  '9:16':   { w: 9,  h: 16 },
  '1:1':    { w: 1,  h: 1  },
  '4:5':    { w: 4,  h: 5  },
  '3:4':    { w: 3,  h: 4  },
  '21:9':   { w: 21, h: 9  }
};

let currentKey = 'original';
let observer = null;
let initialized = false;

export function initRatioControl(selectEl) {
  if (initialized) return;
  if (!selectEl) {
    selectEl = document.querySelector('#ratio-select');
    if (!selectEl) return;
  }
  initialized = true;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && RATIOS[saved]) currentKey = saved;
  } catch (_) {}
  selectEl.value = currentKey;

  selectEl.addEventListener('change', () => {
    currentKey = selectEl.value;
    try { localStorage.setItem(STORAGE_KEY, currentKey); } catch (_) {}

    updateGlobal();
    applyRatio();

    document.dispatchEvent(new CustomEvent('ratio:changed', {
      detail: window.__offlineEditorRatio || { key: currentKey, w: 0, h: 0 }
    }));
  });

  const monitor = document.querySelector('.monitor-window');
  if (monitor && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => applyRatio());
    observer.observe(monitor);
  }

  const video = document.querySelector('#preview-video');
  if (video) {
    video.addEventListener('loadedmetadata', () => {
      updateGlobal();
      if (currentKey === 'original') applyRatio();
    });
  }

  setTimeout(() => {
    updateGlobal();
    applyRatio();
  }, 50);

  window.__getEditorRatio = () => {
    const r = RATIOS[currentKey];
    if (r.w && r.h) return { key: currentKey, w: r.w, h: r.h };
    const v = document.querySelector('#preview-video');
    const vw = v && v.videoWidth ? v.videoWidth : 16;
    const vh = v && v.videoHeight ? v.videoHeight : 9;
    return { key: 'original', w: vw, h: vh };
  };
}

function updateGlobal() {
  window.__offlineEditorRatio = window.__getEditorRatio();
}

function applyRatio() {
  const monitor = document.querySelector('.monitor-window');
  const wrap = document.querySelector('#preview-canvas-wrap');
  if (!monitor || !wrap) return;

  const monRect = monitor.getBoundingClientRect();
  const availW = Math.max(40, monRect.width - 20);
  const availH = Math.max(40, monRect.height - 8);

  const def = RATIOS[currentKey];
  let targetAR;
  if (def.w && def.h) {
    targetAR = def.w / def.h;
  } else {
    const v = document.querySelector('#preview-video');
    const vw = v && v.videoWidth ? v.videoWidth : 16;
    const vh = v && v.videoHeight ? v.videoHeight : 9;
    targetAR = vw / vh;
  }
  if (!Number.isFinite(targetAR) || targetAR <= 0) targetAR = 16 / 9;

  const availAR = availW / availH;
  let w, h;
  if (targetAR > availAR) {
    w = availW;
    h = availW / targetAR;
  } else {
    h = availH;
    w = availH * targetAR;
  }

  wrap.style.width = Math.round(w) + 'px';
  wrap.style.height = Math.round(h) + 'px';
  wrap.style.maxWidth = availW + 'px';
  wrap.style.maxHeight = availH + 'px';

  document.dispatchEvent(new CustomEvent('ratio:changed', {
    detail: window.__offlineEditorRatio || { key: currentKey, w: def.w, h: def.h }
  }));
}