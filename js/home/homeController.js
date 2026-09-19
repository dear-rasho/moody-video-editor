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

The editor supports TWO formats:

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
  [MM:SS - MM:SS] sticker 🔥
  [MM:SS - MM:SS] sticker 🔥 at 50 30
  [MM:SS - MM:SS] sticker 😀 at 20 80 size 150

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
  [MM:SS - MM:SS] sepia 50, invert 100

EFFECT PRESET (single word):
  [MM:SS - MM:SS] vintage
  [MM:SS - MM:SS] cinematic
  Presets: shake, bounce, pulse, zoomPulse, glitch, wobble,
           warm, cool, vintage, cinematic, bw, dreamy, vivid,
           faded, dramatic, negative, softGlow, noir

COLOR WHEEL:
  [MM:SS - MM:SS] shadows red 50 40
  [MM:SS - MM:SS] midtones blue 40 50
  [MM:SS - MM:SS] hdr 120

CHROMA KEY:
  [MM:SS - MM:SS] green screen
  [MM:SS - MM:SS] chroma #00ff00 similarity 30

AUDIO FX:
  [MM:SS - MM:SS] audio echo
  Keys: studio, warm, bright, vocal, podcast, deep, monster,
        chipmunk, baby, robot, echo, reverb, cave, stadium,
        telephone, underwater, whisper, radio

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
  split

═══════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════

Intro:
  ratio 9:16
  [00:00 - 00:05] "Welcome" animation typewriter, position center, color white
  [00:05 - 00:08] "Bounce" animation bounce, position bottom, color yellow
  [00:08 - 00:15] brightness 130, saturation 140

Typography:
  ratio 9:16
  [00:00 - 00:05] [seg "i am" font handwriting size 20 color whitish] [seg "fine" font music size 60 color ramp #00FF87 to #60EFFF] position center

Full mix:
  ratio 9:16
  [00:00 - 00:05] "Intro" font music size 60 position center, animation typewriter
  [00:00 - 00:05] brightness 110, saturation 130
  [00:05 - 00:08] sticker 🔥 at 50 30
  [00:08 - 00:15] "Main content" font handwriting size 36 color ramp #ff0066 to #0066ff, position center, animation bounce
  [00:15 - 00:18] audio echo
  [00:18 - 00:25] "Thanks" font cinematic size 42 color gold, position bottom, animation fadeUp

Music video:
  ratio 9:16
  [00:00 - 00:04] [seg "WE" font music size 72 color #ff0066] [seg "ARE" font music size 72 color #00FF87] [seg "LIVE" font music size 72 color #60EFFF] position center, animation bounce

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

1. Start with "ratio X:Y" if user specifies aspect ratio.
2. Timestamps: MM:SS or HH:MM:SS.
3. Each [MM:SS - MM:SS] block is a separate timeline layer.
4. Text MUST be in "double quotes".
5. Non-timestamped commands use the first text layer's duration.
6. Properties are comma-separated.

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
      // Fallback for older browsers
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