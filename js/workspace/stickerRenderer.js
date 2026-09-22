// ================================================================
//  js/workspace/stickerRenderer.js
//  Renders DOM overlays for ALL sticker clips on timeline.
//  Works with Code Base prompts + Stickers panel + beats edit.
//  Live keyframe-aware + effect-aware (motion, filter).
//  Respects track visibility toggle.
// ================================================================

const CSS_ID = 'sticker-renderer-styles';
const BASE_FONT_SIZE = 96;

const overlays = new Map(); // stickerId -> { el, clip }

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .sk-overlay.sk-overlay-timeline {
      position: absolute !important;
      z-index: 200 !important;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      line-height: 1;
      transform-origin: 50% 50%;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      font-family: "Apple Color Emoji", "Segoe UI Emoji",
                   "Noto Color Emoji", "EmojiOne Color", sans-serif !important;
      will-change: transform, filter;
    }
  `;
  document.head.appendChild(s);
}

function ensureWrap() {
  return document.querySelector('#preview-canvas-wrap');
}

function isStickerPanelActive() {
  return !!document.querySelector('#feature-shelf .sk-panel');
}

// ═══════════════════════════════════════════════════════════════
//  🆕 EFFECTS — collect active effect clips above a given track
// ═══════════════════════════════════════════════════════════════
function getEffectsAboveTrack(time, trackIndex, tracks, hidden) {
  const result = [];
  for (let t = trackIndex + 1; t < tracks.length; t++) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__effectId) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time >= s && time < s + d) {
        result.push(clip);
        break;
      }
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CSS MOTION BUILDER (matches effectRenderer computeMotion)
// ═══════════════════════════════════════════════════════════════
function buildMotionCSS(m, time) {
  if (!m || !m.type) return '';
  const speed = m.speed || 1;
  const I = (m.intensity != null ? m.intensity : 100) / 100;
  const t = time * speed;
  switch (m.type) {
    case 'shake': {
      const dx = Math.sin(t * 37) * 6 * I;
      const dy = Math.cos(t * 41) * 6 * I;
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
    }
    case 'bounce': {
      const s = 1 + Math.abs(Math.sin(t * 4)) * 0.12 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'pulse': {
      const s = 1 + Math.sin(t * 3) * 0.08 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'zoomPulse': {
      const s = 1 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.35 * I;
      return 'scale(' + s.toFixed(3) + ')';
    }
    case 'rotate': {
      const a = Math.sin(t * 2) * 6 * I;
      return 'rotate(' + a.toFixed(2) + 'deg)';
    }
    case 'glitch': {
      const dx = (Math.random() - 0.5) * 14 * I;
      const dy = (Math.random() - 0.5) * 8 * I;
      const s = 1 + (Math.random() - 0.5) * 0.03 * I;
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + s.toFixed(3) + ')';
    }
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CSS FILTER BUILDER (from filter/effect preset layers)
// ═══════════════════════════════════════════════════════════════
function buildFilterCSSFromLayers(effectClips) {
  const parts = [];
  for (let i = 0; i < effectClips.length; i++) {
    const st = effectClips[i].effectState;
    if (!st) continue;

    // Filter/effect preset filters
    if (st.filters) {
      const f = st.filters;
      if (f.brightness != null && f.brightness !== 100) parts.push('brightness(' + f.brightness + '%)');
      if (f.contrast != null && f.contrast !== 100) parts.push('contrast(' + f.contrast + '%)');
      if (f.saturation != null && f.saturation !== 100) parts.push('saturate(' + f.saturation + '%)');
      if (f.hue) parts.push('hue-rotate(' + f.hue + 'deg)');
      if (f.grayscale) parts.push('grayscale(' + f.grayscale + '%)');
      if (f.sepia) parts.push('sepia(' + f.sepia + '%)');
      if (f.invert) parts.push('invert(' + f.invert + '%)');
      if (f.blur) parts.push('blur(' + f.blur + 'px)');
      if (f.opacity != null && f.opacity !== 100) parts.push('opacity(' + f.opacity + '%)');
    }

    // Adjustment layers — approximate with CSS
    if (st.kind === 'adjustment' && st.adjustments) {
      const a = st.adjustments;
      if (a.brightness) parts.push('brightness(' + (100 + a.brightness) + '%)');
      if (a.contrast)   parts.push('contrast(' + (100 + a.contrast) + '%)');
      if (a.saturation) parts.push('saturate(' + (100 + a.saturation) + '%)');
      if (a.temperature) parts.push('sepia(' + Math.max(0, Math.min(100, a.temperature * 0.5)) + '%)');
      if (a.blur) parts.push('blur(' + a.blur + 'px)');
    }
  }
  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════
function renderTimelineStickers(time) {
  const appState = window.__appState;
  if (!appState) return;

  const wrap = ensureWrap();
  if (!wrap) return;

  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();
  const seen = new Set();

  // Panel-active sticker should be skipped (panel handles its own overlay)
  const panelOpen = isStickerPanelActive();
  const panelActiveId = panelOpen ? (window.__stickersActiveId || null) : null;

  for (let t = 0; t < tracks.length; t++) {
    // 🆕 RESPECT VISIBILITY TOGGLE
    if (hidden.has(t)) continue;

    const track = tracks[t];
    if (!Array.isArray(track)) continue;

    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.__stickerId) continue;

      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (time < s || time >= s + d) continue;

      const id = clip.__stickerId;

      // Skip if sticker panel is rendering this exact sticker
      if (panelActiveId && panelActiveId === id) continue;

      seen.add(id);

      // 🆕 Gather effects above this sticker's track
      const effectsAbove = getEffectsAboveTrack(time, t, tracks, hidden);

      // 🆕 Build motion + filter CSS
      let motionCSS = '';
      for (let k = 0; k < effectsAbove.length; k++) {
        const st = effectsAbove[k].effectState;
        if (st && st.motion) {
          const m = buildMotionCSS(st.motion, time);
          if (m) motionCSS = motionCSS ? motionCSS + ' ' + m : m;
        }
      }
      const filterCSS = buildFilterCSSFromLayers(effectsAbove);

      // Get / create overlay
      let entry = overlays.get(id);
      if (!entry || !document.body.contains(entry.el) || !wrap.contains(entry.el)) {
        const el = document.createElement('div');
        el.className = 'sk-overlay sk-overlay-timeline';
        el.dataset.stickerId = id;
        wrap.appendChild(el);
        entry = { el, clip };
        overlays.set(id, entry);
      }
      entry.clip = clip;

      const ss = clip.stickerState || {};
      let x = ss.x != null ? ss.x : 50;
      let y = ss.y != null ? ss.y : 50;
      let scale = ss.scale != null ? ss.scale : 100;
      let rot = ss.rotation || 0;

      // Live keyframe sampling
      const ks = window.__keyframeStore;
      if (ks && typeof ks.hasAnyKeyframes === 'function' && ks.hasAnyKeyframes(clip)) {
        try {
          const sampled = ks.sampleAll(clip, time, { x: x, y: y, scale: scale, rotation: rot });
          x = sampled.x;
          y = sampled.y;
          scale = sampled.scale;
          rot = sampled.rotation;
        } catch (_) {}
      }

      const emoji = ss.emoji || clip.name || '';
      entry.el.textContent = emoji;
      entry.el.style.fontSize = BASE_FONT_SIZE + 'px';
      entry.el.style.left = x + '%';
      entry.el.style.top = y + '%';

      const baseTransform = 'translate(-50%, -50%) scale(' + (scale / 100) + ') rotate(' + rot + 'deg)';
      const finalTransform = motionCSS ? baseTransform + ' ' + motionCSS : baseTransform;
      entry.el.style.transform = finalTransform;
      entry.el.style.filter = filterCSS || 'none';
      entry.el.style.zIndex = String(150 + t);
    }
  }

  // Cleanup orphan overlays
  overlays.forEach(function (entry, id) {
    if (!seen.has(id)) {
      try { entry.el.remove(); } catch (_) {}
      overlays.delete(id);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-INSTALL
// ═══════════════════════════════════════════════════════════════
(function autoInstallStickerRenderer() {
  if (typeof document === 'undefined') return;

  const install = function () {
    injectStyles();

    const rerender = function () {
      const eng = window.__playbackEngine;
      const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
      renderTimelineStickers(t);
    };

    document.addEventListener('playback:tick', function (e) {
      const t = (e.detail && e.detail.time) || 0;
      renderTimelineStickers(t);
    });

    document.addEventListener('editor:timeline-changed', rerender);
    document.addEventListener('transform:changed', rerender);
    document.addEventListener('keyframe:changed', rerender);
    document.addEventListener('effects:refresh', rerender);  // 🆕 visibility toggle
    document.addEventListener('ratio:changed', rerender);
    document.addEventListener('beats:changed', rerender);

    // Extra safety: periodic re-check for panel close/open
    setInterval(function () {
      // Only if overlay count doesn't match expected — cheap check
      rerender();
    }, 800);

    requestAnimationFrame(rerender);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();

export function forceRenderStickers() {
  const eng = window.__playbackEngine;
  const t = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;
  renderTimelineStickers(t);
}

// 🆕 Expose globally so app.js can call it from visibility handler
window.__forceRenderStickers = forceRenderStickers;