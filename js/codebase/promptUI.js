// ================================================================
//  js/codebase/promptUI.js
//  Prompt panel UI — categorized chips + apply.
//  Categories: Adjust, Color, Wheel, Filters, Effects, Transform,
//              Anim, Transition, Chroma, Speed, Trim, Text,
//              Sticker, Audio
// ================================================================

import { parsePrompt, executePrompt } from './codebaseEngine.js';

// ═══════════════════════════════════════════════════════════════
//  CATEGORIES + EXAMPLES
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
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
let currentCat = 'adjust';
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

  // Build category shelf
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
        // Update active state
        catShelfEl.querySelectorAll('.prompt-cat-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === cat.key);
        });
        // Render chips for this category
        renderChips();
        // Scroll active category into center
        try {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (_) {}
      });

      catShelfEl.appendChild(btn);
    });

    // Scroll first active into view on load
    requestAnimationFrame(() => {
      const active = catShelfEl.querySelector('.prompt-cat-btn.active');
      if (active) {
        try {
          active.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        } catch (_) {}
      }
    });
  }

  // Render initial chips
  renderChips();

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      clearFeedback();
      inputEl.focus();
    });
  }

  // Apply button
  applyBtn.addEventListener('click', onApply);

  // Ctrl+Enter
  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER CHIPS for selected category
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
      const cur = inputEl.value.trim();
      inputEl.value = cur ? cur + ', ' + text : text;
      inputEl.focus();
    });
    examplesEl.appendChild(chip);
  });

  // Reset horizontal scroll to start
  try { examplesEl.scrollLeft = 0; } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  APPLY
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

  const state = parseResult.state;
  const hasSomething =
    Object.keys(state.adjustments).length > 0 ||
    Object.keys(state.filters).length > 0 ||
    state.effectPreset ||
    state.speed != null ||
    state.transition ||
    state.texts.length > 0 ||
    state.stickers.length > 0 ||
    state.colorWheel ||
    state.chroma ||
    Object.keys(state.transforms).length > 0 ||
    state.keyframes.length > 0 ||
    state.audioFx.length > 0 ||
    (state.trimOps && state.trimOps.length > 0);

  if (!hasSomething) {
    showFeedback('❌ Kuch samajh nahi aaya — category chips try karein', 'err');
    return;
  }

  const result = executePrompt(state);
  if (!result.ok) {
    showFeedback('❌ ' + (result.error || 'Execute fail'), 'err');
    return;
  }

  showFeedback('✅ Applied: ' + result.results.join(' • '), 'ok');
  inputEl.value = '';
  inputEl.blur();
}

// ═══════════════════════════════════════════════════════════════
//  FEEDBACK
// ═══════════════════════════════════════════════════════════════
function showFeedback(msg, type) {
  clearFeedback();
  feedbackEl = document.createElement('div');
  feedbackEl.className = 'prompt-feedback ' + (type || 'ok');
  feedbackEl.textContent = msg;

  // Insert before action row
  const actionRow = applyBtn && applyBtn.parentElement;
  if (actionRow && actionRow.parentNode) {
    actionRow.parentNode.insertBefore(feedbackEl, actionRow);
  }

  setTimeout(() => {
    if (feedbackEl) {
      feedbackEl.remove();
      feedbackEl = null;
    }
  }, 3500);
}

function clearFeedback() {
  if (feedbackEl) {
    feedbackEl.remove();
    feedbackEl = null;
  }
}