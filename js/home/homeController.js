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

The editor supports TWO formats + BEATS mode:

═══════════════════════════════════════════════
FORMAT 1 — TIMESTAMPED LAYERS (recommended)
═══════════════════════════════════════════════

Optional first line:
  ratio 9:16        (or 16:9, 1:1, 4:5, 3:4, 21:9)

Then ONE block per layer, using [MM:SS - MM:SS]:

  [00:00 - 00:05] "Your text" animation typewriter, position center, color white
  [00:05 - 00:08] "Second" animation bounce, position bottom, color yellow
  [00:08 - 00:15] brightness 130, saturation 140
  [00:15 - 00:18] sticker 🔥 at 50 30
  [00:18 - 00:22] audio echo
  [00:22 - 00:28] vintage
  [00:28 - 00:35] "Next" font handwriting size 40 color ramp #ff0066 to #0066ff

═══════════════════════════════════════════════
TEXT LAYER PROPERTIES (after quoted text)
═══════════════════════════════════════════════

  animation <name>     typewriter, bounceIn, fadeIn, fadeUp, fadeDown,
                       slideLeft, slideRight, slideUp, slideDown, popIn,
                       zoomIn, zoomOut, glitch, pulse, wave, flip3DX,
                       flip3DY, rotate3D, flicker, shake, cinematicBlur,
                       scribble, decoder
                       (aliases: bounce→bounceIn, fade→fadeIn,
                        slide→slideUp, zoom→zoomIn, pop→popIn)

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

FONT CATEGORIES:
  music, educational, titles, handwriting, modern, bold,
  retro, elegant, playful, mono, cinematic, minimal

═══════════════════════════════════════════════
MULTI-STYLE TEXT (per-word styling)
═══════════════════════════════════════════════

Use [seg "word" props] for each styled segment:

  [00:00 - 00:05] [seg "i am" font handwriting size 20 color whitish] [seg "fine" font music size 60 color ramp #00FF87 to #60EFFF] position center

Each segment can have its own font, size, color, gradient.
Segments stack on separate lines.

═══════════════════════════════════════════════
OTHER LAYER TYPES
═══════════════════════════════════════════════

STICKER:
  [MM:SS - MM:SS] sticker 🔥 at 50 30

ADJUSTMENT (values 100-300 = filter scale; -100 to 100 = adjustment scale):
  [MM:SS - MM:SS] brightness 130, saturation 140
  Keys: brightness, contrast, exposure, whites, blacks, shadows,
        highlights, clarity, saturation, vibrance, temperature,
        tint, noise, sharpen, vignette
  Color channels: reds, oranges, yellows, greens, cyans, blues,
                  purples, magentas, skintones

FILTER:
  [MM:SS - MM:SS] blur 5
  [MM:SS - MM:SS] grayscale 80

EFFECT PRESET:
  [MM:SS - MM:SS] vintage
  Presets: shake, bounce, pulse, zoomPulse, glitch, wobble,
           warm, cool, vintage, cinematic, bw, dreamy, vivid,
           faded, dramatic, negative, softGlow, noir

COLOR WHEEL:
  [MM:SS - MM:SS] shadows red 50 40
  [MM:SS - MM:SS] hdr 120

CHROMA KEY:
  [MM:SS - MM:SS] green screen

AUDIO FX:
  [MM:SS - MM:SS] audio echo
  Keys: studio, warm, bright, vocal, podcast, deep, monster,
        chipmunk, baby, robot, echo, reverb, cave, stadium,
        telephone, underwater, whisper, radio

═══════════════════════════════════════════════
LAYER TRANSITIONS (comma-separated, per-layer)
═══════════════════════════════════════════════

Transitions apply to the START of each clip on a layer.
The FIRST clip of a layer is skipped (it has no preceding clip).

BASIC:
  layer v1 transitions fade, dissolve, slide left, zoom
  transitions fade, dissolve, slide          (uses selected clip's layer)

  Each type applies to clip #2, #3, #4, ... in order.

WITH DURATION:
  layer v1 transitions fade 0.5, dissolve 0.8, zoom 1
  Duration range: 0.1-3.0s. Default: 0.5s

SKIP A JUNCTION:
  layer v1 transitions dissolve, null, slide, null, zoom
  Use null / none / skip / - to skip.

LOOP:
  layer v1 transitions fade, dissolve loop
  Pattern repeats across all clips.

TRANSITION TYPES:
  fade, dissolve, fade black, fade white,
  slide left, slide right, slide up, slide down,
  zoom in, zoom out,
  wipe left, wipe right, circle in, blur

SHORTCUTS:
  transition all <type> [<dur>]              → all layers, all junctions
  transition at <time> <type> [<dur>]        → clips starting at <time>±0.2s

═══════════════════════════════════════════════
🥁 BEATS EDITING (audio-driven)
═══════════════════════════════════════════════

STEP 1 — DETECT BEATS (on selected AUDIO clip):
  detect beats

  The audio clip gets analyzed. Beat timestamps are saved inside the clip.

STEP 2 — BEATS EDIT (with selected VISUAL clips):
  beats edit <effect1>, <effect2>, <effect3>, ...

  What happens:
  1. Selected visual clips get distributed across the audio's beat times.
     - If clips < beats → clips loop (auto-cloned)
     - If clips > beats → extra clips unused
     - Each clip duration = average gap between beats
  2. A new effect track is created ABOVE the clips.
  3. Effects are applied cyclically on each beat:
       beat 0 → effect1, beat 1 → effect2, beat 2 → effect3, beat 3 → effect1, ...

EFFECT KEYS for beats edit:
  Motion:  shake, bounce, pulse, zoom, glitch, wobble, rotate, flicker
  Color:   warm, cool, vivid, bw, noir, vintage, cinematic, flash, fade, dreamy

EXAMPLES:
  beats edit shake
  beats edit shake, zoom
  beats edit shake, zoom, pulse
  beats edit zoom, pulse, glitch
  beats edit warm, cool, vivid
  beats edit shake, flash, zoom
  beats edit pulse, zoom, shake, glitch

TYPICAL WORKFLOW:
  1. Import audio + images.
  2. Select the audio clip → "detect beats"
  3. Multi-select visual clips (⏩ button) → "beats edit shake, zoom, pulse"

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
EXAMPLES
═══════════════════════════════════════════════

Intro:
  ratio 9:16
  [00:00 - 00:05] "Welcome" animation typewriter, position center, color white
  [00:05 - 00:08] "Bounce" animation bounce, position bottom, color yellow

Transitions (4 clips on V1):
  layer v1 transitions fade 0.5, dissolve 0.8, slide left 0.6, zoom 1

Beats workflow:
  Step 1 (select audio):  detect beats
  Step 2 (select visuals): beats edit shake, zoom, pulse

Mixed:
  brightness 120, layer v1 transitions fade, dissolve, slide, zoom, saturation 140

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

1. Start with "ratio X:Y" if user specifies aspect ratio.
2. Timestamps: MM:SS or HH:MM:SS.
3. Text MUST be in "double quotes".
4. Properties are comma-separated.
5. Layer transitions: put the ENTIRE comma-list inside ONE command.
6. Beats edit: effect names separated by commas, in ONE command.
7. Transition names with spaces (not hyphens): "slide left" ✓, "slide-left" ✗

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