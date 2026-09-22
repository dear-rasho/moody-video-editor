// ================================================================
//  js/workspace/transitionEngine.js
//  100+ transitions — pure Canvas 2D, 100% offline.
// ================================================================

// ═══════════════════════════════════════════════════════════════
//  TRANSITION REGISTRY
// ═══════════════════════════════════════════════════════════════
export const TRANSITIONS = [
  // ─── BASIC ────────────────────────────────────────────────
  { key: 'none',                 label: 'None',                icon: '∅' },
  { key: 'fade',                 label: 'Fade',                icon: '◐' },
  { key: 'dissolve',             label: 'Dissolve',            icon: '✨' },
  { key: 'fadeBlack',            label: 'Fade Black',          icon: '⬛' },
  { key: 'fadeWhite',            label: 'Fade White',          icon: '⬜' },
  { key: 'blur',                 label: 'Blur Blend',          icon: '💫' },

  // ─── PUSH ─────────────────────────────────────────────────
  { key: 'pushLeft',             label: 'Push Left',           icon: '⬅️' },
  { key: 'pushRight',            label: 'Push Right',          icon: '➡️' },
  { key: 'pushUp',               label: 'Push Up',             icon: '⬆️' },
  { key: 'pushDown',             label: 'Push Down',           icon: '⬇️' },

  // ─── SLIDE OVER ───────────────────────────────────────────
  { key: 'slideOverLeft',        label: 'Slide Over Left',     icon: '⇦' },
  { key: 'slideOverRight',       label: 'Slide Over Right',    icon: '⇨' },
  { key: 'slideOverTop',         label: 'Slide Over Top',      icon: '⇧' },
  { key: 'slideOverBottom',      label: 'Slide Over Bottom',   icon: '⇩' },

  // ─── SLIDE IN (original) ──────────────────────────────────
  { key: 'slideLeft',            label: 'Slide Left',          icon: '⬅️' },
  { key: 'slideRight',           label: 'Slide Right',         icon: '➡️' },
  { key: 'slideUp',              label: 'Slide Up',            icon: '⬆️' },
  { key: 'slideDown',            label: 'Slide Down',          icon: '⬇️' },

  // ─── WIPES ────────────────────────────────────────────────
  { key: 'wipeLeft',             label: 'Wipe Left',           icon: '◀️' },
  { key: 'wipeRight',            label: 'Wipe Right',          icon: '▶️' },
  { key: 'wipeHorizontal',       label: 'Wipe Horizontal',     icon: '⇄' },
  { key: 'wipeVertical',         label: 'Wipe Vertical',       icon: '⇅' },
  { key: 'wipeDiagonalTL',       label: 'Wipe Diag TL',        icon: '◤' },
  { key: 'wipeDiagonalBR',       label: 'Wipe Diag BR',        icon: '◢' },
  { key: 'splitWipeVertical',    label: 'Split Wipe V',        icon: '⫲' },
  { key: 'splitWipeHorizontal',  label: 'Split Wipe H',        icon: '⫳' },
  { key: 'checkerboardWipe',     label: 'Checkerboard',        icon: '▦' },
  { key: 'venetianBlinds',       label: 'Venetian Blinds',     icon: '☰' },
  { key: 'clockWipe',            label: 'Clock Wipe',          icon: '🕐' },
  { key: 'wedgeWipe',            label: 'Wedge',               icon: '▲' },
  { key: 'irisBox',              label: 'Iris Box',            icon: '▢' },
  { key: 'irisCross',            label: 'Iris Cross',          icon: '✚' },
  { key: 'circleIn',             label: 'Circle Open',         icon: '⭕' },

  // ─── ZOOMS ────────────────────────────────────────────────
  { key: 'zoomIn',               label: 'Zoom In',             icon: '🔍' },
  { key: 'zoomOut',              label: 'Zoom Out',            icon: '🔎' },
  { key: 'smoothZoomIn',         label: 'Smooth Zoom In',      icon: '🔍' },
  { key: 'smoothZoomOut',        label: 'Smooth Zoom Out',     icon: '🔎' },
  { key: 'crossZoom',            label: 'Cross Zoom',          icon: '⊙' },
  { key: 'zoomBlur',             label: 'Zoom Blur',           icon: '💫' },

  // ─── SPINS ────────────────────────────────────────────────
  { key: 'spinCW',               label: 'Spin CW',             icon: '↻' },
  { key: 'spinCCW',              label: 'Spin CCW',            icon: '↺' },
  { key: 'spinZoomCombo',        label: 'Spin + Zoom',         icon: '🌀' },
  { key: 'radialBlurSpin',       label: 'Radial Blur Spin',    icon: '🌪️' },
  { key: 'swirlDistort',         label: 'Swirl Distort',       icon: '🌀' },

  // ─── 3D TRANSFORMS ────────────────────────────────────────
  { key: 'cubeFlipLeft',         label: '3D Cube Left',        icon: '🧊' },
  { key: 'cubeFlipRight',        label: '3D Cube Right',       icon: '🧊' },
  { key: 'pageFlip',             label: '3D Page Flip',        icon: '📖' },
  { key: 'doorSwing',            label: '3D Door Swing',       icon: '🚪' },
  { key: 'cardFlip',             label: 'Card Flip',           icon: '🃏' },
  { key: 'flyBy',                label: 'Fly By',              icon: '✈️' },
  { key: 'zTumble',              label: 'Z-Axis Tumble',       icon: '🎲' },
  { key: 'elasticZoomSpin',      label: 'Elastic Zoom Spin',   icon: '🌊' },

  // ─── GLITCH / CYBER ───────────────────────────────────────
  { key: 'rgbSplit',             label: 'RGB Split',           icon: '🌈' },
  { key: 'hLineJitter',          label: 'H-Line Jitter',       icon: '≡' },
  { key: 'digitalBlock',         label: 'Digital Block',       icon: '⬛' },
  { key: 'vcrStatic',            label: 'VCR Static',          icon: '📼' },
  { key: 'dataMosh',             label: 'Data Moshing',        icon: '🌐' },
  { key: 'flickerFlash',         label: 'Flicker Flash',       icon: '⚡' },
  { key: 'sliceDistort',         label: 'Slice Distort',       icon: '✂️' },
  { key: 'matrixScanline',       label: 'Matrix Scanline',     icon: '🟩' },
  { key: 'signalLoss',           label: 'Signal Loss',         icon: '📡' },
  { key: 'pixelSortWipe',        label: 'Pixel Sort Wipe',     icon: '▤' },
  { key: 'hwFreezeJitter',       label: 'HW Freeze Jitter',    icon: '❄️' },
  { key: 'chromaticDisp',        label: 'Chromatic Disp',      icon: '🔴' },
  { key: 'waveGlitch',           label: 'Wave Glitch',         icon: '〰️' },
  { key: 'microStrobe',          label: 'Micro Strobe',        icon: '✨' },
  { key: 'glitchDissolve',       label: 'Glitch Dissolve',     icon: '⚡' },

  // ─── FADES / DISSOLVES ────────────────────────────────────
  { key: 'dipToColor',           label: 'Dip to Color',        icon: '🎨' },
  { key: 'gaussianBlurCross',    label: 'Gaussian Blur Cross', icon: '💧' },
  { key: 'dirBlurLeft',          label: 'Directional Blur L',  icon: '⬅️' },
  { key: 'dirBlurRight',         label: 'Directional Blur R',  icon: '➡️' },
  { key: 'bokehBlurDissolve',    label: 'Bokeh Dissolve',      icon: '🌸' },
  { key: 'nonAdditiveDissolve',  label: 'Non-Additive',        icon: '🌗' },
  { key: 'filmDissolve',         label: 'Film Dissolve',       icon: '🎞️' },
  { key: 'randomBlocksDissolve', label: 'Random Blocks',       icon: '⬜' },
  { key: 'meltDissolve',         label: 'Melt Dissolve',       icon: '🫠' },
  { key: 'softSmudge',           label: 'Soft Smudge',         icon: '💨' },

  // ─── LIGHT & COLOR ────────────────────────────────────────
  { key: 'lensFlareFlash',       label: 'Lens Flare Flash',    icon: '☀️' },
  { key: 'lightLeakOrange',      label: 'Light Leak Orange',   icon: '🌅' },
  { key: 'neonGlowBurn',         label: 'Neon Glow Burn',      icon: '💡' },
  { key: 'filmBurn',             label: 'Film Burn',           icon: '🔥' },
  { key: 'exposureFlash',        label: 'Exposure Flash',      icon: '📸' },
  { key: 'colorInvertFlash',     label: 'Color Invert',        icon: '🔄' },
  { key: 'rainbowPrism',         label: 'Rainbow Prism',       icon: '🌈' },
  { key: 'softVignetteFade',     label: 'Soft Vignette',       icon: '🕳️' },
  { key: 'solarizeWipe',         label: 'Solarize Wipe',       icon: '☀️' },
  { key: 'lightWipe',            label: 'Light Wipe',          icon: '✨' },

  // ─── LIQUID & WARP ────────────────────────────────────────
  { key: 'waterRipple',          label: 'Water Ripple',        icon: '💧' },
  { key: 'acidMelt',             label: 'Acid Melt',           icon: '🧪' },
  { key: 'turbulentSwirl',       label: 'Turbulent Swirl',     icon: '🌪️' },
  { key: 'waveWarpH',            label: 'Wave Warp H',         icon: '〰️' },
  { key: 'liquidFluidWipe',      label: 'Liquid Fluid',        icon: '🫗' },
  { key: 'magnifyingWave',       label: 'Magnify Wave',        icon: '🔍' },
  { key: 'glassShatter',         label: 'Glass Shatter',       icon: '💎' },
  { key: 'fractalNoiseTwist',    label: 'Fractal Twist',       icon: '🌌' },
  { key: 'twirlZoom',            label: 'Twirl Zoom',          icon: '🌀' },
  { key: 'stretchDistort',       label: 'Stretch Distort',     icon: '↔️' },
  { key: 'morphTrans',           label: 'Morph',               icon: '🔮' },
  { key: 'pageRoll',             label: 'Page Roll',           icon: '📜' },
  { key: 'rippleDissolve',       label: 'Ripple Dissolve',     icon: '🌊' },
  { key: 'vortexPull',           label: 'Vortex Pull',         icon: '🕳️' },
  { key: 'sphericalWarp',        label: 'Spherical Warp',      icon: '🌍' },

  // ─── SHAPE MASKS ──────────────────────────────────────────
  { key: 'heartExpand',          label: 'Heart Expand',        icon: '❤️' },
  { key: 'starWipe',             label: 'Star Wipe',           icon: '⭐' },
  { key: 'diamondMask',          label: 'Diamond Mask',        icon: '💎' },
  { key: 'multiCircleGrid',      label: 'Multi-Circle Grid',   icon: '⚫' },
  { key: 'hexagonTiles',         label: 'Hexagon Tiles',       icon: '⬡' },
  { key: 'diagonalSlats',        label: 'Diagonal Slats',      icon: '▨' },
  { key: 'triangleFan',          label: 'Triangle Fan',        icon: '🔺' },
  { key: 'spiralMatrix',         label: 'Spiral Matrix',       icon: '🌀' },
  { key: 'paintBrush',           label: 'Paint Brush',         icon: '🖌️' },
  { key: 'inkSplash',            label: 'Ink Splash',          icon: '💦' }
];

const MAP = {};
TRANSITIONS.forEach(function (t) { MAP[t.key] = t; });

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
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut   = function (t) { return 1 - Math.pow(1 - t, 3); };
const easeIn    = function (t) { return t * t * t; };

function drawPrev(ctx, W, H, prevCanvas, transform) {
  if (!prevCanvas) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  ctx.save();
  if (transform) transform(ctx);
  ctx.drawImage(prevCanvas, 0, 0, W, H);
  ctx.restore();
}

function drawCur(ctx, W, H, currentDraw, transform) {
  ctx.save();
  if (transform) transform(ctx);
  currentDraw(ctx, W, H);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DISPATCHER
// ═══════════════════════════════════════════════════════════════
export function renderTransitionBlend(ctx, W, H, prevCanvas, currentDraw, progress, type) {
  const p = Math.max(0, Math.min(1, progress));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  try {
    switch (type) {
      // ── FADES ───────────────────────────────────────────
      case 'fade':
      case 'dissolve':
        return renderFade(ctx, W, H, prevCanvas, currentDraw, p);

      case 'fadeBlack':
      case 'fadeWhite':
        return renderFadeColor(ctx, W, H, prevCanvas, currentDraw, p, type === 'fadeBlack' ? '#000' : '#fff');

      case 'blur':
      case 'gaussianBlurCross':
        return renderBlurCross(ctx, W, H, prevCanvas, currentDraw, p);

      case 'dipToColor':
        return renderDipColor(ctx, W, H, prevCanvas, currentDraw, p);

      case 'nonAdditiveDissolve':
        return renderNonAdditive(ctx, W, H, prevCanvas, currentDraw, p);

      case 'filmDissolve':
        return renderFilmDissolve(ctx, W, H, prevCanvas, currentDraw, p);

      case 'randomBlocksDissolve':
        return renderRandomBlocks(ctx, W, H, prevCanvas, currentDraw, p);

      case 'meltDissolve':
        return renderMelt(ctx, W, H, prevCanvas, currentDraw, p);

      case 'softSmudge':
        return renderSmudge(ctx, W, H, prevCanvas, currentDraw, p);

      case 'bokehBlurDissolve':
        return renderBokehDissolve(ctx, W, H, prevCanvas, currentDraw, p);

      // ── SLIDES ──────────────────────────────────────────
      case 'slideLeft':      return renderSlide(ctx, W, H, prevCanvas, currentDraw, p, 'left');
      case 'slideRight':     return renderSlide(ctx, W, H, prevCanvas, currentDraw, p, 'right');
      case 'slideUp':        return renderSlide(ctx, W, H, prevCanvas, currentDraw, p, 'up');
      case 'slideDown':      return renderSlide(ctx, W, H, prevCanvas, currentDraw, p, 'down');

      case 'slideOverLeft':   return renderSlideOver(ctx, W, H, prevCanvas, currentDraw, p, 'left');
      case 'slideOverRight':  return renderSlideOver(ctx, W, H, prevCanvas, currentDraw, p, 'right');
      case 'slideOverTop':    return renderSlideOver(ctx, W, H, prevCanvas, currentDraw, p, 'up');
      case 'slideOverBottom': return renderSlideOver(ctx, W, H, prevCanvas, currentDraw, p, 'down');

      // ── PUSH ────────────────────────────────────────────
      case 'pushLeft':   return renderPush(ctx, W, H, prevCanvas, currentDraw, p, 'left');
      case 'pushRight':  return renderPush(ctx, W, H, prevCanvas, currentDraw, p, 'right');
      case 'pushUp':     return renderPush(ctx, W, H, prevCanvas, currentDraw, p, 'up');
      case 'pushDown':   return renderPush(ctx, W, H, prevCanvas, currentDraw, p, 'down');

      // ── WIPES ───────────────────────────────────────────
      case 'wipeLeft':
      case 'wipeRight':
      case 'wipeHorizontal':
        return renderWipeH(ctx, W, H, prevCanvas, currentDraw, p, type === 'wipeLeft');
      case 'wipeVertical':
        return renderWipeV(ctx, W, H, prevCanvas, currentDraw, p);
      case 'wipeDiagonalTL':
        return renderWipeDiagonal(ctx, W, H, prevCanvas, currentDraw, p, 'tl');
      case 'wipeDiagonalBR':
        return renderWipeDiagonal(ctx, W, H, prevCanvas, currentDraw, p, 'br');
      case 'splitWipeVertical':
        return renderSplit(ctx, W, H, prevCanvas, currentDraw, p, 'vertical');
      case 'splitWipeHorizontal':
        return renderSplit(ctx, W, H, prevCanvas, currentDraw, p, 'horizontal');
      case 'checkerboardWipe':
        return renderCheckerboard(ctx, W, H, prevCanvas, currentDraw, p);
      case 'venetianBlinds':
        return renderVenetian(ctx, W, H, prevCanvas, currentDraw, p);
      case 'clockWipe':
        return renderClock(ctx, W, H, prevCanvas, currentDraw, p);
      case 'wedgeWipe':
        return renderWedge(ctx, W, H, prevCanvas, currentDraw, p);
      case 'irisBox':
        return renderIrisBox(ctx, W, H, prevCanvas, currentDraw, p);
      case 'irisCross':
        return renderIrisCross(ctx, W, H, prevCanvas, currentDraw, p);
      case 'circleIn':
        return renderCircleIn(ctx, W, H, prevCanvas, currentDraw, p);

      // ── ZOOMS ───────────────────────────────────────────
      case 'zoomIn':
      case 'smoothZoomIn':
        return renderZoom(ctx, W, H, prevCanvas, currentDraw, p, 'in', type === 'smoothZoomIn');
      case 'zoomOut':
      case 'smoothZoomOut':
        return renderZoom(ctx, W, H, prevCanvas, currentDraw, p, 'out', type === 'smoothZoomOut');
      case 'crossZoom':
        return renderCrossZoom(ctx, W, H, prevCanvas, currentDraw, p);
      case 'zoomBlur':
        return renderZoomBlur(ctx, W, H, prevCanvas, currentDraw, p);

      // ── SPINS ───────────────────────────────────────────
      case 'spinCW':
        return renderSpin(ctx, W, H, prevCanvas, currentDraw, p, 1, false);
      case 'spinCCW':
        return renderSpin(ctx, W, H, prevCanvas, currentDraw, p, -1, false);
      case 'spinZoomCombo':
        return renderSpin(ctx, W, H, prevCanvas, currentDraw, p, 1, true);
      case 'radialBlurSpin':
        return renderRadialBlurSpin(ctx, W, H, prevCanvas, currentDraw, p);
      case 'swirlDistort':
        return renderSwirl(ctx, W, H, prevCanvas, currentDraw, p);

      // ── 3D ──────────────────────────────────────────────
      case 'cubeFlipLeft':
        return render3DFlip(ctx, W, H, prevCanvas, currentDraw, p, 'left');
      case 'cubeFlipRight':
        return render3DFlip(ctx, W, H, prevCanvas, currentDraw, p, 'right');
      case 'pageFlip':
        return renderPageFlip(ctx, W, H, prevCanvas, currentDraw, p);
      case 'doorSwing':
        return renderDoorSwing(ctx, W, H, prevCanvas, currentDraw, p);
      case 'cardFlip':
        return renderCardFlip(ctx, W, H, prevCanvas, currentDraw, p);
      case 'flyBy':
        return renderFlyBy(ctx, W, H, prevCanvas, currentDraw, p);
      case 'zTumble':
        return renderZTumble(ctx, W, H, prevCanvas, currentDraw, p);
      case 'elasticZoomSpin':
        return renderElasticSpin(ctx, W, H, prevCanvas, currentDraw, p);

      // ── GLITCH ──────────────────────────────────────────
      case 'rgbSplit':
        return renderRGBSplit(ctx, W, H, prevCanvas, currentDraw, p);
      case 'hLineJitter':
        return renderHLineJitter(ctx, W, H, prevCanvas, currentDraw, p);
      case 'digitalBlock':
        return renderDigitalBlock(ctx, W, H, prevCanvas, currentDraw, p);
      case 'vcrStatic':
        return renderVCRStatic(ctx, W, H, prevCanvas, currentDraw, p);
      case 'dataMosh':
        return renderDataMosh(ctx, W, H, prevCanvas, currentDraw, p);
      case 'flickerFlash':
      case 'microStrobe':
        return renderFlicker(ctx, W, H, prevCanvas, currentDraw, p, type === 'microStrobe' ? 12 : 6);
      case 'sliceDistort':
        return renderSliceDistort(ctx, W, H, prevCanvas, currentDraw, p);
      case 'matrixScanline':
        return renderMatrixScanline(ctx, W, H, prevCanvas, currentDraw, p);
      case 'signalLoss':
        return renderSignalLoss(ctx, W, H, prevCanvas, currentDraw, p);
      case 'pixelSortWipe':
        return renderPixelSort(ctx, W, H, prevCanvas, currentDraw, p);
      case 'hwFreezeJitter':
        return renderFreezeJitter(ctx, W, H, prevCanvas, currentDraw, p);
      case 'chromaticDisp':
        return renderChromaticDisp(ctx, W, H, prevCanvas, currentDraw, p);
      case 'waveGlitch':
        return renderWaveGlitch(ctx, W, H, prevCanvas, currentDraw, p);
      case 'glitchDissolve':
        return renderGlitchDissolve(ctx, W, H, prevCanvas, currentDraw, p);

      // ── LIGHT ───────────────────────────────────────────
      case 'lensFlareFlash':
        return renderLensFlare(ctx, W, H, prevCanvas, currentDraw, p);
      case 'lightLeakOrange':
        return renderLightLeak(ctx, W, H, prevCanvas, currentDraw, p, '#ff8833');
      case 'neonGlowBurn':
        return renderNeonGlow(ctx, W, H, prevCanvas, currentDraw, p);
      case 'filmBurn':
        return renderFilmBurn(ctx, W, H, prevCanvas, currentDraw, p);
      case 'exposureFlash':
        return renderExposureFlash(ctx, W, H, prevCanvas, currentDraw, p);
      case 'colorInvertFlash':
        return renderColorInvert(ctx, W, H, prevCanvas, currentDraw, p);
      case 'rainbowPrism':
        return renderRainbowPrism(ctx, W, H, prevCanvas, currentDraw, p);
      case 'softVignetteFade':
        return renderSoftVignette(ctx, W, H, prevCanvas, currentDraw, p);
      case 'solarizeWipe':
        return renderSolarize(ctx, W, H, prevCanvas, currentDraw, p);
      case 'lightWipe':
        return renderLightWipe(ctx, W, H, prevCanvas, currentDraw, p);

      // ── LIQUID ──────────────────────────────────────────
      case 'waterRipple':
      case 'rippleDissolve':
        return renderRipple(ctx, W, H, prevCanvas, currentDraw, p, type === 'rippleDissolve');
      case 'acidMelt':
        return renderAcidMelt(ctx, W, H, prevCanvas, currentDraw, p);
      case 'turbulentSwirl':
        return renderTurbulentSwirl(ctx, W, H, prevCanvas, currentDraw, p);
      case 'waveWarpH':
        return renderWaveWarp(ctx, W, H, prevCanvas, currentDraw, p);
      case 'liquidFluidWipe':
        return renderLiquidWipe(ctx, W, H, prevCanvas, currentDraw, p);
      case 'magnifyingWave':
        return renderMagnifyWave(ctx, W, H, prevCanvas, currentDraw, p);
      case 'glassShatter':
        return renderGlassShatter(ctx, W, H, prevCanvas, currentDraw, p);
      case 'fractalNoiseTwist':
        return renderFractalTwist(ctx, W, H, prevCanvas, currentDraw, p);
      case 'twirlZoom':
        return renderTwirlZoom(ctx, W, H, prevCanvas, currentDraw, p);
      case 'stretchDistort':
        return renderStretch(ctx, W, H, prevCanvas, currentDraw, p);
      case 'morphTrans':
        return renderMorph(ctx, W, H, prevCanvas, currentDraw, p);
      case 'pageRoll':
        return renderPageRoll(ctx, W, H, prevCanvas, currentDraw, p);
      case 'vortexPull':
        return renderVortex(ctx, W, H, prevCanvas, currentDraw, p);
      case 'sphericalWarp':
        return renderSpherical(ctx, W, H, prevCanvas, currentDraw, p);

      // ── SHAPE MASKS ─────────────────────────────────────
      case 'heartExpand':
        return renderHeart(ctx, W, H, prevCanvas, currentDraw, p);
      case 'starWipe':
        return renderStar(ctx, W, H, prevCanvas, currentDraw, p);
      case 'diamondMask':
        return renderDiamond(ctx, W, H, prevCanvas, currentDraw, p);
      case 'multiCircleGrid':
        return renderMultiCircle(ctx, W, H, prevCanvas, currentDraw, p);
      case 'hexagonTiles':
        return renderHexTiles(ctx, W, H, prevCanvas, currentDraw, p);
      case 'diagonalSlats':
        return renderDiagonalSlats(ctx, W, H, prevCanvas, currentDraw, p);
      case 'triangleFan':
        return renderTriangleFan(ctx, W, H, prevCanvas, currentDraw, p);
      case 'spiralMatrix':
        return renderSpiralMatrix(ctx, W, H, prevCanvas, currentDraw, p);
      case 'paintBrush':
        return renderPaintBrush(ctx, W, H, prevCanvas, currentDraw, p);
      case 'inkSplash':
        return renderInkSplash(ctx, W, H, prevCanvas, currentDraw, p);

      // ── DEFAULT ─────────────────────────────────────────
      default:
        currentDraw(ctx, W, H);
    }
  } catch (e) {
    console.warn('[transition]', type, 'failed:', e);
    try { currentDraw(ctx, W, H); } catch (_) {}
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  try { ctx.filter = 'none'; } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  FADES / DISSOLVES
// ═══════════════════════════════════════════════════════════════
function renderFade(ctx, W, H, prev, cur, p) {
  if (prev) { ctx.globalAlpha = 1; ctx.drawImage(prev, 0, 0, W, H); }
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  ctx.globalAlpha = 1;
}

function renderFadeColor(ctx, W, H, prev, cur, p, col) {
  if (p < 0.5) {
    if (prev) { ctx.globalAlpha = 1; ctx.drawImage(prev, 0, 0, W, H); }
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = p * 2;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = (p - 0.5) * 2;
    cur(ctx, W, H);
    ctx.globalAlpha = 1;
  }
}

function renderBlurCross(ctx, W, H, prev, cur, p) {
  const blurAmt = (1 - Math.abs(p - 0.5) * 2) * 12;
  if (prev) {
    try { ctx.filter = 'blur(' + blurAmt + 'px)'; } catch (_) {}
    ctx.globalAlpha = 1;
    ctx.drawImage(prev, 0, 0, W, H);
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  try { ctx.filter = 'blur(' + blurAmt + 'px)'; } catch (_) {}
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

function renderDipColor(ctx, W, H, prev, cur, p) {
  // Dip through a mid-color (deep red)
  const col = '#6a0d3f';
  if (p < 0.5) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = p * 2 * 0.85;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = (p - 0.5) * 2;
    cur(ctx, W, H);
    ctx.globalAlpha = 1;
  }
}

function renderNonAdditive(ctx, W, H, prev, cur, p) {
  if (prev) { ctx.globalAlpha = 1; ctx.drawImage(prev, 0, 0, W, H); }
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = p * 0.85;
  cur(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function renderFilmDissolve(ctx, W, H, prev, cur, p) {
  if (prev) { ctx.globalAlpha = 1; ctx.drawImage(prev, 0, 0, W, H); }
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const pp = Math.max(0, Math.min(1, (p - i * 0.05) * 1.5));
    if (pp <= 0) continue;
    ctx.globalAlpha = pp * 0.18;
    cur(ctx, W, H);
  }
  ctx.globalAlpha = 1;
}

function renderRandomBlocks(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const cols = 12, rows = 20;
  const bw = W / cols, bh = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const rnd = ((x * 73 + y * 149) % 100) / 100;
      const local = Math.max(0, Math.min(1, (p - rnd * 0.55) / 0.45));
      if (local <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x * bw, y * bh, bw, bh);
      ctx.clip();
      ctx.globalAlpha = local;
      cur(ctx, W, H);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function renderMelt(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.translate(0, p * H * 0.3);
    try { ctx.filter = 'blur(' + (p * 6) + 'px)'; } catch (_) {}
    ctx.globalAlpha = 1 - p * 0.7;
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  ctx.globalAlpha = 1;
}

function renderSmudge(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.globalAlpha = 1 - p;
    try { ctx.filter = 'blur(' + (p * 4) + 'px)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    try { ctx.filter = 'none'; } catch (_) {}
  }
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  try { ctx.filter = 'blur(' + ((1 - p) * 4) + 'px)'; } catch (_) {}
  cur(ctx, W, H);
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

function renderBokehDissolve(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.globalAlpha = p;
  try { ctx.filter = 'blur(' + ((1 - p) * 8) + 'px)'; } catch (_) {}
  cur(ctx, W, H);
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  SLIDES
// ═══════════════════════════════════════════════════════════════
function renderSlide(ctx, W, H, prev, cur, p, dir) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  let ox = 0, oy = 0;
  if (dir === 'left')  ox = W * (1 - p);
  if (dir === 'right') ox = -W * (1 - p);
  if (dir === 'up')    oy = H * (1 - p);
  if (dir === 'down')  oy = -H * (1 - p);
  ctx.save();
  ctx.translate(ox, oy);
  cur(ctx, W, H);
  ctx.restore();
}

function renderSlideOver(ctx, W, H, prev, cur, p, dir) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  let ox = 0, oy = 0;
  if (dir === 'left')  ox = W * (1 - p);
  if (dir === 'right') ox = -W * (1 - p);
  if (dir === 'up')    oy = H * (1 - p);
  if (dir === 'down')  oy = -H * (1 - p);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 24;
  ctx.translate(ox, oy);
  cur(ctx, W, H);
  ctx.restore();
}

function renderPush(ctx, W, H, prev, cur, p, dir) {
  let px = 0, py = 0, cx = 0, cy = 0;
  if (dir === 'left')  { px = -W * p;          cx = W * (1 - p); }
  if (dir === 'right') { px = W * p;           cx = -W * (1 - p); }
  if (dir === 'up')    { py = -H * p;          cy = H * (1 - p); }
  if (dir === 'down')  { py = H * p;           cy = -H * (1 - p); }
  if (prev) {
    ctx.save(); ctx.translate(px, py); ctx.drawImage(prev, 0, 0, W, H); ctx.restore();
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.save(); ctx.translate(cx, cy); cur(ctx, W, H); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  WIPES
// ═══════════════════════════════════════════════════════════════
function renderWipeH(ctx, W, H, prev, cur, p, fromRight) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const revealW = W * p;
  ctx.save();
  ctx.beginPath();
  if (fromRight) ctx.rect(W - revealW, 0, revealW, H);
  else ctx.rect(0, 0, revealW, H);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderWipeV(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H * p);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderWipeDiagonal(ctx, W, H, prev, cur, p, dir) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const D = W + H;
  ctx.save();
  ctx.beginPath();
  if (dir === 'tl') {
    ctx.moveTo(0, 0);
    ctx.lineTo(D * p, 0);
    ctx.lineTo(0, D * p);
  } else {
    ctx.moveTo(W, H);
    ctx.lineTo(W - D * p, H);
    ctx.lineTo(W, H - D * p);
  }
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderSplit(ctx, W, H, prev, cur, p, axis) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.beginPath();
  const half = (axis === 'vertical' ? W : H) * p / 2;
  if (axis === 'vertical') {
    ctx.rect(W / 2 - half, 0, half * 2, H);
  } else {
    ctx.rect(0, H / 2 - half, W, half * 2);
  }
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderCheckerboard(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const cols = 10, rows = 16;
  const bw = W / cols, bh = H / rows;
  const total = cols * rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      const checker = (x + y) % 2;
      const order = checker === 0 ? idx / total : (idx + 1) / total;
      const local = Math.max(0, Math.min(1, (p - order * 0.5) / 0.5));
      if (local <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x * bw, y * bh, bw, bh);
      ctx.clip();
      ctx.globalAlpha = local;
      cur(ctx, W, H);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function renderVenetian(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const strips = 12;
  const sh = H / strips;
  for (let i = 0; i < strips; i++) {
    const local = Math.max(0, Math.min(1, (p - i * 0.03) / 0.7));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * sh, W, sh * local);
    ctx.clip();
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderClock(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const maxR = Math.sqrt(W * W + H * H) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2, H / 2);
  ctx.arc(W / 2, H / 2, maxR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderWedge(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const R = Math.sqrt(W * W + H * H);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2, H / 2);
  ctx.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderIrisBox(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const maxSize = Math.max(W, H) * 1.4;
  const side = maxSize * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2 - side / 2, H / 2 - side / 2, side, side);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderIrisCross(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const vW = W * 0.25 * p * 4;
  const hH = H * 0.25 * p * 4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2 - vW / 2, 0, vW, H);
  ctx.rect(0, H / 2 - hH / 2, W, hH);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderCircleIn(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const maxR = Math.sqrt(W * W + H * H) / 2;
  const r = maxR * p;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  ZOOMS
// ═══════════════════════════════════════════════════════════════
function renderZoom(ctx, W, H, prev, cur, p, mode, smooth) {
  const easeP = smooth ? easeOut(p) : p;
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const sc = mode === 'in' ? 0.5 + 0.5 * easeP : 2 - easeP;
  ctx.save();
  ctx.globalAlpha = easeP;
  ctx.translate(W / 2, H / 2);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderCrossZoom(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 + 0.4 * p;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const cs = 1.4 - 0.4 * p;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(cs, cs);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderZoomBlur(ctx, W, H, prev, cur, p) {
  if (prev) {
    try { ctx.filter = 'blur(' + (p * 10) + 'px)'; } catch (_) {}
    ctx.globalAlpha = 1 - p;
    ctx.drawImage(prev, 0, 0, W, H);
    try { ctx.filter = 'none'; } catch (_) {}
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const sc = 0.7 + 0.3 * p;
  ctx.save();
  try { ctx.filter = 'blur(' + ((1 - p) * 10) + 'px)'; } catch (_) {}
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  SPINS
// ═══════════════════════════════════════════════════════════════
function renderSpin(ctx, W, H, prev, cur, p, dir, withZoom) {
  const ang = dir * Math.PI * p * 2;
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p * 0.85;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(ang * 0.5);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const sc = withZoom ? 0.4 + 0.6 * easeOut(p) : 1;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-ang);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderRadialBlurSpin(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const local = Math.max(0, Math.min(1, (p - i * 0.06) * 1.2));
    if (local <= 0) continue;
    ctx.save();
    ctx.globalAlpha = local * 0.2;
    try { ctx.filter = 'blur(' + (i * 1.5) + 'px)'; } catch (_) {}
    ctx.translate(W / 2, H / 2);
    ctx.rotate(i * 0.02 * p);
    ctx.translate(-W / 2, -H / 2);
    cur(ctx, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

function renderSwirl(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 - p * 0.4;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.rotate(p * 1.5);
    ctx.translate(-W / 2, -H / 2);
    try { ctx.filter = 'blur(' + (p * 6) + 'px)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  const cs = 0.6 + 0.4 * easeOut(p);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-p * 1.5);
  ctx.scale(cs, cs);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  3D TRANSFORMS
// ═══════════════════════════════════════════════════════════════
function render3DFlip(ctx, W, H, prev, cur, p, dir) {
  const half = p < 0.5;
  const scaleX = Math.abs(Math.cos(Math.PI * p));
  const srcCv = half ? prev : null;
  const dstCv = half ? null : cur;
  const sign = dir === 'left' ? -1 : 1;

  if (half) {
    if (prev) {
      ctx.save();
      ctx.translate(W / 2, 0);
      ctx.scale(scaleX * sign, 1);
      ctx.translate(-W / 2, 0);
      ctx.drawImage(prev, 0, 0, W, H);
      ctx.restore();
    } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.scale(scaleX * sign, 1);
    ctx.translate(-W / 2, 0);
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderPageFlip(ctx, W, H, prev, cur, p) {
  if (p < 0.5) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    const w = W * (1 - p * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w, 0, W - w, H);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,' + (p * 0.3) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const w = W * (p - 0.5) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, H);
    ctx.clip();
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderDoorSwing(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const scaleX = Math.abs(Math.cos(Math.PI * p / 2));
  ctx.save();
  ctx.translate(0, 0);
  ctx.scale(scaleX, 1);
  try { ctx.filter = 'brightness(' + (0.5 + 0.5 * (1 - p)) + ')'; } catch (_) {}
  cur(ctx, W, H);
  ctx.restore();
  try { ctx.filter = 'none'; } catch (_) {}
}

function renderCardFlip(ctx, W, H, prev, cur, p) {
  const half = p < 0.5;
  const scaleY = Math.abs(Math.cos(Math.PI * p));
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(0, H / 2);
  ctx.scale(1, scaleY);
  ctx.translate(0, -H / 2);
  if (half) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
  } else {
    cur(ctx, W, H);
  }
  ctx.restore();
}

function renderFlyBy(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 + p * 1.5;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  const cs = 0.3 + 0.7 * easeOut(p);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(cs, cs);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderZTumble(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 - p * 0.5;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(p * Math.PI);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  const cs = 0.4 + 0.6 * p;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI + Math.PI * p);
  ctx.scale(cs, cs);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderElasticSpin(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const ep = easeOut(p);
  const overshoot = p < 1 ? Math.sin(p * Math.PI) * 0.08 : 0;
  const sc = 0.5 + 0.5 * ep + overshoot;
  const rot = (1 - ep) * Math.PI * 0.5;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.5);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  GLITCH
// ═══════════════════════════════════════════════════════════════
function renderRGBSplit(ctx, W, H, prev, cur, p) {
  const intensity = Math.sin(p * Math.PI) * 22;
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.globalAlpha = p;
  ctx.globalCompositeOperation = 'lighter';
  // Red channel
  ctx.save();
  ctx.translate(-intensity, 0);
  ctx.globalAlpha = 0.55;
  try { ctx.filter = 'url(#red)'; } catch (_) {}
  cur(ctx, W, H);
  ctx.restore();
  // Blue channel
  ctx.save();
  ctx.translate(intensity, 0);
  ctx.globalAlpha = 0.55;
  cur(ctx, W, H);
  ctx.restore();
  // Center
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = p * 0.8;
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function renderHLineJitter(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const lines = 24;
  const lh = H / lines;
  for (let i = 0; i < lines; i++) {
    const off = (Math.sin(p * 20 + i) * 20) * (1 - p);
    const local = Math.max(0, Math.min(1, p * 1.3 - i * 0.02));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * lh, W, lh);
    ctx.clip();
    ctx.globalAlpha = local;
    ctx.translate(off, 0);
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderDigitalBlock(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const cols = 14, rows = 22;
  const bw = W / cols, bh = H / rows;
  const total = cols * rows;
  const blocks = [];
  for (let i = 0; i < total; i++) blocks.push(i);
  // deterministic shuffle
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = (i * 73 + 41) % (i + 1);
    const tmp = blocks[i]; blocks[i] = blocks[j]; blocks[j] = tmp;
  }
  for (let n = 0; n < total; n++) {
    const idx = blocks[n];
    const order = n / total;
    const local = Math.max(0, Math.min(1, (p - order * 0.7) / 0.3));
    if (local <= 0) continue;
    const x = idx % cols, y = (idx - x) / cols;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x * bw, y * bh, bw, bh);
    ctx.clip();
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderVCRStatic(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  // static noise band
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  const bandH = H * 0.15;
  const bandY = (p * H * 2) % H;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 200; i++) {
    const x = (i * 137.5) % W;
    const y = bandY + (i * 3.7) % bandH;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.globalAlpha = 1;
}

function renderDataMosh(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 6; i++) {
      const off = Math.sin(p * 8 + i * 1.5) * 30 * (1 - p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.2;
      ctx.translate(off, 0);
      ctx.drawImage(prev, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  ctx.globalAlpha = 1;
}

function renderFlicker(ctx, W, H, prev, cur, p, count) {
  const flash = Math.floor(p * count * 2) % 2;
  if (flash === 0) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  } else {
    cur(ctx, W, H);
  }
  // occasional white flash
  if (Math.floor(p * count) % 4 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function renderSliceDistort(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const slices = 10;
  const sh = H / slices;
  for (let i = 0; i < slices; i++) {
    const seed = (i * 47) % 100 / 100;
    const local = Math.max(0, Math.min(1, (p - seed * 0.4) / 0.6));
    if (local <= 0) continue;
    const off = (seed - 0.5) * 80 * (1 - local);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * sh, W, sh);
    ctx.clip();
    ctx.translate(off, 0);
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderMatrixScanline(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.globalAlpha = p;
  cur(ctx, W, H);
  ctx.restore();
  // Scan line
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const lineY = (p * H * 1.5) % H;
  const grad = ctx.createLinearGradient(0, lineY - 40, 0, lineY + 40);
  grad.addColorStop(0, 'rgba(0,255,0,0)');
  grad.addColorStop(0.5, 'rgba(0,255,0,' + (0.7 * Math.sin(p * Math.PI)) + ')');
  grad.addColorStop(1, 'rgba(0,255,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, lineY - 40, W, 80);
  ctx.restore();
  // faint green grid
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function renderSignalLoss(ctx, W, H, prev, cur, p) {
  if (p < 0.5) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.save();
    ctx.globalAlpha = p * 2 * 0.85;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 400; i++) {
      const x = (i * 91.7) % W;
      const y = (i * 43.3) % H;
      const v = (i % 3 === 0) ? 0 : 255;
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = (p - 0.5) * 2;
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderPixelSort(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const cols = 30;
  const cw = W / cols;
  for (let i = 0; i < cols; i++) {
    const local = Math.max(0, Math.min(1, (p - i / cols * 0.6) / 0.4));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cw, 0, cw, H);
    ctx.clip();
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderFreezeJitter(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  if (p > 0.4) {
    const local = (p - 0.4) / 0.6;
    const jx = Math.sin(p * 60) * 6 * (1 - local);
    const jy = Math.cos(p * 55) * 6 * (1 - local);
    ctx.save();
    ctx.globalAlpha = local;
    ctx.translate(jx, jy);
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderChromaticDisp(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p * 0.5;
    try { ctx.filter = 'hue-rotate(' + (p * 60) + 'deg)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.save();
  ctx.globalAlpha = p;
  ctx.drawImage(ctx.canvas, 0, 0, W, H, -3 * (1 - p), 0, W, H);
  ctx.restore();
  ctx.globalAlpha = p;
  try { ctx.filter = 'hue-rotate(' + (-p * 60) + 'deg)'; } catch (_) {}
  cur(ctx, W, H);
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

function renderWaveGlitch(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const lines = 30;
  const lh = H / lines;
  for (let i = 0; i < lines; i++) {
    const off = Math.sin(p * 12 + i * 0.6) * 25 * (1 - p);
    const local = Math.max(0, Math.min(1, p * 1.4 - i * 0.02));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * lh, W, lh);
    ctx.clip();
    ctx.globalAlpha = local;
    ctx.translate(off, 0);
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderGlitchDissolve(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    try { ctx.filter = 'blur(' + (p * 5) + 'px)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  const jitterX = Math.sin(p * 40) * 8 * (1 - Math.abs(p - 0.5) * 2);
  ctx.save();
  ctx.globalAlpha = p;
  try { ctx.filter = 'blur(' + ((1 - p) * 5) + 'px)'; } catch (_) {}
  ctx.translate(jitterX, 0);
  cur(ctx, W, H);
  ctx.restore();
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  LIGHT
// ═══════════════════════════════════════════════════════════════
function renderLensFlare(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  // flare burst
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.3, 'rgba(255,220,150,0.5)');
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderLightLeak(ctx, W, H, prev, cur, p, col) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.75;
  const x = W * (0.3 + p * 0.5);
  const grad = ctx.createRadialGradient(x, H * 0.4, 0, x, H * 0.4, Math.max(W, H) * 0.9);
  grad.addColorStop(0, col);
  grad.addColorStop(0.5, 'rgba(255,120,60,0.35)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderNeonGlow(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const edgeP = Math.sin(p * Math.PI);
  ctx.globalAlpha = edgeP * 0.8;
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.7, 'rgba(0,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,0,255,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderFilmBurn(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
  const maxR = Math.max(W, H) * 0.7;
  const r = maxR * Math.sin(p * Math.PI);
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
  grad.addColorStop(0, 'rgba(255,240,100,0.9)');
  grad.addColorStop(0.4, 'rgba(255,100,0,0.6)');
  grad.addColorStop(0.7, 'rgba(120,20,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderExposureFlash(ctx, W, H, prev, cur, p) {
  if (p < 0.5) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,' + (p * 2) + ')';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = (p - 0.5) * 2;
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderColorInvert(ctx, W, H, prev, cur, p) {
  if (p < 0.5) {
    if (prev) ctx.drawImage(prev, 0, 0, W, H);
  } else {
    cur(ctx, W, H);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderRainbowPrism(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.75;
  const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
  const bw = W / colors.length;
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.25;
    ctx.fillRect(i * bw, 0, bw, H);
  }
  ctx.restore();
}

function renderSoftVignette(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  cur(ctx, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderSolarize(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const band = W * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, band, H);
  ctx.clip();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = 0.9;
  cur(ctx, W, H);
  ctx.restore();
  if (p > 0.9) {
    ctx.save();
    ctx.globalAlpha = (p - 0.9) * 10;
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderLightWipe(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const x = W * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, x, H);
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
  // bright beam at the wipe edge
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 80, 0, 160, H);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  LIQUID / WARP
// ═══════════════════════════════════════════════════════════════
function renderRipple(ctx, W, H, prev, cur, p, smoothEnd) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = smoothEnd ? (1 - p) : 1;
    const sc = 1 - p * 0.1;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  const r = Math.max(W, H) * p;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = smoothEnd ? p : 1;
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderAcidMelt(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    // draw prev in horizontal strips shifted by wave
    const strips = 30;
    const sh = H / strips;
    for (let i = 0; i < strips; i++) {
      const off = Math.sin(p * 8 + i * 0.8) * 25 * p;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, i * sh, W, sh);
      ctx.clip();
      ctx.drawImage(prev, off, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = p;
  const strips = 30;
  const sh = H / strips;
  for (let i = 0; i < strips; i++) {
    const off = Math.sin(p * 8 + i * 0.8) * 25 * (1 - p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * sh, W, sh);
    ctx.clip();
    ctx.translate(off, 0);
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderTurbulentSwirl(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 - p * 0.3;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(p * 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    try { ctx.filter = 'blur(' + (p * 5) + 'px)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  const cs = 0.5 + 0.5 * p;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-p * 2);
  ctx.scale(cs, cs);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderWaveWarp(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const strips = 40;
  const sh = H / strips;
  for (let i = 0; i < strips; i++) {
    const off = Math.sin(p * 6 + i * 0.4) * 20 * p;
    const local = Math.max(0, Math.min(1, p * 1.4 - i * 0.02));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * sh, W, sh);
    ctx.clip();
    ctx.translate(off, 0);
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderLiquidWipe(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const wave = Math.sin(i * 0.5) * 0.04;
    const local = Math.max(0, Math.min(1, (p + wave - i / steps * 0.7) / 0.3));
    if (local <= 0) continue;
    const cw = W / steps;
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cw, 0, cw, H * local);
    ctx.clip();
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderMagnifyWave(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const r = Math.sqrt(W * W + H * H) / 2 * p;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
  ctx.clip();
  const sc = 1 + 0.3 * (1 - p);
  ctx.translate(W / 2, H / 2);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
}

function renderGlassShatter(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const shards = 12;
  for (let i = 0; i < shards; i++) {
    const local = Math.max(0, Math.min(1, (p - i / shards * 0.5) / 0.5));
    if (local <= 0) continue;
    const ang = (i / shards) * Math.PI * 2;
    const bx = W / 2 + Math.cos(ang) * 30;
    const by = H / 2 + Math.sin(ang) * 30;
    const tx = Math.cos(ang) * W * 0.3 * (1 - local);
    const ty = Math.sin(ang) * H * 0.3 * (1 - local);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 80, by - 40);
    ctx.lineTo(bx + 60, by + 60);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderFractalTwist(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    const strips = 20;
    const sh = H / strips;
    for (let i = 0; i < strips; i++) {
      const off = Math.sin(i * 0.7 + p * 6) * 30 * p;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, i * sh, W, sh);
      ctx.clip();
      ctx.drawImage(prev, off, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = p;
  const strips = 20;
  const sh = H / strips;
  for (let i = 0; i < strips; i++) {
    const off = Math.sin(i * 0.7 + p * 6) * 30 * (1 - p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * sh, W, sh);
    ctx.clip();
    ctx.translate(off, 0);
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderTwirlZoom(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const sc = 0.5 + 0.5 * easeOut(p);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.rotate((1 - p) * Math.PI * 1.5);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderStretch(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1 + p * 0.5, 1 - p * 0.3);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 - (1 - p) * 0.5, 1 + (1 - p) * 0.3);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderMorph(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    try { ctx.filter = 'blur(' + (p * 8) + 'px)'; } catch (_) {}
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.save();
  ctx.globalAlpha = p;
  try { ctx.filter = 'blur(' + ((1 - p) * 8) + 'px)'; } catch (_) {}
  cur(ctx, W, H);
  ctx.restore();
  try { ctx.filter = 'none'; } catch (_) {}
  ctx.globalAlpha = 1;
}

function renderPageRoll(ctx, W, H, prev, cur, p) {
  if (prev) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W * (1 - p), H);
    ctx.clip();
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
    // rolled-up cylinder on right
    ctx.save();
    ctx.globalAlpha = 0.7;
    const cw = W * p * 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(W * (1 - p), 0, cw, H);
    ctx.restore();
  }
  if (p > 0.9) {
    ctx.save();
    ctx.globalAlpha = (p - 0.9) * 10;
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderVortex(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = 1 - p;
    ctx.save();
    ctx.globalAlpha = sc;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(p * Math.PI * 4);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(p, p);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderSpherical(ctx, W, H, prev, cur, p) {
  if (prev) {
    const sc = Math.sin(p * Math.PI / 2);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(prev, 0, 0, W, H);
    ctx.restore();
  }
  const cs = Math.sin(p * Math.PI / 2 + Math.PI / 2);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 + (1 - cs) * 0.4, 1 + (1 - cs) * 0.4);
  ctx.translate(-W / 2, -H / 2);
  cur(ctx, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  SHAPE MASKS
// ═══════════════════════════════════════════════════════════════
function renderHeart(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const s = Math.min(W, H) * 0.6 * p;
  ctx.save();
  ctx.beginPath();
  const cx = W / 2, cy = H / 2;
  ctx.moveTo(cx, cy + s * 0.5);
  ctx.bezierCurveTo(cx + s, cy - s * 0.2, cx + s * 0.5, cy - s, cx, cy - s * 0.5);
  ctx.bezierCurveTo(cx - s * 0.5, cy - s, cx - s, cy - s * 0.2, cx, cy + s * 0.5);
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderStar(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const R = Math.min(W, H) * 0.7 * p;
  const r = R * 0.5;
  const points = 5;
  ctx.save();
  ctx.beginPath();
  const cx = W / 2, cy = H / 2;
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderDiamond(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const s = Math.max(W, H) * p;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2, H / 2 - s / 2);
  ctx.lineTo(W / 2 + s / 2, H / 2);
  ctx.lineTo(W / 2, H / 2 + s / 2);
  ctx.lineTo(W / 2 - s / 2, H / 2);
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderMultiCircle(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const cols = 5, rows = 8;
  const cw = W / cols, ch = H / rows;
  const rad = Math.min(cw, ch) * 0.6 * p;
  ctx.save();
  ctx.beginPath();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = (x + 0.5) * cw;
      const cy = (y + 0.5) * ch;
      ctx.moveTo(cx + rad, cy);
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderHexTiles(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const size = Math.min(W, H) * p / 3;
  if (size <= 0) return;
  ctx.save();
  ctx.beginPath();
  const hexH = size * Math.sqrt(3);
  const stepX = size * 3;
  const stepY = hexH;
  for (let y = -hexH; y < H + hexH; y += stepY) {
    for (let x = -stepX; x < W + stepX; x += stepX) {
      const cx = x + (Math.floor(y / stepY) % 2) * stepX / 2;
      const cy = y;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const px = cx + Math.cos(ang) * size;
        const py = cy + Math.sin(ang) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderDiagonalSlats(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const slats = 5;
  const diag = Math.sqrt(W * W + H * H);
  const band = diag / slats;
  ctx.save();
  for (let i = 0; i < slats; i++) {
    const local = Math.max(0, Math.min(1, (p - i * 0.08) / 0.6));
    if (local <= 0) continue;
    ctx.save();
    ctx.beginPath();
    const start = i * band;
    ctx.moveTo(start, 0);
    ctx.lineTo(start + band * local, 0);
    ctx.lineTo(start + band * local - diag, diag);
    ctx.lineTo(start - diag, diag);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = local;
    cur(ctx, W, H);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderTriangleFan(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const pieces = 12;
  const cx = W / 2, cy = H / 2;
  const R = Math.sqrt(W * W + H * H);
  for (let i = 0; i < pieces; i++) {
    const local = Math.max(0, Math.min(1, (p - i / pieces * 0.5) / 0.5));
    if (local <= 0) continue;
    const a1 = (i / pieces) * Math.PI * 2;
    const a2 = ((i + 1) / pieces) * Math.PI * 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R * local, a1, a2);
    ctx.closePath();
    ctx.clip();
    cur(ctx, W, H);
    ctx.restore();
  }
}

function renderSpiralMatrix(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const arms = 8;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.sqrt(W * W + H * H) / 2;
  for (let a = 0; a < arms; a++) {
    const baseAng = (a / arms) * Math.PI * 2;
    for (let r = 0; r < maxR; r += 24) {
      const rad = r * p;
      const rot = baseAng + r * 0.008;
      const x = cx + Math.cos(rot) * rad;
      const y = cy + Math.sin(rot) * rad;
      const size = 22;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.clip();
      cur(ctx, W, H);
      ctx.restore();
    }
  }
}

function renderPaintBrush(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  // rough brush stroke path
  const baseY = H / 2;
  const thick = H * 0.4;
  ctx.moveTo(0, baseY - thick / 2);
  for (let x = 0; x <= W * p; x += 20) {
    const wobble = Math.sin(x * 0.03) * 20;
    ctx.lineTo(x, baseY - thick / 2 + wobble);
  }
  for (let x = W * p; x >= 0; x -= 20) {
    const wobble = Math.sin(x * 0.03 + 1) * 20;
    ctx.lineTo(x, baseY + thick / 2 + wobble);
  }
  ctx.closePath();
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}

function renderInkSplash(ctx, W, H, prev, cur, p) {
  if (prev) ctx.drawImage(prev, 0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const maxR = Math.sqrt(W * W + H * H) / 2;
  const r = maxR * p;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  // drips
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const dx = Math.cos(ang) * (r + 40 * p * Math.random());
    const dy = Math.sin(ang) * (r + 40 * p * Math.random());
    ctx.moveTo(cx + dx + 15, cy + dy);
    ctx.arc(cx + dx, cy + dy, 15, 0, Math.PI * 2);
  }
  ctx.clip();
  cur(ctx, W, H);
  ctx.restore();
}