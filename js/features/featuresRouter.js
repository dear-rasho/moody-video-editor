// ================================================================
//  js/features/featuresRouter.js
//  Uses panelState.js for scroll memory + back-button routing.
//
//  🆕 Back se wapas aane pe shelf LAST-CLICKED feature pe scroll
//     ho jayega — user ko dobara scroll karne ki zaroorat nahi.
// ================================================================

import * as panelState from '../workspace/panelState.js';

const FEATURE_META = {
  music:        { label: 'Music',       icon: '🎵' },
  effect:       { label: 'Effects',     icon: '✨' },
  filters:      { label: 'Filters',     icon: '🎨' },
  overlays:     { label: 'Overlays',    icon: '🎬' },
  text:         { label: 'Text',        icon: '📝' },
  textFonts:    { label: 'Fonts',       icon: '🔤' },
  stickers:     { label: 'Stickers',    icon: '😀' },
  motion:       { label: 'Motion',      icon: '🎞️' },
  transform:    { label: 'Transform',   icon: '🔲' },
  transitions:  { label: 'Transitions', icon: '⇄' },
  trim:         { label: 'Trim',        icon: '🎯' },
  duplicate:    { label: 'Duplicate',   icon: '📋' },
  freeze:       { label: 'Freeze',      icon: '❄️' },
  soundeffect:  { label: 'Sound FX',    icon: '🔊' },
  audioeffect:  { label: 'Audio FX',    icon: '🎙️' },
  fx:           { label: 'FX',          icon: '⚡' },
  speed:        { label: 'Speed',       icon: '⏩' },
  chromakey:    { label: 'Chroma Key',  icon: '🟢' },
  reverse:      { label: 'Reverse',     icon: '↩️' },
  adjustments:  { label: 'Adjust',      icon: '🎚️' },
  colorWheel:   { label: 'Color Wheel', icon: '🌈' },
  export:       { label: 'Export',      icon: '💾' }
};

const featureModules = new Map();
let currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
const parentHistory = [];
let lastRenderedKey = null;

// ═══════════════════════════════════════════════════════════════
//  🆕 Remember last-clicked feature at ROOT level
//     (used to restore shelf scroll when user comes back)
// ═══════════════════════════════════════════════════════════════
let lastSelectedFeatureKey = null;

const state = {
  register(key, module) { featureModules.set(key, module); },
  get(key) { return featureModules.get(key); },
  list() { return [...featureModules.keys()]; }
};

const router = {
  init({ shelf, title, backButton }) {
    this.shelf = shelf;
    this.title = title;
    this.backButton = backButton;
    backButton?.addEventListener('click', () => this.back());
    lastRenderedKey = currentView.key;
    this.render(currentView);
  },

  registerFeature(key, module) { state.register(key, module); },

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
      level: 2, key,
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

    // Clean up any back interceptor of the feature we're leaving
    if (currentView && currentView.key) {
      panelState.unregisterBackInterceptor(currentView.key);
    }

    currentView = previous;
    this.shelf.classList.toggle('circle-shelf', currentView.level === 1);
    this.shelf.style.cssText = '';
    this.render(currentView);
  },

  reset() {
    parentHistory.length = 0;
    currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
    lastSelectedFeatureKey = null;
    this.render(currentView);
  },

  getState() { return structuredClone(currentView); },

  render(view) {
    if (!this.shelf) return;

    // Save scroll of PREVIOUS feature (for panel-level scroll memory)
    if (lastRenderedKey && lastRenderedKey !== view.key) {
      panelState.onFeatureClose(lastRenderedKey, this.shelf);
    }

    this.title.textContent = view.title;
    this.backButton.hidden = view.level === 0;
    this.shelf.classList.toggle('circle-shelf', view.level === 1);
    this.shelf.style.cssText = '';
    this.shelf.replaceChildren();

    // ═══════════════════════════════════════════════════════════
    //  Restore hook — runs AFTER children are rendered
    // ═══════════════════════════════════════════════════════════
    const restoreAfter = () => {
      panelState.restoreScroll(view.key, this.shelf);
      lastRenderedKey = view.key;

      // 🆕 At root level → scroll last-clicked feature into center
      if (view.level === 0 && lastSelectedFeatureKey) {
        const self = this;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            self._scrollFeatureIntoView(lastSelectedFeatureKey);
          });
        });
      }
    };

    const CUSTOM_PANELS = {
      colorwheel:       './colorWheel.js',
      adjustmentsPanel: './adjustments.js',
      chromaKeyPanel:   './chromakey.js',
      textPanel:        './text.js',
      stickersPanel:    './stickers.js',
      filtersPanel:     './filters.js',
      effectPanel:      './effect.js',
      soundeffectPanel: './soundeffect.js',
      audioeffectPanel: './audioeffect.js',
      speedPanel:       './speed.js',
      trimPanel:        './trim.js',
      transformPanel:   './transform.js',
      transitionsPanel: './transitions.js'
    };

    if (view.renderMode && CUSTOM_PANELS[view.renderMode]) {
      const modulePath = CUSTOM_PANELS[view.renderMode];
      import(modulePath)
        .then(mod => {
          if (mod.renderTo) mod.renderTo(this.shelf, this.title);
          restoreAfter();
        })
        .catch((err) => {
          console.error(`Panel load error (${view.renderMode}):`, err);
          this.shelf.textContent = '⚠️ Load failed';
          lastRenderedKey = view.key;
        });
      return;
    }

    const items = view.items.length
      ? view.items
      : state.list().map(key => {
          const meta = FEATURE_META[key] || {};
          const mod = state.get(key);
          return {
            key,
            label: (mod && mod.featureLabel) || meta.label || key,
            icon: (mod && mod.featureIcon) || meta.icon || '◆'
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

    restoreAfter();
  },

  // ═══════════════════════════════════════════════════════════
  //  🆕 Scroll a feature button to the center of the shelf
  // ═══════════════════════════════════════════════════════════
  _scrollFeatureIntoView(featureKey) {
    if (!this.shelf || !featureKey) return;

    const btn = this.shelf.querySelector(
      '[data-feature="' + featureKey + '"]'
    );
    if (!btn) return;

    const shelfWidth = this.shelf.clientWidth;
    if (shelfWidth <= 0) return;

    const btnOffsetLeft = btn.offsetLeft;
    const btnWidth = btn.offsetWidth;

    // Compute scroll so button is centered
    let target = btnOffsetLeft - (shelfWidth / 2) + (btnWidth / 2);

    // Clamp to valid range
    const maxScroll = Math.max(0, this.shelf.scrollWidth - shelfWidth);
    target = Math.max(0, Math.min(maxScroll, target));

    // Instant scroll (no animation → no flicker on back)
    this.shelf.scrollLeft = target;
  },

  select(item) {
    // 🆕 Remember user's click at ROOT level (for back scroll restore)
    if (currentView.level === 0) {
      lastSelectedFeatureKey = item.key;
    }

    const module = state.get(item.key);
    if (module?.open) { module.open({ router: this, item }); return; }
    if (item.children?.length) {
      if (currentView.level === 1) {
        this.openLevel2(item.key, item.children, { title: item.label || item.key });
      } else {
        this.openLevel(item.key, item.children, { title: item.label || item.key, level: 1 });
      }
    }
  }
};

export { router as featuresRouter, parentHistory };