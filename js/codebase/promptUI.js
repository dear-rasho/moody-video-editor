// ================================================================
//  js/codebase/promptUI.js
//  Prompt panel UI — categorized chips + apply.
// ================================================================

import { parsePrompt, executePrompt } from './codebaseEngine.js';

// ═══════════════════════════════════════════════════════════════
//  CATEGORIES + EXAMPLES
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
    {
    key: 'fonts',
    label: 'Fonts',
    icon: '🔤',
    examples: [
      'font handwriting size 24',
      'font music size 48',
      'font titles size 60',
      'font cinematic size 32',
      'font elegant size 40',
      'font bold size 72',
      'font playful size 36',
      'font minimal size 28',
      'font retro size 44',
      'font mono size 24',
      'font educational size 32',
      'font modern size 40',
      'font "Dancing Script" size 36',
      'font "Playfair Display" size 48',
      'font "Bebas Neue" size 60'
    ]
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: '🎬',
    examples: [
      '[00:00 - 00:05] "Welcome" animation typewriter, position center',
      '[00:05 - 00:08] "Second line" animation bounce, position bottom',
      '[00:08 - 00:15] "Third line" color ramp #00FF87 to #60EFFF',
      '[00:15 - 00:20] "Fourth" color white, shadow',
      '[00:00 - 00:03] "Hi" font Impact size 48',
      '[00:03 - 00:06] "Bye" font handwriting size 20'
    ]
  },
  {
    key: 'adjust',
    label: 'Adjust',
    icon: '🎚️',
    examples: [
      'brightness 120',
      'contrast 110',
      'exposure 20',
      'saturation 150',
      'vibrance 30',
      'temperature 30',
      'tint -20',
      'shadows 30',
      'highlights -15',
      'clarity 25',
      'sharpen 20',
      'vignette 40',
      'noise 15'
    ]
  },
  {
    key: 'color',
    label: 'Color',
    icon: '🎨',
    examples: [
      'reds 50',
      'oranges -30',
      'yellows 40',
      'greens 60',
      'cyans 40',
      'blues -40',
      'purples 50',
      'magentas 30',
      'skintones 20',
      'temperature 30, tint -20',
      'lal 30, hara -20',
      'neela 40',
      'peela 20'
    ]
  },
  {
    key: 'wheel',
    label: 'Wheel',
    icon: '🌈',
    examples: [
      'shadows red 50 40',
      'midtones blue 40 50',
      'highlights green 30 60',
      'shadows purple 60 50',
      'highlights blue 30 60',
      'hdr 120'
    ]
  },
  {
    key: 'filters',
    label: 'Filters',
    icon: '🔍',
    examples: [
      'grayscale',
      'sepia 80',
      'invert 100',
      'blur 5',
      'hue 90',
      'opacity 80',
      'bw',
      'dhundhla 5'
    ]
  },
  {
    key: 'effects',
    label: 'Effects',
    icon: '✨',
    examples: [
      'vintage',
      'cinematic',
      'warm',
      'cool',
      'vivid',
      'dramatic',
      'faded',
      'dreamy',
      'noir',
      'negative',
      'shake',
      'pulse',
      'glitch',
      'bounce',
      'wobble',
      'softGlow'
    ]
  },
  {
    key: 'transform',
    label: 'Transform',
    icon: '🔲',
    examples: [
      'scale 150',
      'scale 80',
      'rotation 45',
      'rotation -90',
      'position 30 70',
      'position 50 20',
      'cropL 10',
      'cropR 10',
      'cropT 5',
      'cropB 5'
    ]
  },
  {
    key: 'anim',
    label: 'Anim',
    icon: '🎞️',
    examples: [
      'zoom 100 to 200 over 3s',
      'zoom 100 to 150 over 2s',
      'rotate 0 to 360 over 5s',
      'scale 100 to 150 over 2s',
      'position 50 50 to 90 50 over 1s',
      'opacity 0 to 100 over 1s'
    ]
  },
  {
    key: 'transition',
    label: 'Transition',
    icon: '⇄',
    examples: [
      'fade in 0.5',
      'fade out 1',
      'dissolve 0.8',
      'slide left 0.5',
      'slide right 0.5',
      'zoom in 1',
      'zoom out 1',
      'wipe left 0.6',
      'wipe right 0.6',
      'circle in 0.8'
    ]
  },
  {
    key: 'chroma',
    label: 'Chroma',
    icon: '🟢',
    examples: [
      'green screen',
      'blue screen',
      'chroma #00ff00',
      'chroma #00ff00 similarity 30',
      'chroma #0000ff intensity 80'
    ]
  },
  {
    key: 'speed',
    label: 'Speed',
    icon: '⏩',
    examples: [
      'speed 0.5x',
      'speed 1.5x',
      'speed 2x',
      'speed 3x',
      'speed 4x'
    ]
  },
  {
    key: 'trim',
    label: 'Trim',
    icon: '✂️',
    examples: [
      'trim left',
      'trim right',
      'split'
    ]
  },
  {
    key: 'text',
    label: 'Text',
    icon: '📝',
    examples: [
      'text "Hello" size 48',
      'text "Welcome" at top',
      'text "Subscribe" at bottom',
      'text "Bye" size 72 color #ff0066',
      'text "Hi" size 36'
    ]
  },
  {
    key: 'sticker',
    label: 'Sticker',
    icon: '😀',
    examples: [
      'sticker 😀',
      'sticker 🔥',
      'sticker ❤️',
      'sticker ⭐'
    ]
  },
  {
    key: 'audio',
    label: 'Audio',
    icon: '🔊',
    examples: [
      'audio studio',
      'audio warm',
      'audio bright',
      'audio vocal',
      'audio podcast',
      'audio deep',
      'audio monster',
      'audio chipmunk',
      'audio baby',
      'audio robot',
      'audio echo',
      'audio reverb',
      'audio cave',
      'audio stadium',
      'audio telephone',
      'audio underwater',
      'audio whisper',
      'audio radio'
    ]
  }
];

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let currentCat = 'timeline';
let inputEl = null;
let applyBtn = null;
let clearBtn = null;
let feedbackEl = null;
let catShelfEl = null;
let examplesEl = null;

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initPromptUI() {
  inputEl = document.querySelector('#prompt-input');
  applyBtn = document.querySelector('#prompt-apply-btn');
  clearBtn = document.querySelector('#prompt-clear-btn');
  catShelfEl = document.querySelector('#prompt-cat-shelf');
  examplesEl = document.querySelector('#prompt-examples');

  if (!inputEl || !applyBtn) {
    console.warn('[PromptUI] Elements not found');
    return;
  }

  if (catShelfEl) {
    catShelfEl.replaceChildren();
    CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-cat-btn';
      btn.dataset.cat = cat.key;
      if (cat.key === currentCat) btn.classList.add('active');

      const ic = document.createElement('span');
      ic.className = 'prompt-cat-icon';
      ic.textContent = cat.icon;

      const lbl = document.createElement('span');
      lbl.className = 'prompt-cat-label';
      lbl.textContent = cat.label;

      btn.append(ic, lbl);

      btn.addEventListener('click', () => {
        currentCat = cat.key;
        catShelfEl.querySelectorAll('.prompt-cat-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === cat.key);
        });
        renderChips();
        try {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (_) {}
      });

      catShelfEl.appendChild(btn);
    });

    requestAnimationFrame(() => {
      const active = catShelfEl.querySelector('.prompt-cat-btn.active');
      if (active) {
        try {
          active.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        } catch (_) {}
      }
    });
  }

  renderChips();

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      clearFeedback();
      inputEl.focus();
    });
  }

  applyBtn.addEventListener('click', onApply);

  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER CHIPS
// ═══════════════════════════════════════════════════════════════
function renderChips() {
  if (!examplesEl) return;
  examplesEl.replaceChildren();

  const cat = CATEGORIES.find(c => c.key === currentCat);
  if (!cat) return;

  cat.examples.forEach(text => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'prompt-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      const cur = inputEl.value;
      // For timestamped examples, add on new line
      if (text.startsWith('[')) {
        inputEl.value = cur ? cur.replace(/\s+$/, '') + '\n' + text : text;
      } else {
        const trimmed = cur.trim();
        inputEl.value = trimmed ? trimmed + ', ' + text : text;
      }
      inputEl.focus();
    });
    examplesEl.appendChild(chip);
  });

  try { examplesEl.scrollLeft = 0; } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  🆕 APPLY — SAFE VERSION
//  Handles both timestamped layers AND regular commands
// ═══════════════════════════════════════════════════════════════
function onApply() {
  if (!inputEl) return;

  const prompt = inputEl.value.trim();
  if (!prompt) {
    showFeedback('Please likho kuch…', 'err');
    return;
  }

  const parseResult = parsePrompt(prompt);
  if (!parseResult.ok) {
    showFeedback('❌ ' + (parseResult.error || 'Parse fail'), 'err');
    return;
  }

  const state = parseResult.state || {};

  // 🆕 Check if this is a timestamped-layer prompt
  const isTimestamped = !!state.timestampedLayers;

  let hasSomething = false;

  if (isTimestamped) {
    hasSomething = true;
  } else {
    // Safe checks — har field guard karo
    const hasAdjust = state.adjustments && Object.keys(state.adjustments).length > 0;
    const hasFilters = state.filters && Object.keys(state.filters).length > 0;
    const hasEffect = !!state.effectPreset;
    const hasSpeed = state.speed != null;
    const hasTransition = !!state.transition;
    const hasTexts = state.texts && state.texts.length > 0;
    const hasStickers = state.stickers && state.stickers.length > 0;
    const hasWheel = !!state.colorWheel;
    const hasChroma = !!state.chroma;
    const hasTransforms = state.transforms && Object.keys(state.transforms).length > 0;
    const hasKeyframes = state.keyframes && state.keyframes.length > 0;
    const hasAudioFx = state.audioFx && state.audioFx.length > 0;
    const hasTrim = state.trimOps && state.trimOps.length > 0;

    hasSomething = hasAdjust || hasFilters || hasEffect || hasSpeed ||
                   hasTransition || hasTexts || hasStickers || hasWheel ||
                   hasChroma || hasTransforms || hasKeyframes ||
                   hasAudioFx || hasTrim;
  }

  if (!hasSomething) {
    showFeedback('❌ Kuch samajh nahi aaya — category chips try karein', 'err');
    return;
  }

   const result = executePrompt(state);
  if (!result.ok) {
    showFeedback('❌ ' + (result.error || 'Execute fail'), 'err');
    return;
  }

  const summary = (result.results || []).join(' • ');
  const unknownList = result.unknown || [];

  if (unknownList.length > 0) {
    // 🆕 Show what wasn't understood — user can fix
    const unknownText = unknownList.slice(0, 6).join('  •  ');
    const more = unknownList.length > 6 ? ' (+' + (unknownList.length - 6) + ' more)' : '';
    showFeedback(
      '⚠️ Applied with issues: ' + summary + '\n' +
      '❓ Could not understand: ' + unknownText + more,
      'warn',
      6000
    );
  } else {
    showFeedback('✅ Applied: ' + summary, 'ok');
  }

  inputEl.value = '';
  inputEl.blur();
}
//  FEEDBACK
function showFeedback(msg, type, durationMs) {
  clearFeedback();
  feedbackEl = document.createElement('div');
  feedbackEl.className = 'prompt-feedback ' + (type || 'ok');
  feedbackEl.style.whiteSpace = 'pre-wrap';
  feedbackEl.textContent = msg;

  const actionRow = applyBtn && applyBtn.parentElement;
  if (actionRow && actionRow.parentNode) {
    actionRow.parentNode.insertBefore(feedbackEl, actionRow);
  }

  const ms = durationMs || 3500;
  setTimeout(() => {
    if (feedbackEl) {
      feedbackEl.remove();
      feedbackEl = null;
    }
  }, ms);
}

function clearFeedback() {
  if (feedbackEl) {
    feedbackEl.remove();
    feedbackEl = null;
  }
}