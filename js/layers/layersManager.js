// ================================================================
//  js/layers/layersManager.js
//  Layer helpers, CSS injection, V+ / A+ buttons.
// ================================================================

export const DEFAULT_VISUAL_LAYERS = 3;
export const DEFAULT_AUDIO_LAYERS  = 3;

const CSS_ID = 'layers-manager-styles';

export function injectLayerStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = [
    '#media-file-input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;left:-9999px!important;}',
    '.track-content{position:relative!important;display:block!important;padding:0!important;min-width:0!important;overflow:hidden!important;}',
    '.clip.clip-absolute{position:absolute!important;top:5px;height:calc(100% - 10px);min-width:20px;box-sizing:border-box;z-index:1;}',
    '.clip[data-clip-type^="video/"]{background:#1e40af!important;border-color:#3b82f6!important;color:#fff!important;}',
    '.clip[data-clip-type^="image/"]{background:#ca8a04!important;border-color:#facc15!important;color:#111!important;}',
    '.clip[data-clip-type^="text/"]{background:#be185d!important;border-color:#ec4899!important;color:#fff!important;}',
    '.clip[data-clip-type^="audio/"]{background:#065f46!important;border-color:#10b981!important;color:#fff!important;}',
    '.clip[data-clip-type^="sticker/"]{background:#6d28d9!important;border-color:#a855f7!important;color:#fff!important;}',
    '.clip[data-clip-type="effect/plain"]{background:#4c1d95!important;border-color:#a78bfa!important;color:#fff!important;}',
    '.quick-layer-buttons{display:flex;gap:6px;flex-shrink:0;}',
    '.quick-layer-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:52px;min-height:40px;padding:0 12px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;letter-spacing:.06em;cursor:pointer;font-family:inherit;flex-shrink:0;}',
    '.quick-layer-btn:active{background:var(--surface-3);}',
    '.quick-layer-btn .ql-plus{color:var(--accent);font-size:15px;line-height:1;margin-right:2px;}'
  ].join('\n');
  document.head.appendChild(s);
}

// ─── Time helpers ──────────────────────────────────────────────
export function clipRange(clip) {
  const start = Number.isFinite(clip && clip.startTime) ? clip.startTime : 0;
  const dur   = Number.isFinite(clip && clip.duration)  ? clip.duration  : 3;
  return { start, end: start + dur, duration: dur };
}

function rangesOverlap(aS, aE, bS, bE) {
  return aS < bE && bS < aE;
}

export function trackHasOverlap(track, start, end, excludeClip) {
  if (!Array.isArray(track)) return false;
  for (let i = 0; i < track.length; i++) {
    const clip = track[i];
    if (clip === excludeClip) continue;
    const r = clipRange(clip);
    if (rangesOverlap(start, end, r.start, r.end)) return true;
  }
  return false;
}

export function findFreeLayerIndex(list, start, end, excludeClip) {
  if (!Array.isArray(list)) return 0;
  for (let i = 0; i < list.length; i++) {
    if (!trackHasOverlap(list[i], start, end, excludeClip)) return i;
  }
  return -1;
}

// ─── State ops ─────────────────────────────────────────────────
export function placeClipAtTime(list, clip, startTime) {
  if (!Array.isArray(list)) return { layerIndex: -1, isNewLayer: false };

  const dur   = Number.isFinite(clip && clip.duration) ? clip.duration : 3;
  const start = Math.max(0, Number.isFinite(startTime) ? startTime : 0);
  const end   = start + dur;

  let idx = findFreeLayerIndex(list, start, end);
  let isNewLayer = false;

  if (idx === -1) {
    idx = list.length;
    isNewLayer = true;
  }
  while (list.length <= idx) list.push([]);

  const newClip = Object.assign({}, clip, { startTime: start, duration: dur });
  list[idx].push(newClip);
  return { layerIndex: idx, isNewLayer: isNewLayer };
}

export function insertEmptyLayer(list, atIndex) {
  if (!Array.isArray(list)) return -1;
  const idx = Math.max(0, Math.min(atIndex == null ? list.length : atIndex, list.length));
  list.splice(idx, 0, []);
  return idx;
}

export function ensureMinLayers(list, min) {
  if (!Array.isArray(list)) return;
  while (list.length < min) list.push([]);
}

// ─── V+ / A+ buttons ───────────────────────────────────────────
export function createQuickLayerButtons(opts) {
  injectLayerStyles();

  const wrap = document.createElement('div');
  wrap.className = 'quick-layer-buttons';

  const vBtn = document.createElement('button');
  vBtn.type = 'button';
  vBtn.className = 'quick-layer-btn';
  vBtn.innerHTML = '<span class="ql-plus">+</span><span>V</span>';
  vBtn.setAttribute('aria-label', 'Add new video layer');
  vBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (opts && opts.onAddVisual) opts.onAddVisual();
  });

  const aBtn = document.createElement('button');
  aBtn.type = 'button';
  aBtn.className = 'quick-layer-btn';
  aBtn.innerHTML = '<span class="ql-plus">+</span><span>A</span>';
  aBtn.setAttribute('aria-label', 'Add new audio layer');
  aBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (opts && opts.onAddAudio) opts.onAddAudio();
  });

  wrap.appendChild(vBtn);
  wrap.appendChild(aBtn);
  return wrap;
}

export function injectQuickLayerButtons(container, opts) {
  if (!container) return null;

  const old = container.querySelectorAll('.quick-layer-buttons');
  for (let i = 0; i < old.length; i++) old[i].remove();

  const buttons = createQuickLayerButtons(opts);

  const mediaBtn = container.querySelector('#media-picker-btn');
  if (mediaBtn && mediaBtn.parentElement === container) {
    mediaBtn.insertAdjacentElement('afterend', buttons);
  } else {
    container.appendChild(buttons);
  }
  return buttons;
}