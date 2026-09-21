import { parsePrompt, executePrompt } from './codebaseEngine.js';
import { showError } from '../workspace/errorNotifier.js';
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
    key: 'align',
    label: 'Align',
    icon: '🎯',
    examples: [
      'text "Hello" align left',
      'text "Hello" align center',
      'text "Hello" align right',
      'text "Top" positionX 50 positionY 20',
      'text "Bottom" positionX 50 positionY 80',
      'text "Left" positionX 20 positionY 50',
      'text "Right" positionX 80 positionY 50',
      'text "Center" position 50 50',
      'text "Corner" position 10 10',
      'text "Mixed" positionX 70 positionY 30',
      'align right',
      'align center'
    ]
  },
  {
    key: 'anchor',
    label: 'Anchor',
    icon: '⚓',
    examples: [
      'text "TL" position 0 0 anchor top-left',
      'text "TC" position 50 0 anchor top-center',
      'text "TR" position 100 0 anchor top-right',
      'text "CL" position 0 50 anchor center-left',
      'text "C" position 50 50 anchor center',
      'text "CR" position 100 50 anchor center-right',
      'text "BL" position 0 100 anchor bottom-left',
      'text "BC" position 50 100 anchor bottom-center',
      'text "BR" position 100 100 anchor bottom-right',
      'text "Custom" position 30 70 anchor 0 50',
      'anchor top-left',
      'anchor center'
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
      '[00:03 - 00:06] "Bye" font handwriting size 20',
      '[00:00 - 00:10] [seg "i am " font music size 24 italic] [seg "Fine" font Impact size 72] position 50 50 anchor center',
      '[00:00 - 00:10] [seg "THE" font bold size 28 color #00FF87 animation fadeIn] [seg "SECRET" font Anton size 44 color ramp #60EFFF to #00FF87 animation bounce] [seg "OF" font bold size 28 color #ffcc00 animation typewriter] position 50 45 anchor center',
      '[00:00 - 00:08] "Subscribe" font Anton size 60 color ramp #ff0066 to #ffcc00 position 50 45 anchor center'
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
      'scale 50',
      'scale 200',
      'rotation 45',
      'rotation -90',
      'rotation 180',
      'positionX 30',
      'positionX 70',
      'positionY 20',
      'positionY 80',
      'position 30 70',
      'position 50 20',
      'position 70 30',
      'anchor top-left',
      'anchor center',
      'anchor bottom-right',
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
      'circle in 0.8',
      'transition all fade 0.5',
      'transition all dissolve 0.6',
      'transition all slide left 0.5',
      'transition at 3 fade 0.5',
      'transition at 6 dissolve 0.8',
      'transition at 3 fade 0.5, transition at 6 dissolve 0.8, transition at 9 slide left 0.5',
      'layer v1 transitions dissolve, slide, zoom, fade',
'layer v1 transitions dissolve, null, slide, null, zoom',
'layer v1 transitions dissolve 0.5, slide 0.8, zoom 1',
'layer v1 transitions dissolve, slide, zoom loop',
'transitions dissolve, slide, zoom',
'layer v2 transitions fade black 0.6, circle, wipe left'
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
      'text "Hi" size 36',
      'text "Bold" font Anton size 60',
      'text "Italic" italic size 40',
      'text "Shadow" shadow size 48',
      'text "Gradient" color ramp #ff0066 to #ffcc00',
      'text "Center" position 50 50',
      'text "Top" position 50 20',
      'text "Bottom" position 50 80',
      'text "Corner" position 10 10 anchor top-left'
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
    key: 'beats',
    label: 'Beats',
    icon: '🥁',
    examples: [
      'detect beats',
      'detect beats hard',
      'detect beats medium',
      'detect beats soft',
      'detect beats hard,med',
      'detect beats 0.3-0.5',
      'beats edit shake',
      'beats edit shake, zoom',
      'beats edit shake, zoom, pulse',
      'beats edit hard: shake+glow ; rest: zoom, pulse, bounce',
      'beats edit hard: shake+glow, bounce+flash ; med: zoom, pulse ; soft: fade, dreamy',
      'beats edit zoom, pulse, glitch'
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
    // 🆕 Inject picker styles
  if (!document.getElementById('prompt-picker-styles')) {
    const st = document.createElement('style');
    st.id = 'prompt-picker-styles';
    st.textContent = `
      .prompt-picker-btn {
        flex: 0 0 auto;
        min-height: 46px;
        padding: 0 14px;
        background: var(--surface-2);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.12s ease;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }
      .prompt-picker-btn:active {
        background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
        color: #fff;
        border-color: #a78bfa;
      }
    `;
    document.head.appendChild(st);
  }
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
    // 🆕 Chroma color picker
  const pickerBtn = document.createElement('button');
  pickerBtn.id = 'prompt-chroma-picker';
  pickerBtn.type = 'button';
  pickerBtn.className = 'prompt-picker-btn';
  pickerBtn.textContent = '🎨 Pick Color';
  pickerBtn.title = 'Pick color from preview for chroma key';

  const pickerInput = document.createElement('input');
  pickerInput.type = 'color';
  pickerInput.id = 'prompt-chroma-input';
  pickerInput.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;opacity:0;';

  pickerBtn.addEventListener('click', () => pickerInput.click());

  pickerInput.addEventListener('input', () => {
    const hex = pickerInput.value;
    const cur = inputEl.value.trim();
    const cmd = 'chroma ' + hex;
    // Append with comma if not empty
    inputEl.value = cur ? (cur.replace(/,\s*$/, '') + ', ' + cmd) : cmd;
    inputEl.focus();
    showFeedback('🎨 Color picked: ' + hex + ' → appended to prompt', 'ok', 2500);
  });

  // Insert into action row
  const actionRow = applyBtn.parentElement;
  if (actionRow) {
    actionRow.insertBefore(pickerBtn, applyBtn);
  }
  document.body.appendChild(pickerInput);

  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER CHIPS
function renderChips() {
  if (!examplesEl) return;
  examplesEl.replaceChildren();

  const cat = CATEGORIES.find(c => c.key === currentCat);
  if (!cat) return;

  // 🆕 Special Picker chip — only for Chroma category
  if (cat.key === 'chroma') {
    const pickChip = document.createElement('button');
    pickChip.type = 'button';
    pickChip.className = 'prompt-chip prompt-chip-picker';
    pickChip.innerHTML = '🎨 Pick Color from Clip';
    pickChip.addEventListener('click', openChromaPicker);
    examplesEl.appendChild(pickChip);
  }

  cat.examples.forEach(text => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'prompt-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      const cur = inputEl.value;
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

//  APPLY
// ═══════════════════════════════════════════════════════════════
async function onApply() {
  if (!inputEl) return;

  const prompt = inputEl.value.trim();
  if (!prompt) {
    showFeedback('Please likho kuch…', 'err');
    return;
  }
  const parseResult = parsePrompt(prompt);
  if (!parseResult.ok) {
    showFeedback('❌ Parse failed: ' + (parseResult.error || 'unknown'), 'err');
    return;
  }

  const state = parseResult.state || {};
  const isTimestamped = !!state.timestampedLayers;

  let hasSomething = false;

  if (isTimestamped) {
    hasSomething = true;
  } else {
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
    const hasTextProps = state.textProps && Object.keys(state.textProps).length > 0;

    const hasTransitionAll = !!state.transitionAll;
    const hasTighten = !!state.tightenTracks;
    const hasClearKf = !!state.clearKeyframes;
    const hasOpenGraph = !!state.openGraph;
    const hasAutoGraph = state.autoGraph != null;
    const hasAtTransitions = state.atTransitions && state.atTransitions.length > 0;
    const hasLayerTransitions = !!state.layerTransitions;
    const hasDetectBeats = !!state.detectBeats;
    const hasBeatsEdit = !!state.beatsEdit;

    hasSomething = hasAdjust || hasFilters || hasEffect || hasSpeed ||
                   hasTransition || hasTexts || hasStickers || hasWheel ||
                   hasChroma || hasTransforms || hasKeyframes ||
                   hasAudioFx || hasTrim || hasTextProps ||
                   hasTransitionAll || hasTighten || hasClearKf ||
                   hasOpenGraph || hasAutoGraph || hasAtTransitions ||
                   hasLayerTransitions || hasDetectBeats || hasBeatsEdit;
  }

  if (!hasSomething) {
    showFeedback('❌ Kuch samajh nahi aaya — category chips try karein', 'err');
    return;
  }

  // 🆕 Await async (beats detection needs time)
  let result;
  try {
    result = await executePrompt(state);
  } catch (e) {
    showFeedback('❌ Execute failed: ' + (e.message || 'unknown'), 'err');
    return;
  }
    // ═══════════════════════════════════════════════════════════
  //  🆕 BEATS REPORT — show full copyable report
  // ═══════════════════════════════════════════════════════════
  if (result.ok && result.beatsReport) {
    showFeedback(result.beatsReport, 'ok', 60000);
    inputEl.value = '';
    return;
  }

  if (!result.ok) {
    let msg = '❌ ' + (result.error || 'Execute fail');
    if (result.unknown && result.unknown.length > 0) {
      msg += '\n\n❓ Could not understand:';
      for (let i = 0; i < result.unknown.length; i++) {
        msg += '\n   • ' + result.unknown[i];
      }
    }
    showFeedback(msg, 'err');
    return;
  }

  if (result.unknown && result.unknown.length > 0) {
    let msg = '⚠️ Applied with issues';
    msg += '\n\n❓ Could not understand:';
    for (let i = 0; i < result.unknown.length && i < 5; i++) {
      msg += '\n   • ' + result.unknown[i];
    }
    if (result.unknown.length > 5) {
      msg += '\n   ... and ' + (result.unknown.length - 5) + ' more';
    }
    showFeedback(msg, 'err', 10000);
    inputEl.value = '';
    inputEl.blur();
    return;
  }

  const summary = (result.results || []).join(' • ');
  const unknownList = result.unknown || [];

  if (unknownList.length > 0) {
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

// ═══════════════════════════════════════════════════════════════
//  FEEDBACK
// ═══════════════════════════════════════════════════════════════
function showFeedback(msg, type, durationMs) {
  clearFeedback();

  feedbackEl = document.createElement('div');
  feedbackEl.className = 'prompt-feedback ' + (type || 'ok');
  feedbackEl.style.whiteSpace = 'pre-wrap';
  feedbackEl.style.display = 'flex';
  feedbackEl.style.alignItems = 'flex-start';
  feedbackEl.style.gap = '8px';
  feedbackEl.style.justifyContent = 'space-between';
  feedbackEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  feedbackEl.style.opacity = '1';

  const textEl = document.createElement('div');
  textEl.style.flex = '1';
  textEl.style.minWidth = '0';
  textEl.style.wordBreak = 'break-word';
  textEl.textContent = msg;

  // 🆕 Long messages (like beats report) → monospace + scrollable
  if (msg && msg.length > 300) {
    textEl.style.fontFamily = "'Courier New', monospace";
    textEl.style.fontSize = '10.5px';
    textEl.style.lineHeight = '1.45';
    textEl.style.whiteSpace = 'pre';
    textEl.style.overflowX = 'auto';
    textEl.style.maxHeight = '50vh';
    textEl.style.overflowY = 'auto';
    feedbackEl.style.maxHeight = '60vh';
    feedbackEl.style.overflowY = 'hidden';
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '📋';
  copyBtn.title = 'Copy this message';
  copyBtn.style.cssText = [
    'flex:0 0 auto',
    'width:32px',
    'height:32px',
    'padding:0',
    'border-radius:8px',
    'border:1px solid rgba(255,255,255,0.2)',
    'background:rgba(255,255,255,0.08)',
    'color:#fff',
    'font-size:14px',
    'cursor:pointer',
    'font-family:inherit',
    'display:grid',
    'place-items:center',
    'transition:all 0.12s ease',
    '-webkit-tap-highlight-color:transparent'
  ].join(';');

  copyBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const payload = buildPromptFeedbackCopy(msg, type);
    const ok = await copyToClipboard(payload);

    if (ok) {
      copyBtn.textContent = '✅';
      copyBtn.style.background = 'rgba(0,255,135,0.25)';
      copyBtn.style.borderColor = '#00FF87';
      copyBtn.style.color = '#00FF87';

      // ═══════════════════════════════════════════════════════
      //  🆕 BEATS REPORT → auto-dismiss after copy
      //  User ko 700ms ke liye green ✅ dikhega, phir
      //  poora feedback fade-out hoke remove ho jayega.
      // ═══════════════════════════════════════════════════════
      if (msg && msg.indexOf('BEATS REPORT') >= 0) {
        setTimeout(function () {
          if (feedbackEl) {
            feedbackEl.style.opacity = '0';
            feedbackEl.style.transform = 'translateY(-6px)';
            const ref = feedbackEl;
            feedbackEl = null;
            setTimeout(function () {
              try { ref.remove(); } catch (_) {}
            }, 260);
          }
        }, 700);
        return;
      }

      // Normal feedback → reset button
      setTimeout(function () {
        copyBtn.textContent = '📋';
        copyBtn.style.background = 'rgba(255,255,255,0.08)';
        copyBtn.style.borderColor = 'rgba(255,255,255,0.2)';
        copyBtn.style.color = '#fff';
      }, 1500);
    } else {
      copyBtn.textContent = '❌';
      setTimeout(function () { copyBtn.textContent = '📋'; }, 1200);
    }
  });

  copyBtn.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
  });

  feedbackEl.appendChild(textEl);
  feedbackEl.appendChild(copyBtn);

  const actionRow = applyBtn && applyBtn.parentElement;
  if (actionRow && actionRow.parentNode) {
    actionRow.parentNode.insertBefore(feedbackEl, actionRow);
  }

  const ms = durationMs || (type === 'err' ? 8000 : 4000);
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

// ═══════════════════════════════════════════════════════════════
//  COPY HELPERS
function buildPromptFeedbackCopy(msg, type) {
  // 🆕 Beats report → copy clean (just the report, no header/env)
  if (msg && msg.indexOf('BEATS REPORT') >= 0) {
    return msg;
  }

  const lines = [];
  lines.push('=== MOODY EDITOR — PROMPT FEEDBACK ===');
  lines.push('Type:  ' + (type || 'info'));
  lines.push('Time:  ' + new Date().toISOString());
  lines.push('');
  lines.push('Message:');
  lines.push(msg || '(empty)');
  lines.push('');

  try {
    const inp = document.querySelector('#prompt-input');
    if (inp && inp.value) {
      lines.push('Prompt (current):');
      lines.push(inp.value);
      lines.push('');
    }
  } catch (_) {}

  try {
    const sel = document.querySelector('.clip.selected');
    if (sel) {
      const track = sel.dataset.track || '?';
      const clip = sel.dataset.clip || '?';
      const type2 = sel.dataset.clipType || '?';
      lines.push('Selected clip:');
      lines.push('  Track: ' + track);
      lines.push('  Index: ' + clip);
      lines.push('  Type:  ' + type2);
      lines.push('');
    } else {
      lines.push('Selected clip: (none)');
      lines.push('');
    }
  } catch (_) {}

  try {
    lines.push('Environment:');
    lines.push('  User Agent: ' + (navigator.userAgent || 'n/a'));
    lines.push('  Platform:   ' + (navigator.platform || 'n/a'));
    lines.push('  Viewport:   ' + window.innerWidth + '×' + window.innerHeight);
    const ratio = window.__offlineEditorRatio;
    if (ratio) {
      lines.push('  Ratio:      ' + (ratio.key || '?') + ' (' + ratio.w + ':' + ratio.h + ')');
    }
    const appState = window.__appState;
    if (appState && appState.timeline) {
      const vt = (appState.timeline.visual || []).length;
      const at = (appState.timeline.audio || []).length;
      lines.push('  Visual tracks: ' + vt);
      lines.push('  Audio tracks:  ' + at);
    }
  } catch (_) {}

  lines.push('');
  lines.push('=== END ===');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CHROMA COLOR PICKER (in-prompt, manual-style loupe)
// ═══════════════════════════════════════════════════════════════
let chromaPickingActive = false;
let chromaLoupeEl = null;
let chromaPreviewCanvas = null;

function injectChromaPickerCSS() {
  if (document.getElementById('prompt-chroma-picker-styles')) return;
  const s = document.createElement('style');
  s.id = 'prompt-chroma-picker-styles';
  s.textContent = `
    .prompt-chip-picker {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
      color: #fff !important;
      border-color: #22c55e !important;
      font-weight: 800 !important;
      box-shadow: 0 2px 8px rgba(34,197,94,0.4);
    }
    .prompt-chip-picker:active {
      transform: scale(0.96);
    }

    /* Picking cursor on preview canvas */
    #preview-canvas.prompt-chroma-picking {
      cursor: crosshair !important;
      touch-action: none;
    }

    /* Loupe */
    .prompt-chroma-loupe {
      position: fixed;
      width: 78px;
      height: 78px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7);
      pointer-events: none;
      z-index: 100003;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000;
      transform: translate(14px, 14px);
    }
    .prompt-chroma-loupe.hidden { display: none; }
    .prompt-chroma-loupe-color {
      width: 100%; height: 100%;
      border-radius: 50%;
    }
    .prompt-chroma-loupe-text {
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      font-weight: 700;
      color: #fff;
      background: rgba(0,0,0,0.8);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
    }
  `;
  document.head.appendChild(s);
}

function openChromaPicker() {
  injectChromaPickerCSS();

  // Toggle OFF if already active
  if (chromaPickingActive) {
    closeChromaPicker();
    return;
  }

  const canvas = document.querySelector('#preview-canvas');
  if (!canvas) {
    showFeedback('❌ Preview canvas not available', 'err', 2500);
    return;
  }

  // Pause playback so canvas has a clean frame
  const eng = window.__playbackEngine;
  if (eng && typeof eng.pause === 'function') {
    try { eng.pause(); } catch (_) {}
  }

  chromaPickingActive = true;
  chromaPreviewCanvas = canvas;
  canvas.classList.add('prompt-chroma-picking');

  canvas.addEventListener('mousemove', onChromaHover);
  canvas.addEventListener('mouseleave', onChromaLeave);
  canvas.addEventListener('click', onChromaClick, true);
  canvas.addEventListener('touchstart', onChromaTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onChromaTouchMove, { passive: false });
  canvas.addEventListener('touchend', onChromaTouchEnd, { passive: false });

  showFeedback('🎯 Tap on preview to pick color (tap chip again to cancel)', 'ok', 4000);
}

function closeChromaPicker() {
  chromaPickingActive = false;
  if (chromaPreviewCanvas) {
    chromaPreviewCanvas.classList.remove('prompt-chroma-picking');
    chromaPreviewCanvas.removeEventListener('mousemove', onChromaHover);
    chromaPreviewCanvas.removeEventListener('mouseleave', onChromaLeave);
    chromaPreviewCanvas.removeEventListener('click', onChromaClick, true);
    chromaPreviewCanvas.removeEventListener('touchstart', onChromaTouchStart);
    chromaPreviewCanvas.removeEventListener('touchmove', onChromaTouchMove);
    chromaPreviewCanvas.removeEventListener('touchend', onChromaTouchEnd);
  }
  chromaPreviewCanvas = null;
  hideChromaLoupe();
}

// ─── Coordinate conversion ──────────────────────────────────
function clientToPixel(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / (rect.width || 1);
  const sy = canvas.height / (rect.height || 1);
  const px = Math.floor((clientX - rect.left) * sx);
  const py = Math.floor((clientY - rect.top) * sy);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
  return { px, py };
}

function readPixel(canvas, px, py) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const d = ctx.getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  } catch (_) { return null; }
}

function rgbToHex(rgb) {
  const h = n => n.toString(16).padStart(2, '0');
  return '#' + h(rgb.r) + h(rgb.g) + h(rgb.b);
}

// ─── Mouse events ───────────────────────────────────────────
function onChromaHover(e) {
  if (!chromaPickingActive) return;
  const p = clientToPixel(chromaPreviewCanvas, e.clientX, e.clientY);
  if (!p) { hideChromaLoupe(); return; }
  const c = readPixel(chromaPreviewCanvas, p.px, p.py);
  if (!c) { hideChromaLoupe(); return; }
  showChromaLoupe(e.clientX, e.clientY, c);
}
function onChromaLeave() { hideChromaLoupe(); }
function onChromaClick(e) {
  if (!chromaPickingActive) return;
  e.preventDefault();
  e.stopPropagation();
  const p = clientToPixel(chromaPreviewCanvas, e.clientX, e.clientY);
  if (!p) return;
  const c = readPixel(chromaPreviewCanvas, p.px, p.py);
  if (!c) return;
  applyChromaPick(c);
}

// ─── Touch events ───────────────────────────────────────────
function onChromaTouchStart(e) {
  if (!chromaPickingActive) return;
  e.preventDefault();
  const t = e.touches[0];
  const p = clientToPixel(chromaPreviewCanvas, t.clientX, t.clientY);
  if (!p) return;
  const c = readPixel(chromaPreviewCanvas, p.px, p.py);
  if (!c) return;
  showChromaLoupe(t.clientX, t.clientY, c);
}
function onChromaTouchMove(e) {
  if (!chromaPickingActive) return;
  e.preventDefault();
  const t = e.touches[0];
  const p = clientToPixel(chromaPreviewCanvas, t.clientX, t.clientY);
  if (!p) { hideChromaLoupe(); return; }
  const c = readPixel(chromaPreviewCanvas, p.px, p.py);
  if (!c) return;
  showChromaLoupe(t.clientX, t.clientY, c);
}
function onChromaTouchEnd(e) {
  if (!chromaPickingActive) return;
  e.preventDefault();
  const t = e.changedTouches && e.changedTouches[0];
  if (!t) return;
  const p = clientToPixel(chromaPreviewCanvas, t.clientX, t.clientY);
  if (!p) return;
  const c = readPixel(chromaPreviewCanvas, p.px, p.py);
  if (!c) return;
  applyChromaPick(c);
}

// ─── Apply pick → insert into prompt input ──────────────────
function applyChromaPick(rgb) {
  const hex = rgbToHex(rgb);
  const cur = inputEl ? inputEl.value.trim() : '';
  const cmd = 'chroma ' + hex;

  if (inputEl) {
    if (cur) {
      inputEl.value = cur.replace(/,\s*$/, '') + ', ' + cmd;
    } else {
      inputEl.value = cmd;
    }
    inputEl.focus();
  }

  closeChromaPicker();
  showFeedback('🎨 Picked ' + hex + ' — added to prompt', 'ok', 3000);
}

// ─── Loupe ──────────────────────────────────────────────────
function ensureChromaLoupe() {
  if (chromaLoupeEl) return chromaLoupeEl;
  chromaLoupeEl = document.createElement('div');
  chromaLoupeEl.className = 'prompt-chroma-loupe hidden';
  chromaLoupeEl.innerHTML =
    '<div class="prompt-chroma-loupe-color"></div>' +
    '<div class="prompt-chroma-loupe-text"></div>';
  document.body.appendChild(chromaLoupeEl);
  return chromaLoupeEl;
}
function showChromaLoupe(clientX, clientY, rgb) {
  const el = ensureChromaLoupe();
  el.classList.remove('hidden');
  el.style.left = clientX + 'px';
  el.style.top = clientY + 'px';
  el.querySelector('.prompt-chroma-loupe-color').style.background =
    'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
  el.querySelector('.prompt-chroma-loupe-text').textContent =
    rgb.r + ',' + rgb.g + ',' + rgb.b;
}
function hideChromaLoupe() {
  if (chromaLoupeEl) chromaLoupeEl.classList.add('hidden');
}

// ─── Cleanup on panel switch ────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden) closeChromaPicker();
});

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}
