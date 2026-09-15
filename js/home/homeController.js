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

The editor supports these commands (comma-separated):

ADJUSTMENTS (value: -100 to 100):
brightness, contrast, exposure, whites, blacks, shadows,
highlights, clarity, saturation, vibrance, temperature,
tint, noise, sharpen, vignette

COLOR CHANNELS (value: -100 to 100):
reds, oranges, yellows, greens, cyans, blues, purples,
magentas, skintones

FILTERS:
grayscale, sepia, invert, blur (0-20), hue (0-360), opacity (0-100)

EFFECT PRESETS (single word):
vintage, cinematic, warm, cool, vivid, dramatic, faded,
dreamy, noir, negative, shake, pulse, glitch, bounce, wobble

COLOR WHEEL:
shadows [color] [sat 0-100] [intensity 0-100]
midtones [color] [sat] [intensity]
highlights [color] [sat] [intensity]
hdr [0-200]
Colors: red, orange, yellow, green, cyan, blue, purple, magenta, pink

CHROMA KEY:
green screen
chroma #hexcolor similarity [0-100] smoothness [0-100]

TRANSFORM:
scale [10-500]
rotation [-360 to 360]
position [x 0-100] [y 0-100]

KEYFRAMES:
zoom [from] to [to] over [seconds]s
rotate [from] to [to] over [seconds]s
position [x1] [y1] to [x2] [y2] over [seconds]s

TRANSITIONS:
fade in [duration], fade out [duration], slide left, zoom in

SPEED:
speed [0.1-16]x

TEXT:
text "content" size [number] color [color] at [top/bottom/center]

STICKERS:
sticker [emoji]

AUDIO FX:
audio [studio/warm/bright/vocal/podcast/deep/monster/
chipmunk/baby/robot/echo/reverb/cave/stadium/telephone/
underwater/whisper/radio]

MULTI-CLIP:
"all clips" or "every clip" prefix applies to all.

EXAMPLES:
"brightness 120, contrast 110, fade in 0.5"
"reds 50, blues -30, temperature 20"
"vintage, shake, text \\"Hello\\" size 48"
"zoom 100 to 200 over 3s, rotate 0 to 360 over 5s"

MY REQUEST: [yahan apna request likho]

Return ONLY the comma-separated editor commands. No explanation.`;

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