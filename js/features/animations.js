// ================================================================
//  js/features/animations.js
//  Text animations registry.
//  Interface:
//    - getAnimationList() → [{ key, label }, ...]
//    - applyAnimation(el, key, durationSeconds)
//
//  Some animations need JS (Typewriter, Decoder, Scribble).
//  applyAnimation handles both CSS and JS cases, and cleans up
//  any previously running JS animation on the same element.
// ================================================================

export const ANIMATIONS = [
  // ─── Basic ─────────────────────────────────────────────────
  { key: 'none',           label: 'None' },
  { key: 'typewriter',     label: 'Typewriter' },
  { key: 'fadeIn',         label: 'Fade In' },
  { key: 'fadeUp',         label: 'Fade Up' },
  { key: 'fadeDown',       label: 'Fade Down' },
  { key: 'slideLeft',      label: 'Slide In Left' },
  { key: 'slideRight',     label: 'Slide In Right' },
  { key: 'slideUp',        label: 'Slide In Up' },
  { key: 'slideDown',      label: 'Slide In Down' },
  { key: 'popIn',          label: 'Pop Up' },
  { key: 'bounceIn',       label: 'Bounce In' },
  { key: 'flicker',        label: 'Flicker' },
  { key: 'cinematicBlur',  label: 'Cinematic Blur' },
  // ─── Advanced ──────────────────────────────────────────────
  { key: 'flip3DX',        label: '3D Flip X' },
  { key: 'flip3DY',        label: '3D Flip Y' },
  { key: 'rotate3D',       label: '3D Rotate' },
  { key: 'scribble',       label: 'Scribble / Hand-drawn' },
  { key: 'glitch',         label: 'Glitch' },
  { key: 'decoder',        label: 'Decoder / Scramble' },
  { key: 'wave',           label: 'Wave' },
  { key: 'bounceWave',     label: 'Bounce Wave' },
  { key: 'pulse',          label: 'Pulse' },
  { key: 'shake',          label: 'Shake' },
  { key: 'zoomIn',         label: 'Zoom In' },
  { key: 'zoomOut',        label: 'Zoom Out' }
];

export function getAnimationList() {
  return ANIMATIONS;
}

// ─── Keyframes (injected once) ─────────────────────────────────
const KF_ID = 'tx-anim-keyframes';
function ensureKeyframes() {
  if (document.getElementById(KF_ID)) return;
  const style = document.createElement('style');
  style.id = KF_ID;
  style.textContent = `
    /* Base transform helpers respect --tx-scale + alignment origin */
    @keyframes tx-fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes tx-fadeUp {
      from { opacity: 0; margin-top: 24px; }
      to   { opacity: 1; margin-top: 0; }
    }
    @keyframes tx-fadeDown {
      from { opacity: 0; margin-top: -24px; }
      to   { opacity: 1; margin-top: 0; }
    }
    @keyframes tx-slideLeft {
      from { transform: translate(calc(-50% - 80px), -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 0; }
      to   { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 1; }
    }
    @keyframes tx-slideRight {
      from { transform: translate(calc(-50% + 80px), -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 0; }
      to   { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 1; }
    }
    @keyframes tx-slideUp {
      from { transform: translate(-50%, calc(-50% + 80px)) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 0; }
      to   { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 1; }
    }
    @keyframes tx-slideDown {
      from { transform: translate(-50%, calc(-50% - 80px)) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 0; }
      to   { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); opacity: 1; }
    }
    @keyframes tx-popIn {
      0%   { transform: translate(-50%, -50%) scale(0)    rotate(var(--tx-rot,0deg)); opacity: 0; }
      60%  { transform: translate(-50%, -50%) scale(1.12) rotate(var(--tx-rot,0deg)); opacity: 1; }
      80%  { transform: translate(-50%, -50%) scale(0.96) rotate(var(--tx-rot,0deg)); }
      100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); }
    }
    @keyframes tx-bounceIn {
      0%   { transform: translate(-50%, -50%) scale(0.2) rotate(var(--tx-rot,0deg)); opacity: 0; }
      40%  { transform: translate(-50%, -50%) scale(1.25) rotate(var(--tx-rot,0deg)); opacity: 1; }
      70%  { transform: translate(-50%, -50%) scale(0.9)  rotate(var(--tx-rot,0deg)); }
      100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) rotate(var(--tx-rot,0deg)); }
    }
    @keyframes tx-flicker {
      0%, 100% { opacity: 1; }
      8%   { opacity: 0.25; }
      12%  { opacity: 1; }
      24%  { opacity: 0.5; }
      30%  { opacity: 1; }
      45%  { opacity: 0.15; }
      50%  { opacity: 1; }
      62%  { opacity: 0.4; }
      70%  { opacity: 1; }
      84%  { opacity: 0.2; }
      90%  { opacity: 1; }
    }
    @keyframes tx-cinematicBlur {
      0%   { filter: blur(18px); opacity: 0; letter-spacing: 0.12em; }
      60%  { filter: blur(3px);  opacity: 1; letter-spacing: 0.02em; }
      100% { filter: blur(0);    opacity: 1; letter-spacing: normal; }
    }
    /* ─── 3D ─────────────────────────────────────── */
    @keyframes tx-flip3DX {
      0%   { transform: translate(-50%, -50%) perspective(600px) rotateX(90deg) scale(var(--tx-scale,1)); opacity: 0; }
      60%  { opacity: 1; }
      100% { transform: translate(-50%, -50%) perspective(600px) rotateX(0deg) scale(var(--tx-scale,1)); opacity: 1; }
    }
    @keyframes tx-flip3DY {
      0%   { transform: translate(-50%, -50%) perspective(600px) rotateY(90deg) scale(var(--tx-scale,1)); opacity: 0; }
      60%  { opacity: 1; }
      100% { transform: translate(-50%, -50%) perspective(600px) rotateY(0deg) scale(var(--tx-scale,1)); opacity: 1; }
    }
    @keyframes tx-rotate3D {
      0%   { transform: translate(-50%, -50%) perspective(700px) rotate3d(1, 1, 1, 0deg) scale(var(--tx-scale,1)); }
      100% { transform: translate(-50%, -50%) perspective(700px) rotate3d(1, 1, 1, 360deg) scale(var(--tx-scale,1)); }
    }
    /* ─── Scribble: reveal by clip-path sweep ───── */
    @keyframes tx-scribble {
      0%   { clip-path: inset(0 100% 0 0); opacity: 0.2; }
      100% { clip-path: inset(0 0 0 0);     opacity: 1; }
    }
    /* ─── Glitch: RGB split + jitter ─────────────── */
    @keyframes tx-glitch {
      0%, 100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); text-shadow: 0 0 0 transparent; }
      10% { transform: translate(calc(-50% - 3px), -50%) scale(var(--tx-scale,1)); text-shadow:  3px 0 #ff0044, -3px 0 #00ffee; }
      20% { transform: translate(calc(-50% + 3px), calc(-50% + 2px)) scale(var(--tx-scale,1)); text-shadow: -4px 0 #ff0044,  4px 0 #00ffee; }
      30% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); text-shadow: 0 0 0 transparent; }
      40% { transform: translate(calc(-50% - 2px), -50%) scale(var(--tx-scale,1)); text-shadow:  2px 0 #00ffee, -2px 0 #ff0044; }
      50% { transform: translate(calc(-50% + 4px), -50%) scale(var(--tx-scale,1)); text-shadow: -3px 0 #ff0044,  3px 0 #00ffee; }
      60% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); text-shadow: 0 0 0 transparent; }
      70% { transform: translate(calc(-50% - 4px), calc(-50% - 2px)) scale(var(--tx-scale,1)); text-shadow:  4px 0 #ff0044, -4px 0 #00ffee; }
      80% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); text-shadow: 0 0 0 transparent; }
    }
    /* ─── Wave (subtle vertical bob) ─────────────── */
    @keyframes tx-wave {
      0%, 100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(0); }
      25%      { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(-8px); }
      50%      { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(0); }
      75%      { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(8px); }
    }
    @keyframes tx-bounceWave {
      0%, 20%, 50%, 80%, 100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(0); }
      40% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(-18px); }
      60% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)) translateY(-10px); }
    }
    @keyframes tx-pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); }
      50%      { transform: translate(-50%, -50%) scale(calc(var(--tx-scale,1) * 1.1)); }
    }
    @keyframes tx-shake {
      0%, 100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); }
      20%, 60% { transform: translate(calc(-50% - 6px), -50%) scale(var(--tx-scale,1)); }
      40%, 80% { transform: translate(calc(-50% + 6px), -50%) scale(var(--tx-scale,1)); }
    }
    @keyframes tx-zoomIn {
      0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
      100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); opacity: 1; }
    }
    @keyframes tx-zoomOut {
      0%   { transform: translate(-50%, -50%) scale(2); opacity: 0; }
      100% { transform: translate(-50%, -50%) scale(var(--tx-scale,1)); opacity: 1; }
    }

    /* Typewriter caret */
    .tx-caret::after {
      content: '▍';
      margin-left: 2px;
      opacity: 0.9;
      animation: tx-caret-blink 0.7s steps(1) infinite;
    }
    @keyframes tx-caret-blink {
      0%, 49% { opacity: 0.9; }
      50%, 100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── JS-animation state per element ────────────────────────────
const jsTimers = new WeakMap();  // el → { raf, timeout, original }

function stopJsAnim(el) {
  const rec = jsTimers.get(el);
  if (!rec) return;
  if (rec.raf) cancelAnimationFrame(rec.raf);
  if (rec.timeout) clearTimeout(rec.timeout);
  if (rec.originalText != null) el.textContent = rec.originalText;
  el.classList.remove('tx-caret');
  jsTimers.delete(el);
}

// ─── Public API ────────────────────────────────────────────────
export function applyAnimation(el, key, duration = 0.6) {
  if (!el) return;
  ensureKeyframes();

  // Reset any in-flight animation (CSS or JS)
  stopJsAnim(el);
  el.style.animation = 'none';
  void el.offsetWidth;

  if (!key || key === 'none') return;

  const d = Math.max(0.1, Number(duration) || 0.6);

  // ─── JS-driven animations ──────────────────────────────────
  if (key === 'typewriter')  return runTypewriter(el, d);
  if (key === 'decoder')     return runDecoder(el, d);

  // ─── CSS animations ────────────────────────────────────────
  const ds = d + 's';
  const map = {
    fadeIn:        `tx-fadeIn ${ds} ease both`,
    fadeUp:        `tx-fadeUp ${ds} ease both`,
    fadeDown:      `tx-fadeDown ${ds} ease both`,
    slideLeft:     `tx-slideLeft ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    slideRight:    `tx-slideRight ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    slideUp:       `tx-slideUp ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    slideDown:     `tx-slideDown ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    popIn:         `tx-popIn ${ds} cubic-bezier(0.34, 1.56, 0.64, 1) both`,
    bounceIn:      `tx-bounceIn ${ds} cubic-bezier(0.34, 1.56, 0.64, 1) both`,
    flicker:       `tx-flicker ${ds} steps(1, end) both`,
    cinematicBlur: `tx-cinematicBlur ${ds} ease-out both`,
    flip3DX:       `tx-flip3DX ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    flip3DY:       `tx-flip3DY ${ds} cubic-bezier(0.22, 1, 0.36, 1) both`,
    rotate3D:      `tx-rotate3D ${ds} linear both`,
    scribble:      `tx-scribble ${ds} ease-out both`,
    glitch:        `tx-glitch ${ds} steps(1, end) both`,
    wave:          `tx-wave ${ds} ease-in-out both`,
    bounceWave:    `tx-bounceWave ${ds} ease both`,
    pulse:         `tx-pulse ${ds} ease-in-out both`,
    shake:         `tx-shake ${ds} ease both`,
    zoomIn:        `tx-zoomIn ${ds} ease both`,
    zoomOut:       `tx-zoomOut ${ds} ease both`
  };
  if (map[key]) el.style.animation = map[key];
}

// ─── Typewriter ────────────────────────────────────────────────
function runTypewriter(el, duration) {
  const full = el.textContent || '';
  if (!full) return;

  const totalMs = duration * 1000;
  const perChar = Math.max(15, totalMs / full.length);

  el.textContent = '';
  el.classList.add('tx-caret');

  let i = 0;
  let raf = null;
  let last = performance.now();

  const step = (now) => {
    if (now - last >= perChar) {
      last = now;
      if (i < full.length) {
        el.textContent = full.slice(0, i + 1);
        i++;
      }
    }
    if (i < full.length) {
      raf = requestAnimationFrame(step);
    } else {
      const rec = jsTimers.get(el);
      if (rec) rec.raf = null;
      // keep caret for a moment then remove
      const timeout = setTimeout(() => el.classList.remove('tx-caret'), 600);
      const r2 = jsTimers.get(el);
      if (r2) r2.timeout = timeout;
    }
  };

  jsTimers.set(el, { raf: requestAnimationFrame(step), timeout: null, originalText: full });
}

// ─── Decoder / Scramble ────────────────────────────────────────
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________';

function runDecoder(el, duration) {
  const full = el.textContent || '';
  if (!full) return;

  const totalMs = duration * 1000;
  const chars = full.split('');
  const start = performance.now();
  let raf = null;

  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / totalMs);

    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      // Reveal from left to right
      const revealAt = i / chars.length;
      if (progress >= revealAt + 0.05) {
        out += ch;
      } else {
        out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
    }
    el.textContent = out;

    if (progress < 1) {
      raf = requestAnimationFrame(step);
    } else {
      el.textContent = full;
      const rec = jsTimers.get(el);
      if (rec) rec.raf = null;
    }
  };

  jsTimers.set(el, { raf: requestAnimationFrame(step), timeout: null, originalText: full });
}