// ================================================================
//  js/features/featuresRouter.js
//  Lightweight feature router.
//
//  Responsibilities:
//    - Register feature modules by key
//    - Open / close levels (root → level 1 → level 2)
//    - Render the feature shelf
//    - Dispatch to custom panels via `renderMode` (colorWheel,
//      chromaKey, crop, ratio, text, stickers, filters, adjustments,
//      soundeffect, audioeffect)
//    - Forward user selection to the appropriate module's open()
//
//  NOTE: All per-feature logic (sliders, canvas processing, etc.)
//  lives inside each feature module — NOT here.
// ================================================================

// ═══════════════════════════════════════════════════════════════
//  DISPLAY META — pretty labels + icons for feature list
// ═══════════════════════════════════════════════════════════════
const FEATURE_META = {
  music:        { label: 'Music',       icon: '🎵' },
  effect:       { label: 'Effects',     icon: '✨' },
  filters:      { label: 'Filters',     icon: '🎨' },
  overlays:     { label: 'Overlays',    icon: '🎬' },
  text:         { label: 'Text',        icon: '📝' },
  textFonts:    { label: 'Fonts',       icon: '🔤' },
  stickers:     { label: 'Stickers',    icon: '😀' },
  motion:       { label: 'Motion',      icon: '🎞️' },
  split:        { label: 'Split',       icon: '✂️' },
  trim:         { label: 'Trim',        icon: '🎯' },
  crop:         { label: 'Crop',        icon: '🖼️' },
  duplicate:    { label: 'Duplicate',   icon: '📋' },
  freeze:       { label: 'Freeze',      icon: '❄️' },
  soundeffect:  { label: 'Sound FX',    icon: '🔊' },
  audioeffect:  { label: 'Audio FX',    icon: '🎙️' },
  fx:           { label: 'FX',          icon: '⚡' },
  speed:        { label: 'Speed',       icon: '⏩' },
  chromakey:    { label: 'Chroma Key',  icon: '🟢' },
  reverse:      { label: 'Reverse',     icon: '↩️' },
  ratio:        { label: 'Ratio',       icon: '📐' },
  adjustments:  { label: 'Adjust',      icon: '🎚️' },
  colorWheel:   { label: 'Color Wheel', icon: '🌈' },
  export:       { label: 'Export',      icon: '💾' }
};

// ═══════════════════════════════════════════════════════════════
//  MODULE REGISTRY
// ═══════════════════════════════════════════════════════════════
const featureModules = new Map();
let currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
const parentHistory = [];

const state = {
  register(key, module) { featureModules.set(key, module); },
  get(key) { return featureModules.get(key); },
  list() { return [...featureModules.keys()]; }
};

const router = {
  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════
  init({ shelf, title, backButton }) {
    this.shelf = shelf;
    this.title = title;
    this.backButton = backButton;
    backButton?.addEventListener('click', () => this.back());
    this.render(currentView);
  },

  // ═══════════════════════════════════════════════════════════
  //  REGISTER
  // ═══════════════════════════════════════════════════════════
  registerFeature(key, module) { state.register(key, module); },

  // ═══════════════════════════════════════════════════════════
  //  NAVIGATION
  // ═══════════════════════════════════════════════════════════
  openLevel(key, items = [], options = {}) {
    parentHistory.push(structuredClone(currentView));
    currentView = {
      level: Math.min((currentView.level ?? 0) + 1, options.level ?? 1),
      key,
      title: options.title ?? key,
      items,
      multi: options.multi || false,
      renderMode: options.renderMode || null
    };
    this.render(currentView);
  },

  openLevel2(key, items = [], options = {}) {
    parentHistory.push(structuredClone(currentView));
    currentView = {
      level: 2,
      key,
      title: options.title ?? key,
      items,
      multi: options.multi || false,
      renderMode: options.renderMode || null
    };
    this.render(currentView);
  },

  back() {
    const previous = parentHistory.pop();
    if (!previous) return;
    currentView = previous;
    this.shelf.classList.toggle('circle-shelf', currentView.level === 1);
    this.shelf.style.cssText = '';
    this.render(currentView);
  },

  reset() {
    parentHistory.length = 0;
    currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
    this.render(currentView);
  },

  getState() { return structuredClone(currentView); },

  // ═══════════════════════════════════════════════════════════
  //  RENDER — dispatch to custom panels or feature list
  // ═══════════════════════════════════════════════════════════
  render(view) {
    if (!this.shelf) return;
    this.title.textContent = view.title;
    this.backButton.hidden = view.level === 0;
    this.shelf.classList.toggle('circle-shelf', view.level === 1);
    this.shelf.style.cssText = '';
    this.shelf.replaceChildren();

    // ─── Custom panels (each feature owns its own renderer) ──
    const CUSTOM_PANELS = {
      colorwheel:       './colorWheel.js',
      adjustmentsPanel: './adjustments.js',
      chromaKeyPanel:   './chromakey.js',
      cropPanel:        './crop.js',
      ratioPanel:       './ratio.js',
      textPanel:        './text.js',
      stickersPanel:    './stickers.js',
      filtersPanel:     './filters.js',
      effectPanel:      './effect.js',
      soundeffectPanel: './soundeffect.js',
      audioeffectPanel: './audioeffect.js',
      speedPanel:       './speed.js',
      trimPanel:        './trim.js'
    };

    if (view.renderMode && CUSTOM_PANELS[view.renderMode]) {
      const modulePath = CUSTOM_PANELS[view.renderMode];
      import(modulePath)
        .then(mod => {
          if (mod.renderTo) mod.renderTo(this.shelf, this.title);
        })
        .catch((err) => {
          console.error(`Panel load error (${view.renderMode}):`, err);
          this.shelf.textContent = '⚠️ Load failed';
        });
      return;
    }

    // ─── Default feature list (level 0 / 1) ──────────────────
    const items = view.items.length
      ? view.items
      : state.list().map(key => {
          const meta = FEATURE_META[key] || {};
          const mod = state.get(key);
          return {
            key,
            label: (mod && mod.featureLabel) || meta.label || key,
            icon:  (mod && mod.featureIcon)  || meta.icon  || '◆'
          };
        });

    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'feature-item';
      button.dataset.feature = item.key;
      button.innerHTML =
        `<span class="feature-icon" aria-hidden="true">${item.icon ?? '◆'}</span>` +
        `<span class="feature-label">${item.label ?? item.key}</span>`;
      button.addEventListener('click', () => this.select(item));
      this.shelf.append(button);
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  SELECT — hand off to the module
  // ═══════════════════════════════════════════════════════════
  select(item) {
    const module = state.get(item.key);
    if (module?.open) {
      module.open({ router: this, item });
      return;
    }
    // Fallback: nested children without a module
    if (item.children?.length) {
      if (currentView.level === 1) {
        this.openLevel2(item.key, item.children, { title: item.label || item.key });
      } else {
        this.openLevel(item.key, item.children, { title: item.label || item.key, level: 1 });
      }
    }
  }
};

// ─── Export ────────────────────────────────────────────────────
export { router as featuresRouter, parentHistory };