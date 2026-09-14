// ================================================================
//  js/workspace/transitionEngine.js
//  Transition helpers + canvas blend renderer.
//
//  Transition stored on the SECOND clip as:
//    clip.__transitionIn = { key, duration }
//  Plays at START of clip: [startTime, startTime + duration]
// ================================================================

export const TRANSITIONS = [
  { key: 'none',       label: 'None',         icon: '∅' },
  { key: 'fade',       label: 'Fade',         icon: '◐' },
  { key: 'dissolve',   label: 'Dissolve',     icon: '✨' },
  { key: 'fadeBlack',  label: 'Fade Black',   icon: '⬛' },
  { key: 'fadeWhite',  label: 'Fade White',   icon: '⬜' },
  { key: 'slideLeft',  label: 'Slide Left',   icon: '⬅️' },
  { key: 'slideRight', label: 'Slide Right',  icon: '➡️' },
  { key: 'slideUp',    label: 'Slide Up',     icon: '⬆️' },
  { key: 'slideDown',  label: 'Slide Down',   icon: '⬇️' },
  { key: 'zoomIn',     label: 'Zoom In',      icon: '🔍' },
  { key: 'zoomOut',    label: 'Zoom Out',     icon: '🔎' },
  { key: 'wipeLeft',   label: 'Wipe Left',    icon: '◀️' },
  { key: 'wipeRight',  label: 'Wipe Right',   icon: '▶️' },
  { key: 'circleIn',   label: 'Circle Open',  icon: '⭕' },
  { key: 'blur',       label: 'Blur Blend',   icon: '💫' }
];

const MAP = {};
TRANSITIONS.forEach(t => { MAP[t.key] = t; });

export function getTransition(key) {
  return MAP[key] || null;
}

export function isTransitionActive(clip, timelineTime) {
  if (!clip || !clip.__transitionIn) return false;
  const t = clip.__transitionIn;
  if (!t.key || t.key === 'none') return false;
  const dur = Number(t.duration) || 0.5;
  const start = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  return timelineTime >= start && timelineTime < start + dur;
}

export function getTransitionProgress(clip, timelineTime) {
  if (!isTransitionActive(clip, timelineTime)) return 0;
  const dur = Number(clip.__transitionIn.duration) || 0.5;
  const start = Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const p = (timelineTime - start) / dur;
  return Math.max(0, Math.min(1, p));
}

// ═══════════════════════════════════════════════════════════════
//  BLEND RENDERER
// ═══════════════════════════════════════════════════════════════
export function renderTransitionBlend(ctx, W, H, prevCanvas, currentDraw, progress, type) {
  const p = Math.max(0, Math.min(1, progress));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  switch (type) {
    // ─── Cross-fade ───────────────────────────────────────
    case 'fade':
    case 'dissolve':
    case 'blur': {
      if (prevCanvas) {
        ctx.globalAlpha = 1;
        if (type === 'blur') {
          try { ctx.filter = 'blur(' + (6 * (1 - p)) + 'px)'; } catch (_) {}
        }
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        try { ctx.filter = 'none'; } catch (_) {}
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = p;
      if (type === 'blur') {
        try { ctx.filter = 'blur(' + (6 * (1 - p)) + 'px)'; } catch (_) {}
      }
      currentDraw(ctx, W, H);
      try { ctx.filter = 'none'; } catch (_) {}
      ctx.globalAlpha = 1;
      break;
    }

    // ─── Fade to black then from black ────────────────────
    case 'fadeBlack':
    case 'fadeWhite': {
      const col = type === 'fadeBlack' ? '#000' : '#fff';
      if (p < 0.5) {
        const a = p * 2;
        if (prevCanvas) {
          ctx.globalAlpha = 1;
          ctx.drawImage(prevCanvas, 0, 0, W, H);
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = (p - 0.5) * 2;
        currentDraw(ctx, W, H);
        ctx.globalAlpha = 1;
      }
      break;
    }

    // ─── Slide ────────────────────────────────────────────
    case 'slideLeft': {
      if (prevCanvas) {
        ctx.save();
        ctx.translate(-W * p, 0);
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(W * (1 - p), 0);
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }
    case 'slideRight': {
      if (prevCanvas) {
        ctx.save();
        ctx.translate(W * p, 0);
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(-W * (1 - p), 0);
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }
    case 'slideUp': {
      if (prevCanvas) {
        ctx.save();
        ctx.translate(0, -H * p);
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(0, H * (1 - p));
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }
    case 'slideDown': {
      if (prevCanvas) {
        ctx.save();
        ctx.translate(0, H * p);
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(0, -H * (1 - p));
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }

    // ─── Zoom ─────────────────────────────────────────────
    case 'zoomIn': {
      if (prevCanvas) {
        ctx.globalAlpha = 1;
        ctx.drawImage(prevCanvas, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      const sc = 0.5 + 0.5 * p;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(W / 2, H / 2);
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -H / 2);
      currentDraw(ctx, W, H);
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }
    case 'zoomOut': {
      if (prevCanvas) {
        const sc = 1 + 1.5 * p;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.translate(W / 2, H / 2);
        ctx.scale(sc, sc);
        ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(prevCanvas, 0, 0, W, H);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.globalAlpha = p;
      currentDraw(ctx, W, H);
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }

    // ─── Wipe ─────────────────────────────────────────────
    case 'wipeLeft': {
      if (prevCanvas) {
        ctx.drawImage(prevCanvas, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      const revealedW = W * p;
      ctx.save();
      ctx.beginPath();
      ctx.rect(W - revealedW, 0, revealedW, H);
      ctx.clip();
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }
    case 'wipeRight': {
      if (prevCanvas) {
        ctx.drawImage(prevCanvas, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      const revealedW = W * p;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, revealedW, H);
      ctx.clip();
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }

    // ─── Circle open ──────────────────────────────────────
    case 'circleIn': {
      if (prevCanvas) {
        ctx.drawImage(prevCanvas, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      const maxR = Math.sqrt(W * W + H * H) / 2;
      const r = maxR * p;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.clip();
      currentDraw(ctx, W, H);
      ctx.restore();
      break;
    }

    default: {
      currentDraw(ctx, W, H);
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  try { ctx.filter = 'none'; } catch (_) {}
}