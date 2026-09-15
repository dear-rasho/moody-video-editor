// ================================================================
//  js/workspace/panelState.js
//  Central controller for ALL feature panels.
//
//  Provides:
//    • Sub-view memory  (per feature)
//    • Scroll memory    (auto, per feature)
//    • Back-button interception (auto, via capture on parent)
//    • Custom state     (any key/value per feature)
// ================================================================
const _features = {};               // featureKey -> { subView, ... }
const _scroll  = {};                // featureKey -> { scrollKey -> number }
const _backRegistry = new Map();    // featureKey -> { wrapper, header, handler }

// 🆕 Feature shelf ka apna horizontal scroll — per view key
const _shelfScroll = {};            // featureKey -> scrollLeft

// Known scroll regions (classes to auto-track)
const SCROLL_CLASSES = [
  'tf-props-shelf',
  'tf-ease-shelf',
  'tx-options-shelf',
  'tx-fonts-scroll',
  'fl-grid',
  'fl-card',
  'aj-panel',
  'ck-panel',
  'ck-shelf',
  'cw-panel',
  'cw-shelf',
  'tx-panel',
  'ef-panel',
  'ef-shelf',
  'se-grid',
  'se-panel',
  'sk-grid',
  'sk-cat-shelf',
  'sk-panel',
  'tr-shelf',
  'tr-panel',
  'sp-panel',
  'ax-panel'
];

// ═══════════════════════════════════════════════════════════════
//  FEATURE STATE (sub-view + custom)
// ═══════════════════════════════════════════════════════════════
export function getFeatureState(featureKey, key) {
  const s = _features[featureKey] || {};
  return key === undefined ? s : s[key];
}

export function setFeatureState(featureKey, keyOrObj, value) {
  if (!featureKey) return;
  if (!_features[featureKey]) _features[featureKey] = {};

  if (typeof keyOrObj === 'object' && keyOrObj !== null) {
    Object.assign(_features[featureKey], keyOrObj);
  } else if (typeof keyOrObj === 'string') {
    _features[featureKey][keyOrObj] = value;
  }
}

export function clearFeatureState(featureKey) {
  delete _features[featureKey];
  delete _scroll[featureKey];
}

// ═══════════════════════════════════════════════════════════════
//  SCROLL MEMORY
// ═══════════════════════════════════════════════════════════════
export function saveScroll(featureKey, rootEl) {
  if (!featureKey || !rootEl) return;

  const map = {};
  SCROLL_CLASSES.forEach(function (cls) {
    const els = rootEl.querySelectorAll('.' + cls);
    for (let i = 0; i < els.length; i++) {
      const key = cls + '::' + i;
      map[key] = els[i].scrollLeft;
    }
  });

  _scroll[featureKey] = map;
}

export function restoreScroll(featureKey, rootEl) {
  if (!featureKey || !rootEl) return;
  const map = _scroll[featureKey];
  if (!map) return;

  requestAnimationFrame(function () {
    SCROLL_CLASSES.forEach(function (cls) {
      const els = rootEl.querySelectorAll('.' + cls);
      for (let i = 0; i < els.length; i++) {
        const key = cls + '::' + i;
        if (typeof map[key] === 'number' && map[key] > 0) {
          els[i].scrollLeft = map[key];
        }
      }
    });
  });
}
// ═══════════════════════════════════════════════════════════════
//  🆕 SHELF SCROLL MEMORY
//  #feature-shelf element ka apna scrollLeft — per view key
//  (Iske bina back karne pe shelf hamesha top pe chala jata hai)
// ═══════════════════════════════════════════════════════════════
export function saveShelfScroll(featureKey, scrollLeft) {
  if (!featureKey) return;
  _shelfScroll[featureKey] = Number(scrollLeft) || 0;
}

export function getShelfScroll(featureKey) {
  if (!featureKey) return 0;
  const v = _shelfScroll[featureKey];
  return typeof v === 'number' ? v : 0;
}

export function clearShelfScroll(featureKey) {
  if (featureKey) delete _shelfScroll[featureKey];
}
// ═══════════════════════════════════════════════════════════════
//  BACK BUTTON INTERCEPTOR
//  Feature supplies a handler(container) → returns true if handled
//  (prevents router's back), false to let router handle it.
// ═══════════════════════════════════════════════════════════════
export function registerBackInterceptor(featureKey, handler) {
  if (!featureKey || typeof handler !== 'function') return;

  // Remove any previous
  unregisterBackInterceptor(featureKey);

  const backBtn = document.querySelector('#feature-back-btn');
  if (!backBtn) return;
  const header = backBtn.parentElement;
  if (!header) return;

  const wrapper = function (e) {
    if (!backBtn.contains(e.target) && e.target !== backBtn) return;

    let handled = false;
    try {
      handled = handler(e);
    } catch (err) {
      console.warn('back interceptor error:', err);
    }

    if (handled) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // Capture phase on parent → fires before router's target-phase handler
  header.addEventListener('click', wrapper, true);
  _backRegistry.set(featureKey, { wrapper, header });
}

export function unregisterBackInterceptor(featureKey) {
  const rec = _backRegistry.get(featureKey);
  if (!rec) return;
  rec.header.removeEventListener('click', rec.wrapper, true);
  _backRegistry.delete(featureKey);
}

// ═══════════════════════════════════════════════════════════════
//  CONVENIENCE
// ═══════════════════════════════════════════════════════════════
export function onFeatureOpen(featureKey) {
  return getFeatureState(featureKey) || {};
}

export function onFeatureClose(featureKey, rootEl) {
  if (rootEl) saveScroll(featureKey, rootEl);
}
export function resetAll() {
  Object.keys(_features).forEach(k => delete _features[k]);
  Object.keys(_scroll).forEach(k => delete _scroll[k]);
  Object.keys(_shelfScroll).forEach(k => delete _shelfScroll[k]);   // 🆕
  _backRegistry.forEach((rec, key) => {
    rec.header.removeEventListener('click', rec.wrapper, true);
  });
  _backRegistry.clear();
}