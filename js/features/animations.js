// ================================================================
//  js/features/animations.js
//  Text animations registry — 100+ animations
// ================================================================

export const ANIMATIONS = [
  // Basic
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

  // Reveals
  { key: 'wordReveal',     label: 'Word by Word' },
  { key: 'characterRise',  label: 'Character Rise' },
  { key: 'maskVertical',   label: 'Masked Vertical' },
  { key: 'maskHorizontal', label: 'Masked Horizontal' },
  { key: 'centerOut',      label: 'Center Out' },
  { key: 'lineDraw',       label: 'Line Draw' },
  { key: 'blurryReveal',   label: 'Blurry Reveal' },
  { key: 'smokeDissolve',  label: 'Smoke Dissolve' },
  { key: 'trailFade',      label: 'Trail Fade' },

  // Glitch
  { key: 'glitch',         label: 'Glitch' },
  { key: 'rgbSplit',       label: 'RGB Split' },
  { key: 'sliceGlitch',    label: 'Slice Glitch' },
  { key: 'blockGlitch',    label: 'Block Glitch' },
  { key: 'staticNoise',    label: 'Static Noise' },
  { key: 'vcrDistort',     label: 'VCR Distort' },
  { key: 'shakeJitter',    label: 'Shake Jitter' },
  { key: 'cyberpunk',      label: 'Cyberpunk Flicker' },
  { key: 'matrixRain',     label: 'Matrix Rain' },
  { key: 'decoder',        label: 'Decoder' },
  { key: 'interlaced',     label: 'Interlaced' },

  // Waves
  { key: 'wave',           label: 'Wave' },
  { key: 'bounceWave',     label: 'Bounce Wave' },
  { key: 'sineWave',       label: 'Sine Wave' },
  { key: 'liquidMelt',     label: 'Liquid Melt' },
  { key: 'flagWave',       label: 'Flag Wave' },
  { key: 'waterRipple',    label: 'Water Ripple' },
  { key: 'heatWave',       label: 'Heat Wave' },
  { key: 'elasticWave',    label: 'Elastic Wave' },
  { key: 'pulsingWave',    label: 'Pulsing Wave' },
  { key: 'turbulent',      label: 'Turbulent' },
  { key: 'circularWave',   label: 'Circular Wave' },

  // Bounces
  { key: 'overshootPop',   label: 'Overshoot Pop' },
  { key: 'elasticDrop',    label: 'Elastic Drop' },
  { key: 'jellyBounce',    label: 'Jelly Bounce' },
  { key: 'microBounce',    label: 'Micro Bounce' },
  { key: 'stompBounce',    label: 'Stomp Bounce' },
  { key: 'squeezeStretch', label: 'Squeeze & Stretch' },
  { key: 'float',          label: 'Continuous Float' },
  { key: 'diagonalJump',   label: 'Diagonal Jump' },
  { key: 'gravityFall',    label: 'Gravity Fall' },
  { key: 'heavyLanding',   label: 'Heavy Landing' },
  { key: 'doubleBounce',   label: 'Double Bounce' },
  { key: 'bouncySpin',     label: 'Bouncy Spin' },
  { key: 'snapBack',       label: 'Snap Back' },
  { key: 'springString',   label: 'Spring String' },
  { key: 'sideKick',       label: 'Side Kick' },

  // Sliders
  { key: 'flyDiagonalTL',  label: 'Fly In Top-Left' },
  { key: 'flyDiagonalBR',  label: 'Fly In Bottom-Right' },
  { key: 'crossSlide',     label: 'Cross Slide' },
  { key: 'accelSlide',     label: 'Accelerated Slide' },
  { key: 'decelSlide',     label: 'Decelerated Slide' },
  { key: 'splitSlide',     label: 'Split Slide' },
  { key: 'zigzagSlide',    label: 'Zig-Zag Slide' },
  { key: 'smoothGlide',    label: 'Smooth Glide' },
  { key: 'infiniteScroll', label: 'Infinite Scroll' },
  { key: 'pushSlide',      label: 'Push Slide' },

  // Rotations
  { key: 'flip3DX',        label: '3D Flip X' },
  { key: 'flip3DY',        label: '3D Flip Y' },
  { key: 'rotate3D',       label: '3D Rotate' },
  { key: 'yAxisFlip',      label: 'Y-Axis Flip' },
  { key: 'xAxisFlip',      label: 'X-Axis Flip' },
  { key: 'vortexSpin',     label: 'Vortex Spin' },
  { key: 'zAxisSpin',      label: 'Z-Axis Spin' },
  { key: 'spiralIn',       label: 'Spiral In' },
  { key: 'tornado',        label: 'Tornado Spin' },
  { key: 'skewSpin',       label: 'Skew Spin' },
  { key: 'pendulum',       label: 'Pendulum Swing' },
  { key: 'propeller',      label: 'Propeller Rotate' },
  { key: 'barrelRoll',     label: 'Barrel Roll' },
  { key: 'cubeRoll',       label: '3D Cube Roll' },
  { key: 'gentleTilt',     label: 'Gentle Tilt' },
  { key: 'twister',        label: 'Twister Reveal' },

  // Zooms
  { key: 'zoomIn',         label: 'Zoom In' },
  { key: 'zoomOut',        label: 'Zoom Out' },
  { key: 'cinematicZoom',  label: 'Cinematic Zoom In' },
  { key: 'hyperZoomOut',   label: 'Hyper Zoom Out' },
  { key: 'pulseScale',     label: 'Pulse Scale' },
  { key: 'elasticZoom',    label: 'Elastic Zoom' },
  { key: 'lensFlareZoom',  label: 'Lens Flare Zoom' },
  { key: 'shrinkReveal',   label: 'Shrink Reveal' },
  { key: 'popScale',       label: 'Pop Scale' },
  { key: 'depthZoom',      label: 'Depth Zoom' },
  { key: 'snapZoom',       label: 'Snap Zoom' },

  // Special
  { key: 'scribble',       label: 'Scribble' },
  { key: 'neonGlow',       label: 'Neon Glow Pulse' },
  { key: 'gradientShift',  label: 'Gradient Shift' },
  { key: 'ghostTrail',     label: 'Ghost Trail' },
  { key: 'silhouette',     label: 'Silhouette Reveal' },
  { key: 'explosion',      label: 'Explosion / Scatter' },
  { key: 'implosion',      label: 'Implosion' },
  { key: 'pulse',          label: 'Pulse' },
  { key: 'shake',          label: 'Shake' }
];

export function getAnimationList() {
  return ANIMATIONS;
}

// ═══════════════════════════════════════════════════════════════
//  KEYFRAMES
// ═══════════════════════════════════════════════════════════════
const KF_ID = 'tx-anim-keyframes';
function ensureKeyframes() {
  if (document.getElementById(KF_ID)) return;
  const style = document.createElement('style');
  style.id = KF_ID;
  style.textContent = `
    @keyframes tx-fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes tx-fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes tx-fadeDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes tx-slideLeft { from { transform: translate(-80px, 0); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
    @keyframes tx-slideRight { from { transform: translate(80px, 0); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
    @keyframes tx-slideUp { from { transform: translate(0, 80px); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
    @keyframes tx-slideDown { from { transform: translate(0, -80px); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
    @keyframes tx-popIn { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 80% { transform: scale(0.96); } 100% { transform: scale(1); } }
    @keyframes tx-bounceIn { 0% { transform: scale(0.2); opacity: 0; } 40% { transform: scale(1.25); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
    @keyframes tx-flicker { 0%,100%{opacity:1;} 8%{opacity:0.25;} 12%{opacity:1;} 24%{opacity:0.5;} 30%{opacity:1;} 45%{opacity:0.15;} 50%{opacity:1;} 62%{opacity:0.4;} 70%{opacity:1;} 84%{opacity:0.2;} 90%{opacity:1;} }
    @keyframes tx-cinematicBlur { 0%{filter:blur(18px);opacity:0;letter-spacing:0.12em;} 60%{filter:blur(3px);opacity:1;letter-spacing:0.02em;} 100%{filter:blur(0);opacity:1;letter-spacing:normal;} }

    @keyframes tx-wordReveal {
      0% { opacity: 0; transform: scale(0.6) translateY(10px); filter: blur(6px); }
      50% { opacity: 1; filter: blur(0); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes tx-characterRise {
      0% { opacity: 0; transform: translateY(40px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes tx-maskVertical { 0% { clip-path: inset(100% 0 0 0); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes tx-maskHorizontal { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes tx-centerOut { 0% { clip-path: inset(0 50% 0 50%); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes tx-lineDraw { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes tx-blurryReveal { 0% { filter: blur(20px); opacity: 0; transform: scale(1.2); } 100% { filter: blur(0); opacity: 1; transform: scale(1); } }
    @keyframes tx-smokeDissolve { 0% { filter: blur(30px); opacity: 0; transform: scale(1.4); letter-spacing: 0.4em; } 100% { filter: blur(0); opacity: 1; transform: scale(1); letter-spacing: normal; } }
    @keyframes tx-trailFade { 0% { opacity: 0; text-shadow: 40px 0 20px currentColor, 80px 0 30px currentColor; } 100% { opacity: 1; text-shadow: 0 0 0 transparent; } }

    @keyframes tx-glitch {
      0%,100% { transform: translate(0,0); text-shadow: 0 0 0 transparent; }
      10% { transform: translate(-3px,0); text-shadow: 3px 0 #ff0044, -3px 0 #00ffee; }
      20% { transform: translate(3px,2px); text-shadow: -4px 0 #ff0044, 4px 0 #00ffee; }
      30% { transform: translate(0,0); text-shadow: 0 0 0 transparent; }
      40% { transform: translate(-2px,0); text-shadow: 2px 0 #00ffee, -2px 0 #ff0044; }
      50% { transform: translate(4px,0); text-shadow: -3px 0 #ff0044, 3px 0 #00ffee; }
      60% { transform: translate(0,0); text-shadow: 0 0 0 transparent; }
      70% { transform: translate(-4px,-2px); text-shadow: 4px 0 #ff0044, -4px 0 #00ffee; }
      80% { transform: translate(0,0); text-shadow: 0 0 0 transparent; }
    }
    @keyframes tx-rgbSplit {
      0% { text-shadow: -6px 0 #ff0000, 6px 0 #00ffff; }
      25% { text-shadow: 4px 0 #00ff00, -4px 0 #ff00ff; }
      50% { text-shadow: -3px 0 #0000ff, 3px 0 #ffff00; }
      75% { text-shadow: 5px 0 #ff0000, -5px 0 #00ffff; }
      100% { text-shadow: 0 0 0 transparent; }
    }
    @keyframes tx-sliceGlitch {
      0%,100% { clip-path: inset(0 0 0 0); transform: translateX(0); }
      20% { clip-path: inset(20% 0 60% 0); transform: translateX(-10px); }
      40% { clip-path: inset(50% 0 30% 0); transform: translateX(12px); }
      60% { clip-path: inset(10% 0 75% 0); transform: translateX(-8px); }
      80% { clip-path: inset(70% 0 10% 0); transform: translateX(6px); }
    }
    @keyframes tx-blockGlitch {
      0% { clip-path: inset(0 0 100% 0); opacity: 0; }
      25% { clip-path: inset(0 0 60% 0); opacity: 1; }
      50% { clip-path: inset(0 0 30% 0); }
      75% { clip-path: inset(0 0 10% 0); }
      100% { clip-path: inset(0 0 0 0); }
    }
    @keyframes tx-staticNoise {
      0% { opacity: 0; transform: translate(0,0); filter: blur(0); }
      20% { opacity: 0.5; transform: translate(-2px,1px); filter: blur(1px); }
      40% { opacity: 0.8; transform: translate(2px,-1px); }
      60% { opacity: 0.9; transform: translate(-1px,2px); filter: blur(0.5px); }
      100% { opacity: 1; transform: translate(0,0); filter: blur(0); }
    }
    @keyframes tx-vcrDistort {
      0% { transform: translate(-4px,0) skewX(4deg); filter: hue-rotate(0deg); }
      20% { transform: translate(3px,0) skewX(-3deg); filter: hue-rotate(90deg); }
      40% { transform: translate(-3px,0) skewX(2deg); filter: hue-rotate(180deg); }
      60% { transform: translate(2px,0) skewX(-4deg); filter: hue-rotate(270deg); }
      100% { transform: translate(0,0) skewX(0); filter: hue-rotate(360deg); }
    }
    @keyframes tx-shakeJitter {
      0%,100% { transform: translate(0,0); }
      25% { transform: translate(1px,-1px); }
      50% { transform: translate(-1px,1px); }
      75% { transform: translate(1px,1px); }
    }
    @keyframes tx-cyberpunk {
      0%,100% { color: #00ffff; text-shadow: 0 0 8px #00ffff; }
      25% { color: #ffff00; text-shadow: 0 0 8px #ffff00; }
      50% { color: #00ffff; text-shadow: 0 0 12px #00ffff; }
      75% { color: #ffff00; text-shadow: 0 0 8px #ffff00; }
    }
    @keyframes tx-matrixRain {
      0% { opacity: 0; transform: translateY(-30px); filter: blur(8px); color: #00ff00; }
      50% { opacity: 1; color: #00ff00; text-shadow: 0 0 10px #00ff00; }
      100% { opacity: 1; transform: translateY(0); filter: blur(0); color: inherit; text-shadow: 0 0 0 transparent; }
    }
    @keyframes tx-interlaced {
      0% { clip-path: polygon(0 0,100% 0,100% 20%,0 20%,0 40%,100% 40%,100% 60%,0 60%,0 80%,100% 80%,100% 100%,0 100%); opacity: 0; }
      100% { clip-path: polygon(0 0,100% 0,100% 100%,0 100%); opacity: 1; }
    }

    @keyframes tx-wave { 0%,100%{transform:translateY(0);} 25%{transform:translateY(-8px);} 50%{transform:translateY(0);} 75%{transform:translateY(8px);} }
    @keyframes tx-bounceWave { 0%,20%,50%,80%,100%{transform:translateY(0);} 40%{transform:translateY(-18px);} 60%{transform:translateY(-10px);} }
    @keyframes tx-sineWave {
      0%,100% { transform: translateY(0) rotate(0deg); }
      25% { transform: translateY(-10px) rotate(-3deg); }
      50% { transform: translateY(0) rotate(0deg); }
      75% { transform: translateY(10px) rotate(3deg); }
    }
    @keyframes tx-liquidMelt {
      0% { filter: blur(0); transform: translateY(0) scaleY(1); }
      50% { filter: blur(3px); transform: translateY(10px) scaleY(1.2); opacity: 0.5; }
      100% { filter: blur(0); transform: translateY(0) scaleY(1); opacity: 1; }
    }
    @keyframes tx-flagWave {
      0%,100% { transform: skewY(0deg) scaleX(1); }
      25% { transform: skewY(3deg) scaleX(1.05); }
      50% { transform: skewY(0deg) scaleX(1); }
      75% { transform: skewY(-3deg) scaleX(1.05); }
    }
    @keyframes tx-waterRipple {
      0% { filter: blur(0); transform: scale(1); opacity: 0; }
      30% { filter: blur(4px); transform: scale(1.15); opacity: 1; }
      60% { filter: blur(2px); transform: scale(0.98); }
      100% { filter: blur(0); transform: scale(1); opacity: 1; }
    }
    @keyframes tx-heatWave {
      0%,100% { transform: skewX(0deg) translateX(0); filter: blur(0); }
      25% { transform: skewX(3deg) translateX(2px); filter: blur(1px); }
      50% { transform: skewX(0deg) translateX(0); filter: blur(0.5px); }
      75% { transform: skewX(-3deg) translateX(-2px); filter: blur(1px); }
    }
    @keyframes tx-elasticWave {
      0% { transform: translateY(30px); opacity: 0; }
      60% { transform: translateY(-8px); opacity: 1; }
      80% { transform: translateY(4px); }
      100% { transform: translateY(0); }
    }
    @keyframes tx-pulsingWave {
      0%,100% { transform: scale(1) translateY(0); }
      25% { transform: scale(1.06) translateY(-4px); }
      50% { transform: scale(1) translateY(0); }
      75% { transform: scale(0.94) translateY(4px); }
    }
    @keyframes tx-turbulent {
      0%,100% { transform: translate(0,0) rotate(0); }
      25% { transform: translate(-3px,-2px) rotate(-2deg); }
      50% { transform: translate(3px,2px) rotate(2deg); }
      75% { transform: translate(-2px,3px) rotate(-1deg); }
    }
    @keyframes tx-circularWave {
      0% { transform: rotate(0deg) translateX(20px) rotate(0deg); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: rotate(360deg) translateX(0) rotate(-360deg); opacity: 1; }
    }

    @keyframes tx-overshootPop {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.3); opacity: 1; }
      80% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    @keyframes tx-elasticDrop {
      0% { transform: translateY(-200px) scaleY(0.6); opacity: 0; }
      40% { transform: translateY(0) scaleY(0.8); opacity: 1; }
      60% { transform: translateY(-30px) scaleY(1.1); }
      80% { transform: translateY(0) scaleY(0.95); }
      100% { transform: translateY(0) scaleY(1); }
    }
    @keyframes tx-jellyBounce {
      0% { transform: scaleY(0.4) scaleX(1.4); opacity: 0; }
      25% { transform: scaleY(1.3) scaleX(0.8); opacity: 1; }
      50% { transform: scaleY(0.85) scaleX(1.15); }
      75% { transform: scaleY(1.08) scaleX(0.95); }
      100% { transform: scaleY(1) scaleX(1); }
    }
    @keyframes tx-microBounce {
      0% { transform: scale(0.85); opacity: 0; }
      60% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes tx-stompBounce {
      0% { transform: scale(2.5); opacity: 0; filter: blur(8px); }
      40% { transform: scale(0.9); opacity: 1; filter: blur(0); }
      60% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    @keyframes tx-squeezeStretch {
      0% { transform: scaleX(2) scaleY(0.3); opacity: 0; }
      60% { transform: scaleX(0.85) scaleY(1.15); opacity: 1; }
      100% { transform: scaleX(1) scaleY(1); }
    }
    @keyframes tx-float {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes tx-diagonalJump {
      0% { transform: translate(-100px, 100px) rotate(-15deg); opacity: 0; }
      60% { transform: translate(0, 0) rotate(3deg); opacity: 1; }
      80% { transform: translate(0, 0) rotate(-2deg); }
      100% { transform: translate(0, 0) rotate(0); }
    }
    @keyframes tx-gravityFall {
      0% { transform: translateY(0) rotate(0); opacity: 1; }
      100% { transform: translateY(300px) rotate(45deg); opacity: 0; }
    }
    @keyframes tx-heavyLanding {
      0% { transform: translateY(-150px) scaleY(0.7); opacity: 0; }
      70% { transform: translateY(0) scaleY(1.15); opacity: 1; }
      85% { transform: translateY(0) scaleY(0.95); }
      100% { transform: translateY(0) scaleY(1); }
    }
    @keyframes tx-doubleBounce {
      0% { transform: translateY(-100px); opacity: 0; }
      20% { transform: translateY(0); opacity: 1; }
      40% { transform: translateY(-40px); }
      60% { transform: translateY(0); }
      80% { transform: translateY(-15px); }
      100% { transform: translateY(0); }
    }
    @keyframes tx-bouncySpin {
      0% { transform: translateY(-100px) rotate(0); opacity: 0; }
      50% { transform: translateY(0) rotate(180deg); opacity: 1; }
      75% { transform: translateY(-20px) rotate(320deg); }
      100% { transform: translateY(0) rotate(360deg); }
    }
    @keyframes tx-snapBack {
      0% { transform: translateX(0); }
      40% { transform: translateX(80px); }
      60% { transform: translateX(40px); }
      100% { transform: translateX(0); }
    }
    @keyframes tx-springString {
      0% { transform: translateY(30px) rotate(-8deg); opacity: 0; }
      30% { transform: translateY(-15px) rotate(6deg); opacity: 1; }
      60% { transform: translateY(8px) rotate(-3deg); }
      100% { transform: translateY(0) rotate(0); }
    }
    @keyframes tx-sideKick {
      0% { transform: translateX(-150px) rotate(-25deg); opacity: 0; }
      70% { transform: translateX(0) rotate(5deg); opacity: 1; }
      85% { transform: translateX(0) rotate(-3deg); }
      100% { transform: translateX(0) rotate(0); }
    }

    @keyframes tx-flyDiagonalTL {
      0% { transform: translate(-200px, -200px) rotate(-30deg) scale(0.5); opacity: 0; }
      100% { transform: translate(0,0) rotate(0) scale(1); opacity: 1; }
    }
    @keyframes tx-flyDiagonalBR {
      0% { transform: translate(200px, 200px) rotate(30deg) scale(0.5); opacity: 0; }
      100% { transform: translate(0,0) rotate(0) scale(1); opacity: 1; }
    }
    @keyframes tx-crossSlide {
      0% { clip-path: inset(0 100% 0 0); transform: translateX(-20px); opacity: 0; }
      100% { clip-path: inset(0 0 0 0); transform: translateX(0); opacity: 1; }
    }
    @keyframes tx-accelSlide {
      0% { transform: translateX(-200px); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes tx-decelSlide {
      0% { transform: translateX(-200px); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes tx-splitSlide {
      0% { clip-path: inset(0 0 50% 0); opacity: 0; }
      30% { clip-path: inset(0 0 50% 0); opacity: 1; }
      100% { clip-path: inset(0 0 0 0); opacity: 1; }
    }
    @keyframes tx-zigzagSlide {
      0% { transform: translate(-150px, -30px) rotate(-10deg); opacity: 0; }
      30% { transform: translate(-60px, 20px) rotate(8deg); opacity: 0.6; }
      60% { transform: translate(20px, -10px) rotate(-5deg); opacity: 0.9; }
      100% { transform: translate(0,0) rotate(0); opacity: 1; }
    }
    @keyframes tx-smoothGlide {
      0% { transform: translateX(-60px); opacity: 0; filter: blur(4px); }
      100% { transform: translateX(0); opacity: 1; filter: blur(0); }
    }
    @keyframes tx-infiniteScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50px); }
    }
    @keyframes tx-pushSlide {
      0% { transform: translateX(30px) scale(1.1); opacity: 0; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }

    @keyframes tx-flip3DX { 0% { transform: perspective(600px) rotateX(90deg); opacity: 0; } 60% { opacity: 1; } 100% { transform: perspective(600px) rotateX(0); opacity: 1; } }
    @keyframes tx-flip3DY { 0% { transform: perspective(600px) rotateY(90deg); opacity: 0; } 60% { opacity: 1; } 100% { transform: perspective(600px) rotateY(0); opacity: 1; } }
    @keyframes tx-rotate3D { 0% { transform: perspective(700px) rotate3d(1,1,1,0deg); } 100% { transform: perspective(700px) rotate3d(1,1,1,360deg); } }
    @keyframes tx-yAxisFlip { 0% { transform: perspective(800px) rotateY(-180deg); opacity: 0; } 100% { transform: perspective(800px) rotateY(0); opacity: 1; } }
    @keyframes tx-xAxisFlip { 0% { transform: perspective(800px) rotateX(-180deg); opacity: 0; } 100% { transform: perspective(800px) rotateX(0); opacity: 1; } }
    @keyframes tx-vortexSpin {
      0% { transform: scale(0) rotate(0deg); opacity: 0; }
      60% { transform: scale(1.3) rotate(540deg); opacity: 1; }
      100% { transform: scale(1) rotate(720deg); }
    }
    @keyframes tx-zAxisSpin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
    @keyframes tx-spiralIn {
      0% { transform: scale(0) rotate(720deg) translateY(100px); opacity: 0; }
      100% { transform: scale(1) rotate(0) translateY(0); opacity: 1; }
    }
    @keyframes tx-tornado {
      0% { transform: scale(0.3) rotate(0) skewY(20deg); opacity: 0; }
      70% { transform: scale(1.15) rotate(720deg) skewY(0); opacity: 1; }
      100% { transform: scale(1) rotate(720deg); }
    }
    @keyframes tx-skewSpin {
      0% { transform: skewX(40deg) rotate(-90deg) scale(0.5); opacity: 0; }
      100% { transform: skewX(0) rotate(0) scale(1); opacity: 1; }
    }
    @keyframes tx-pendulum {
      0%,100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }
    @keyframes tx-propeller {
      0% { transform: rotate(0) scale(0.3); opacity: 0; }
      50% { transform: rotate(1080deg) scale(1.1); opacity: 1; }
      100% { transform: rotate(1440deg) scale(1); }
    }
    @keyframes tx-barrelRoll {
      0% { transform: rotate(0) translateX(0); opacity: 0; }
      50% { transform: rotate(360deg) translateX(100px); opacity: 1; }
      100% { transform: rotate(720deg) translateX(0); }
    }
    @keyframes tx-cubeRoll {
      0% { transform: perspective(800px) rotateX(0) rotateY(-90deg); opacity: 0; }
      100% { transform: perspective(800px) rotateX(0) rotateY(0); opacity: 1; }
    }
    @keyframes tx-gentleTilt {
      0%,100% { transform: rotate(0); }
      50% { transform: rotate(5deg); }
    }
    @keyframes tx-twister {
      0% { transform: scaleX(0) skewX(60deg); opacity: 0; }
      100% { transform: scaleX(1) skewX(0); opacity: 1; }
    }

    @keyframes tx-zoomIn { 0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes tx-zoomOut { 0% { transform: scale(2); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes tx-cinematicZoom {
      0% { transform: scale(1.6); opacity: 0; filter: blur(10px); }
      60% { transform: scale(1.05); opacity: 1; filter: blur(2px); }
      100% { transform: scale(1); opacity: 1; filter: blur(0); }
    }
    @keyframes tx-hyperZoomOut {
      0% { transform: scale(8); opacity: 0; filter: blur(20px); }
      70% { transform: scale(0.9); opacity: 1; filter: blur(0); }
      100% { transform: scale(1); }
    }
    @keyframes tx-pulseScale {
      0% { transform: scale(0.7); opacity: 0; }
      40% { transform: scale(1.15); opacity: 1; }
      70% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    @keyframes tx-elasticZoom {
      0% { transform: scale(0.1); opacity: 0; }
      60% { transform: scale(1.3); opacity: 1; }
      80% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes tx-lensFlareZoom {
      0% { transform: scale(0.2); opacity: 0; filter: brightness(3) blur(10px); }
      60% { transform: scale(1.1); opacity: 1; filter: brightness(1.5) blur(2px); }
      100% { transform: scale(1); filter: brightness(1) blur(0); }
    }
    @keyframes tx-shrinkReveal {
      0% { transform: scale(6); opacity: 0; filter: blur(12px); }
      100% { transform: scale(1); opacity: 1; filter: blur(0); }
    }
    @keyframes tx-popScale {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes tx-depthZoom {
      0% { transform: perspective(800px) translateZ(-400px); opacity: 0; }
      100% { transform: perspective(800px) translateZ(0); opacity: 1; }
    }
    @keyframes tx-snapZoom {
      0% { transform: scale(3); opacity: 0; filter: blur(8px); }
      50% { transform: scale(1); opacity: 1; filter: blur(0); }
      65% { transform: scale(1.04); }
      100% { transform: scale(1); }
    }

    @keyframes tx-scribble { 0% { clip-path: inset(0 100% 0 0); opacity: 0.2; } 100% { clip-path: inset(0 0 0 0); opacity: 1; } }
    @keyframes tx-neonGlow {
      0%,100% { text-shadow: 0 0 6px currentColor, 0 0 12px currentColor; }
      50% { text-shadow: 0 0 14px currentColor, 0 0 28px currentColor, 0 0 40px currentColor; }
    }
    @keyframes tx-gradientShift {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
    @keyframes tx-ghostTrail {
      0% { opacity: 0; text-shadow: -40px 0 20px currentColor, -80px 0 30px currentColor; }
      100% { opacity: 1; text-shadow: 0 0 0 transparent; }
    }
    @keyframes tx-silhouette {
      0% { color: transparent; text-shadow: 0 0 40px rgba(0,0,0,0.9); opacity: 0.3; }
      60% { color: transparent; text-shadow: 0 0 20px rgba(0,0,0,0.7); opacity: 0.8; }
      100% { color: inherit; text-shadow: 0 0 0 transparent; opacity: 1; }
    }
    @keyframes tx-explosion {
      0% { transform: scale(1); opacity: 1; filter: blur(0); }
      100% { transform: scale(2.5) rotate(20deg); opacity: 0; filter: blur(15px); }
    }
    @keyframes tx-implosion {
      0% { transform: scale(3) rotate(-20deg); opacity: 0; filter: blur(15px); }
      100% { transform: scale(1) rotate(0); opacity: 1; filter: blur(0); }
    }
    @keyframes tx-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    @keyframes tx-shake { 0%,100% { transform: translate(0,0); } 20%,60% { transform: translate(-6px,0); } 40%,80% { transform: translate(6px,0); } }

    .tx-caret::after { content: '▍'; margin-left: 2px; opacity: 0.9; animation: tx-caret-blink 0.7s steps(1) infinite; }
    @keyframes tx-caret-blink { 0%,49% { opacity: 0.9; } 50%,100% { opacity: 0; } }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
//  JS TIMERS
// ═══════════════════════════════════════════════════════════════
const jsTimers = new WeakMap();

function stopJsAnim(el) {
  const rec = jsTimers.get(el);
  if (!rec) return;
  if (rec.raf) cancelAnimationFrame(rec.raf);
  if (rec.timeout) clearTimeout(rec.timeout);
  if (rec.originalText != null) el.textContent = rec.originalText;
  el.classList.remove('tx-caret');
  jsTimers.delete(el);
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC — applyAnimation
// ═══════════════════════════════════════════════════════════════
export function applyAnimation(el, key, duration, providedText) {
  if (!el) return;
  ensureKeyframes();

  const d = Math.max(0.1, Number(duration) || 0.6);

  stopJsAnim(el);
  el.style.animation = 'none';
  el.style.filter = 'none';
  el.style.transform = '';
  el.style.opacity = '';
  void el.offsetWidth;

  if (!key || key === 'none') return;

  // JS-driven animations
  if (key === 'typewriter') return runTypewriter(el, d, providedText);
  if (key === 'decoder')    return runDecoder(el, d, providedText);

  // CSS animations
  const ds = d + 's';
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const map = {
    fadeIn:        'tx-fadeIn ' + ds + ' ease both',
    fadeUp:        'tx-fadeUp ' + ds + ' ease both',
    fadeDown:      'tx-fadeDown ' + ds + ' ease both',
    slideLeft:     'tx-slideLeft ' + ds + ' ' + ease + ' both',
    slideRight:    'tx-slideRight ' + ds + ' ' + ease + ' both',
    slideUp:       'tx-slideUp ' + ds + ' ' + ease + ' both',
    slideDown:     'tx-slideDown ' + ds + ' ' + ease + ' both',
    popIn:         'tx-popIn ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    bounceIn:      'tx-bounceIn ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    flicker:       'tx-flicker ' + ds + ' steps(1, end) both',
    cinematicBlur: 'tx-cinematicBlur ' + ds + ' ease-out both',

    wordReveal:     'tx-wordReveal ' + ds + ' ease-out both',
    characterRise:  'tx-characterRise ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    maskVertical:   'tx-maskVertical ' + ds + ' ease-out both',
    maskHorizontal: 'tx-maskHorizontal ' + ds + ' ease-out both',
    centerOut:      'tx-centerOut ' + ds + ' ease-out both',
    lineDraw:       'tx-lineDraw ' + ds + ' ease-out both',
    blurryReveal:   'tx-blurryReveal ' + ds + ' ease-out both',
    smokeDissolve:  'tx-smokeDissolve ' + ds + ' ease-out both',
    trailFade:      'tx-trailFade ' + ds + ' ease-out both',

    glitch:       'tx-glitch ' + ds + ' steps(1, end) both',
    rgbSplit:     'tx-rgbSplit ' + ds + ' steps(1, end) both',
    sliceGlitch:  'tx-sliceGlitch ' + ds + ' steps(1, end) both',
    blockGlitch:  'tx-blockGlitch ' + ds + ' steps(1, end) both',
    staticNoise:  'tx-staticNoise ' + ds + ' steps(1, end) both',
    vcrDistort:   'tx-vcrDistort ' + ds + ' steps(1, end) both',
    shakeJitter:  'tx-shakeJitter ' + ds + ' steps(1, end) infinite',
    cyberpunk:    'tx-cyberpunk ' + ds + ' steps(1, end) both',
    matrixRain:   'tx-matrixRain ' + ds + ' ease-out both',
    interlaced:   'tx-interlaced ' + ds + ' ease-out both',

    wave:         'tx-wave ' + ds + ' ease-in-out both',
    bounceWave:   'tx-bounceWave ' + ds + ' ease both',
    sineWave:     'tx-sineWave ' + ds + ' ease-in-out both',
    liquidMelt:   'tx-liquidMelt ' + ds + ' ease-in-out both',
    flagWave:     'tx-flagWave ' + ds + ' ease-in-out both',
    waterRipple:  'tx-waterRipple ' + ds + ' ease-out both',
    heatWave:     'tx-heatWave ' + ds + ' ease-in-out infinite',
    elasticWave:  'tx-elasticWave ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    pulsingWave:  'tx-pulsingWave ' + ds + ' ease-in-out infinite',
    turbulent:    'tx-turbulent ' + ds + ' ease-in-out infinite',
    circularWave: 'tx-circularWave ' + ds + ' ease-out both',

    overshootPop:   'tx-overshootPop ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    elasticDrop:    'tx-elasticDrop ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    jellyBounce:    'tx-jellyBounce ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    microBounce:    'tx-microBounce ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    stompBounce:    'tx-stompBounce ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    squeezeStretch: 'tx-squeezeStretch ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    float:          'tx-float ' + ds + ' ease-in-out infinite',
    diagonalJump:   'tx-diagonalJump ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    gravityFall:    'tx-gravityFall ' + ds + ' cubic-bezier(0.5, 0, 1, 1) both',
    heavyLanding:   'tx-heavyLanding ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    doubleBounce:   'tx-doubleBounce ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    bouncySpin:     'tx-bouncySpin ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    snapBack:       'tx-snapBack ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    springString:   'tx-springString ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    sideKick:       'tx-sideKick ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',

    flyDiagonalTL: 'tx-flyDiagonalTL ' + ds + ' ' + ease + ' both',
    flyDiagonalBR: 'tx-flyDiagonalBR ' + ds + ' ' + ease + ' both',
    crossSlide:    'tx-crossSlide ' + ds + ' ease-out both',
    accelSlide:    'tx-accelSlide ' + ds + ' cubic-bezier(0.7, 0, 1, 1) both',
    decelSlide:    'tx-decelSlide ' + ds + ' cubic-bezier(0, 0.4, 0.2, 1) both',
    splitSlide:    'tx-splitSlide ' + ds + ' ease-out both',
    zigzagSlide:   'tx-zigzagSlide ' + ds + ' ease-out both',
    smoothGlide:   'tx-smoothGlide ' + ds + ' cubic-bezier(0.22, 1, 0.36, 1) both',
    infiniteScroll:'tx-infiniteScroll ' + ds + ' linear infinite',
    pushSlide:     'tx-pushSlide ' + ds + ' ' + ease + ' both',

    flip3DX:     'tx-flip3DX ' + ds + ' ' + ease + ' both',
    flip3DY:     'tx-flip3DY ' + ds + ' ' + ease + ' both',
    rotate3D:    'tx-rotate3D ' + ds + ' linear both',
    yAxisFlip:   'tx-yAxisFlip ' + ds + ' ' + ease + ' both',
    xAxisFlip:   'tx-xAxisFlip ' + ds + ' ' + ease + ' both',
    vortexSpin:  'tx-vortexSpin ' + ds + ' ease-out both',
    zAxisSpin:   'tx-zAxisSpin ' + ds + ' linear both',
    spiralIn:    'tx-spiralIn ' + ds + ' ease-out both',
    tornado:     'tx-tornado ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    skewSpin:    'tx-skewSpin ' + ds + ' ' + ease + ' both',
    pendulum:    'tx-pendulum ' + ds + ' ease-in-out infinite',
    propeller:   'tx-propeller ' + ds + ' ease-out both',
    barrelRoll:  'tx-barrelRoll ' + ds + ' ease-in-out both',
    cubeRoll:    'tx-cubeRoll ' + ds + ' ' + ease + ' both',
    gentleTilt:  'tx-gentleTilt ' + ds + ' ease-in-out infinite',
    twister:     'tx-twister ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',

    zoomIn:        'tx-zoomIn ' + ds + ' ease both',
    zoomOut:       'tx-zoomOut ' + ds + ' ease both',
    cinematicZoom: 'tx-cinematicZoom ' + ds + ' ease-out both',
    hyperZoomOut:  'tx-hyperZoomOut ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    pulseScale:    'tx-pulseScale ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    elasticZoom:   'tx-elasticZoom ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    lensFlareZoom: 'tx-lensFlareZoom ' + ds + ' ease-out both',
    shrinkReveal:  'tx-shrinkReveal ' + ds + ' ease-out both',
    popScale:      'tx-popScale ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',
    depthZoom:     'tx-depthZoom ' + ds + ' ease-out both',
    snapZoom:      'tx-snapZoom ' + ds + ' cubic-bezier(0.34, 1.56, 0.64, 1) both',

    scribble:      'tx-scribble ' + ds + ' ease-out both',
    neonGlow:      'tx-neonGlow ' + ds + ' ease-in-out infinite',
    gradientShift: 'tx-gradientShift ' + ds + ' linear infinite',
    ghostTrail:    'tx-ghostTrail ' + ds + ' ease-out both',
    silhouette:    'tx-silhouette ' + ds + ' ease-out both',
    explosion:     'tx-explosion ' + ds + ' ease-in both',
    implosion:     'tx-implosion ' + ds + ' ease-out both',
    pulse:         'tx-pulse ' + ds + ' ease-in-out both',
    shake:         'tx-shake ' + ds + ' ease both'
  };
  if (map[key]) el.style.animation = map[key];
}

// ═══════════════════════════════════════════════════════════════
//  TYPEWRITER
// ═══════════════════════════════════════════════════════════════
function runTypewriter(el, duration, providedText) {
  const full = providedText || el.textContent || '';
  if (!full) return;

  const totalMs = duration * 1000;
  const perChar = Math.max(15, totalMs / full.length);

  el.textContent = '';
  el.classList.add('tx-caret');

  let i = 0;
  let raf = null;
  let last = performance.now();

  const step = function (now) {
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
      const timeout = setTimeout(function () { el.classList.remove('tx-caret'); }, 600);
      const r2 = jsTimers.get(el);
      if (r2) r2.timeout = timeout;
    }
  };

  jsTimers.set(el, { raf: requestAnimationFrame(step), timeout: null, originalText: full });
}

// ═══════════════════════════════════════════════════════════════
//  DECODER
// ═══════════════════════════════════════════════════════════════
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________';

function runDecoder(el, duration, providedText) {
  const full = providedText || el.textContent || '';
  if (!full) return;

  const totalMs = duration * 1000;
  const chars = full.split('');
  const start = performance.now();
  let raf = null;

  const step = function (now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / totalMs);

    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
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