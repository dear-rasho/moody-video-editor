// ================================================================
//  js/home/homeController.js
//  Home page buttons: new project + code base editor
// ================================================================

export function initHomeController({ onNewProject, onCodeEditor }) {
  const newBtn = document.querySelector('#new-project-btn');
  if (newBtn && typeof onNewProject === 'function') {
    newBtn.addEventListener('click', onNewProject);
  }

  // 🆕 Code Base Editor button
  const codeBtn = document.querySelector('#codebase-new-btn');
  if (codeBtn && typeof onCodeEditor === 'function') {
    codeBtn.addEventListener('click', onCodeEditor);
  }
}

// ═══════════════════════════════════════════════════════════════
//  🆕 Render Code Base shelf — sample cards
// ═══════════════════════════════════════════════════════════════
export function initCodebaseShelf(container, { onOpen } = {}) {
  if (!container) return;

  const items = [
    {
      icon: '＋',
      title: 'New Code Project',
      desc: 'Start from scratch. Use text prompts to edit video, add filters, effects, and more.'
    },
    {
      icon: '📚',
      title: 'Prompt Examples',
      desc: 'Browse ready-made prompts — brightness, fade, zoom, text overlay and more.'
    }
  ];

  container.replaceChildren();

  items.forEach((item, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'codebase-card';
    card.setAttribute('role', 'listitem');

    const icon = document.createElement('div');
    icon.className = 'codebase-card-icon';
    icon.textContent = item.icon;

    const title = document.createElement('h3');
    title.className = 'codebase-card-title';
    title.textContent = item.title;

    const desc = document.createElement('p');
    desc.className = 'codebase-card-desc';
    desc.textContent = item.desc;

    card.append(icon, title, desc);

    card.addEventListener('click', () => {
      if (typeof onOpen === 'function') {
        onOpen(idx === 0 ? 'new' : 'examples');
      }
    });

    container.appendChild(card);
  });
}
// ═══════════════════════════════════════════════════════════════
//  🆕 AI PROMPT HELPER
// ═══════════════════════════════════════════════════════════════
export function initAiPromptHelper() {
  const textEl = document.querySelector('#ai-prompt-text');
  const copyBtn = document.querySelector('#ai-prompt-copy-btn');
  if (!textEl || !copyBtn) return;

  const PROMPT_TEXT =
`You are helping me write commands for a video editor's prompt panel.

The editor supports TWO formats + BEATS mode + TRANSITIONS + ANIMATIONS.

═══════════════════════════════════════════════
FORMAT 1 — TIMESTAMPED LAYERS (recommended)
═══════════════════════════════════════════════

Optional first line:
  ratio 9:16        (or 16:9, 1:1, 4:5, 3:4, 21:9)

Then ONE block per layer, using [MM:SS - MM:SS]:

  [00:00 - 00:05] "Your text" animation typewriter, position center, color white
  [00:05 - 00:08] brightness 130, saturation 140
  [00:08 - 00:15] sticker 🔥 at 50 30
  [00:15 - 00:18] audio echo
  [00:18 - 00:22] vintage
  [00:22 - 00:28] "Next" font handwriting size 40 color ramp #ff0066 to #0066ff

═══════════════════════════════════════════════
FORMAT 2 — SIMPLE (no timestamps, at playhead)
═══════════════════════════════════════════════

  brightness 120, contrast 110
  vintage, shake
  text "Hello" size 48 color #ff0066
  zoom 100 to 200 over 3s
  speed 2x
  fade in 0.5
  audio echo
  sticker 😀
  trim left

═══════════════════════════════════════════════
TEXT LAYER PROPERTIES (after quoted text)
═══════════════════════════════════════════════

  animation <name>     See "ANIMATIONS" section (100+)
  position <name>      top, bottom, center, left, right
  position <X> <Y>     coords 0-100, e.g. 50 30
  color <name|#hex>    white, black, red, gold, #ff0066
  color ramp #A to #B  gradient
  font <name|category> specific font OR category
  size <number>        font size px (default 36)
  bold | italic        style flags
  shadow               drop shadow on
  stroke <w> <#hex>    text outline
  align left|center|right
  scale <number>       text scale %
  rotation <number>    degrees
  opacity <number>     0-100

═══════════════════════════════════════════════
FONT CATEGORIES
═══════════════════════════════════════════════

  custom        → 22 bundled offline fonts (Shockwave, Pricedown, Fighter Attack, etc.)
  system        → Arial, Segoe UI, Helvetica, etc.
  serif         → Times New Roman, Georgia, etc.
  mono          → Courier New, Consolas, etc.
  display       → Impact, Bebas Neue, Anton, etc.
  handwriting   → Comic Sans, Brush Script, Dancing Script, etc.
  elegant       → Playfair Display, Cormorant, etc.
  modern        → Poppins, Montserrat, Inter, etc.
  titles        → Poppins, Montserrat, Cinzel, etc.
  music         → Bebas Neue, Anton, etc.
  playful       → Comic Sans, Fredoka, etc.
  retro         → Lobster, Pacifico, etc.
  educational   → Open Sans, Lato, etc.
  cinematic     → Cinzel, Playfair Display, etc.
  minimal       → Inter, Roboto, DM Sans, etc.

LOCAL FONTS (offline, best quality):
  Shockwave, Pricedown, Fighter Attack, Legendary Brush, Funky Groove,
  Eighties, Funkora, Christmas Music, Chopin Script, Rockybilly,
  Musiclife, Orchard Song, Gwathlyn, Amita, Bangela, Brisound,
  Daffiys, Kaway, Komika, Forceless Demo, Rengkox, Rumburak

═══════════════════════════════════════════════
MULTI-STYLE TEXT (per-word)
═══════════════════════════════════════════════

  [00:00 - 00:05] [seg "i am" font handwriting size 20 color whitish] [seg "fine" font music size 60 color ramp #00FF87 to #60EFFF] position center

═══════════════════════════════════════════════
ANIMATIONS (100+ names)
═══════════════════════════════════════════════

BASIC: typewriter, decoder, fadeIn, fadeUp, fadeDown, slideLeft, slideRight,
       slideUp, slideDown, popIn, bounceIn, flicker, cinematicBlur

REVEALS: wordReveal, characterRise, maskVertical, maskHorizontal, centerOut,
         lineDraw, blurryReveal, smokeDissolve, trailFade

GLITCH: glitch, rgbSplit, sliceGlitch, blockGlitch, staticNoise, vcrDistort,
        shakeJitter, cyberpunk, matrixRain, interlaced

WAVES: wave, bounceWave, sineWave, liquidMelt, flagWave, waterRipple,
       heatWave, elasticWave, pulsingWave, turbulent, circularWave

BOUNCES: overshootPop, elasticDrop, jellyBounce, microBounce, stompBounce,
         squeezeStretch, float, diagonalJump, gravityFall, heavyLanding,
         doubleBounce, bouncySpin, snapBack, springString, sideKick

SLIDERS: flyDiagonalTL, flyDiagonalBR, crossSlide, accelSlide, decelSlide,
         splitSlide, zigzagSlide, smoothGlide, infiniteScroll, pushSlide

ROTATIONS: flip3DX, flip3DY, rotate3D, yAxisFlip, xAxisFlip, vortexSpin,
           zAxisSpin, spiralIn, tornado, skewSpin, pendulum, propeller,
           barrelRoll, cubeRoll, gentleTilt, twister

ZOOMS: zoomIn, zoomOut, cinematicZoom, hyperZoomOut, pulseScale,
       elasticZoom, lensFlareZoom, shrinkReveal, popScale, depthZoom, snapZoom

SPECIAL: scribble, neonGlow, gradientShift, ghostTrail, silhouette,
         explosion, implosion, pulse, shake

═══════════════════════════════════════════════
ADJUSTMENT KEYS
═══════════════════════════════════════════════

brightness, contrast, exposure, whites, blacks, shadows, highlights,
clarity, saturation, vibrance, temperature, tint, noise, sharpen, vignette

Color channels: reds, oranges, yellows, greens, cyans, blues,
                purples, magentas, skintones

Format:   brightness 120, saturation 130, shadows 30

═══════════════════════════════════════════════
FILTER KEYS
═══════════════════════════════════════════════

grayscale, sepia, invert, blur, hue, opacity

Format:   grayscale 80, blur 5, invert 100

═══════════════════════════════════════════════
COLOR WHEELS
═══════════════════════════════════════════════

Format:   shadows <color> <sat> <intensity>
          midtones <color> <sat> <intensity>
          highlights <color> <sat> <intensity>
          hdr <0-200>

Colors: red, orange, yellow, lime, green, teal, cyan, sky, blue,
        indigo, purple, violet, magenta, pink, rose, gold, white, black

Examples:
  shadows teal 65 70, midtones sky 30 25, highlights orange 55 65, hdr 105
  (classic teal-and-orange cinematic grade)

═══════════════════════════════════════════════
EFFECT PRESETS (color grades + motion)
═══════════════════════════════════════════════

COLOR GRADES:
  warm, cool, vintage, cinematic, bw, dreamy, vivid, faded, dramatic,
  negative, softGlow, noir, tealOrange, hollywood, blockbuster, filmLook,
  drama, epic, thriller, bleach, bleachBypass, sepiaMem, retro8mm, kodak,
  polaroid, oldFilm, antique, monochrome, filmNoir, cyberpunk, vaporwave,
  synthwave, plasma, electric, techno, neonCity, gold, sunrise, sunset,
  goldenHour, amber, ember, copper, autumn, moonlight, midnight, ice,
  frost, ocean, sky, deepBlue, moody, darkDrama, grunge, gritty, somber,
  infrared, matrix, thermal, xray, negativeSoft, duotone, spectrum,
  hyperSat, softFocus, pastel, creamy, haze, bloom, ethereal, hdr,
  punchy, dynamic, vividHard, contrastMax, sepia, brownTone, coffee,
  flashWhite, flashSoft, lightBurst, overexpose

MOTION (also usable standalone):
  shake, tremor, quake, earthquake, hit, impact, jolt, rumble, vibration,
  micro, jitter, chaos, turbulent, bounce, punch, kick, throb, beat, drop,
  spring, elastic, boing, headbang, pulse, heartbeat, breath, pump, thump,
  drum, zoomPulse, zoomHard, zoomSoft, push, pull, rush, slam, wobble,
  swing, sway, rock, spin, roll, whirl, pendulum, tilt, drift, glitch,
  noise, digital, rgbSplit, pixel, stutter, tear, vhs, staticFx, tracking,
  datamosh, signalLoss, flicker, strobe, flashFast, tv, lightning, blink, spark

═══════════════════════════════════════════════
OVERLAY EFFECTS (30+ visual layers)
═══════════════════════════════════════════════

PARTICLES:
  rain, snow, dust, sparks, embers, stars, bokeh, fireFlies

ATMOSPHERE:
  fog, smoke, haze, mist

NOISE / TEXTURE:
  noise, filmGrain, blackNoise, whiteNoise, scanlines, staticTV

LIGHT:
  lightLeak, lensFlare, bloom, sunburst, godRays

FLICKER:
  flicker, strobe, pulseFx, blink

TONE WASH:
  blueLake, warmWash, coolWash, tealWash, roseWash

EDGES:
  sharpenEdges, edgeGlow

MISC:
  vignette, blackBars, vhsLines, glitchBars

═══════════════════════════════════════════════
TRANSITIONS (100+ names)
═══════════════════════════════════════════════

BASIC:
  fade, dissolve, fade black, fade white, blur

PUSH:
  pushLeft, pushRight, pushUp, pushDown

SLIDE OVER:
  slideOverLeft, slideOverRight, slideOverTop, slideOverBottom

SLIDE IN:
  slide left, slide right, slide up, slide down

WIPES:
  wipe left, wipe right, wipeHorizontal, wipeVertical,
  wipeDiagonalTL, wipeDiagonalBR, splitWipeVertical, splitWipeHorizontal,
  checkerboardWipe, venetianBlinds, clockWipe, wedgeWipe,
  irisBox, irisCross, circle in

ZOOMS:
  zoom in, zoom out, smoothZoomIn, smoothZoomOut, crossZoom, zoomBlur

SPINS:
  spinCW, spinCCW, spinZoomCombo, radialBlurSpin, swirlDistort

3D:
  cubeFlipLeft, cubeFlipRight, pageFlip, doorSwing, cardFlip,
  flyBy, zTumble, elasticZoomSpin

GLITCH:
  rgbSplit, hLineJitter, digitalBlock, vcrStatic, dataMosh,
  flickerFlash, sliceDistort, matrixScanline, signalLoss,
  pixelSortWipe, hwFreezeJitter, chromaticDisp, waveGlitch,
  microStrobe, glitchDissolve

FADES / DISSOLVES:
  dipToColor, gaussianBlurCross, dirBlurLeft, dirBlurRight,
  bokehBlurDissolve, nonAdditiveDissolve, filmDissolve,
  randomBlocksDissolve, meltDissolve, softSmudge

LIGHT & COLOR:
  lensFlareFlash, lightLeakOrange, neonGlowBurn, filmBurn,
  exposureFlash, colorInvertFlash, rainbowPrism, softVignetteFade,
  solarizeWipe, lightWipe

LIQUID & WARP:
  waterRipple, acidMelt, turbulentSwirl, waveWarpH, liquidFluidWipe,
  magnifyingWave, glassShatter, fractalNoiseTwist, twirlZoom,
  stretchDistort, morphTrans, pageRoll, rippleDissolve,
  vortexPull, sphericalWarp

SHAPES:
  heartExpand, starWipe, diamondMask, multiCircleGrid, hexagonTiles,
  diagonalSlats, triangleFan, spiralMatrix, paintBrush, inkSplash

HOW TO USE:
  layer <Vn|An> transitions <name1>, <name2>, <name3>, ...
  transitions <name1>, <name2>, ...               (uses selected clip)

Rules:
  • The FIRST clip on a layer is skipped (no preceding clip)
  • Each transition applies to the START of clips 2, 3, 4, ...
  • Add "loop" at end to repeat the pattern across all clips
  • Use "auto" for random variety — no repeats back-to-back
  • Add duration: <name> 0.5 (default 0.5s, range 0.1-3.0s)

Examples:
  layer v1 transitions fade, dissolve, slide left, zoom
  layer v1 transitions pushLeft, pushRight, spinCW, vortexPull, heartExpand
  layer v1 transitions rgbSplit 0.3, glitchDissolve 0.4, filmBurn 0.5
  layer v1 transitions auto                          (random variety)
  layer v1 transitions auto loop                     (random, loops)
  layer v1 transitions fade, dissolve loop           (pattern loops)

SHORTCUTS:
  transition all <type> [<dur>]         → all layers, all junctions
  transition at <time> <type> [<dur>]   → clips starting at <time>±0.2s

═══════════════════════════════════════════════
🥁 BEATS EDITING (audio-driven)
═══════════════════════════════════════════════

STEP 1 — DETECT BEATS (on selected AUDIO clip):
  detect beats
  detect beats hard              (only HARD beats)
  detect beats medium            (only MEDIUM beats)
  detect beats soft              (only SOFT beats)
  detect beats hard,med          (HARD + MEDIUM)
  detect beats med,soft          (MEDIUM + SOFT)
  detect beats 0.3-0.5           (numeric strength range)

  Synonyms: heavy/strong/loud → hard, mid/normal → med,
            low/quiet/light → soft

STEP 2 — BEATS EDIT (with selected VISUAL clips):
  beats edit <effect1>, <effect2>, ...

  What happens:
  1. Selected visual clips get distributed across beat times
  2. If clips < beats → clips auto-clone and loop
  3. New effect track created ABOVE clips
  4. Effects cycle per beat

STRENGTH-AWARE SYNTAX:
  beats edit hard: shake+glow ; rest: zoom, pulse, bounce

  Sections separated by ;
  Groups: hard: / med: / soft: / rest:
  + stacks effects on SAME beat
  , cycles effects across beats

EXAMPLES:
  beats edit shake, zoom, pulse
  beats edit hard: shake+glow ; rest: zoom, pulse, bounce
  beats edit hard: shake+glow, bounce+flash ; med: zoom, pulse ; soft: fade, dreamy
  beats edit null, null, shake, null, null, zoom       (effect every 3rd beat)
  beats edit null, null, shake+glow ; rest: null       (only every 3rd, hard only)

═══════════════════════════════════════════════
📋 DUPLICATE CLIPS
═══════════════════════════════════════════════

  duplicate                    → duplicate selected clip(s)
  duplicate 3                  → duplicate selected 3 times
  duplicate all                → duplicate all clips on V1
  duplicate all 2              → duplicate all, 2 layers
  duplicate layer v1           → duplicate all clips on V1
  duplicate layer v2 3         → duplicate V2 clips 3 times
  duplicate layer a1           → duplicate A1 audio clips

  Selected clips can be:
    • Single clip (just select it)
    • Multiple clips (⏩ / ⏪ multi-select)
    • Whole layer (use "duplicate all" or "duplicate layer v1")

  Result: copies go to the NEXT track above, with fresh IDs.

═══════════════════════════════════════════════
CHROMA KEY
═══════════════════════════════════════════════

  green screen
  blue screen
  chroma #00ff00
  chroma #00ff00 similarity 30
  chroma #0000ff intensity 80

═══════════════════════════════════════════════
AUDIO FX KEYS
═══════════════════════════════════════════════

studio, warm, bright, vocal, podcast, deep, monster, chipmunk, baby,
robot, echo, reverb, cave, stadium, telephone, underwater, whisper, radio

Format: audio echo
        audio monster, reverb    (stack multiple)

═══════════════════════════════════════════════
STICKER
═══════════════════════════════════════════════

  sticker 🔥
  sticker 🔥 at 50 30
  sticker 😀 at 20 80 size 150

═══════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════

Intro with transitions:
  ratio 9:16
  [00:00 - 00:05] "Welcome" animation typewriter, position center, color white
  [00:05 - 00:08] brightness 130, saturation 140
  layer v1 transitions pushLeft, spinCW, vortexPull

Beats workflow:
  Step 1 (audio selected):   detect beats hard
  Step 2 (visuals selected): beats edit hard: shake+glow ; rest: zoom, pulse, bounce

Cinematic grade:
  brightness 95, contrast 115, shadows -20, highlights 15, vibrance 20, vignette 35, shadows teal 65 70, midtones sky 30 25, highlights orange 55 65, hdr 105

Animation stack:
  ratio 9:16
  [00:00 - 00:03] "Rise" font titles size 92 bold, animation overshootPop, color ramp #ffcc00 to #ff0066, shadow
  [00:01 - 00:03] "ABOVE" font modern size 32, animation flip3DY, color #60EFFF
  [00:02 - 00:03] "NOISE" font handwriting size 88, animation vortexSpin, color gold

Overlay weather:
  rain, blueLake, vignette 40

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

1. Start with "ratio X:Y" if user specifies aspect ratio.
2. Timestamps: MM:SS or HH:MM:SS.
3. Text MUST be in "double quotes".
4. Properties are comma-separated.
5. Layer transitions: put the ENTIRE comma-list inside ONE command.
6. Beats edit: effect names separated by commas, in ONE command.
7. Transition names with spaces (not hyphens): "slide left" ✓
8. Do NOT exceed 3 seconds per effect unless user specifies otherwise.

MY REQUEST: [yahan apna request likho]

Return ONLY the editor commands. No explanation.`;

  textEl.textContent = PROMPT_TEXT;

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEXT);
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋 Copy Prompt';
      }, 1800);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = PROMPT_TEXT;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();

      copyBtn.classList.add('copied');
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋 Copy Prompt';
      }, 1800);
    }
  });
}