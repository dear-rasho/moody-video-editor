// ================================================================
//  js/features/audioeffect.js
//  Audio FX — creates effect LAYERS on the audio timeline.
//  Builders imported from shared audioFxBuilders.js
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  createAudioFxLayer,
  getSelectedAudioFxLayer,
  removeAudioFxLayer
} from '../workspace/audioEffectLayer.js';
import { registerAudioFxBuilder, resumeAudioContext } from '../workspace/audioFxEngine.js';
import { BUILDERS } from '../workspace/audioFxBuilders.js';

export const featureKey = 'audioeffect';
export const featureLabel = 'Audio FX';
export const featureIcon = '🎙️';

// Register all builders with the engine
Object.keys(BUILDERS).forEach(key => {
  registerAudioFxBuilder(key, BUILDERS[key]);
});

// ═══════════════════════════════════════════════════════════════
//  EFFECT CATALOG (UI metadata only — builders live in shared module)
// ═══════════════════════════════════════════════════════════════
const EFFECTS = [
  { key: 'studio',    label: 'Studio',     icon: '🎙️', group: 'Enhance' },
  { key: 'warm',      label: 'Warm',       icon: '☕',  group: 'Enhance' },
  { key: 'bright',    label: 'Bright',     icon: '✨', group: 'Enhance' },
  { key: 'vocal',     label: 'Vocal',      icon: '🎤', group: 'Enhance' },
  { key: 'podcast',   label: 'Podcast',    icon: '🎧', group: 'Enhance' },

  { key: 'deep',      label: 'Deep',       icon: '🐻', group: 'Voice' },
  { key: 'monster',   label: 'Monster',    icon: '👹', group: 'Voice' },
  { key: 'chipmunk',  label: 'Chipmunk',   icon: '🐿️', group: 'Voice' },
  { key: 'baby',      label: 'Baby',       icon: '👶', group: 'Voice' },
  { key: 'robot',     label: 'Robot',      icon: '🤖', group: 'Voice' },

  { key: 'echo',      label: 'Echo',       icon: '🔊', group: 'Space' },
  { key: 'reverb',    label: 'Reverb',     icon: '🏛️', group: 'Space' },
  { key: 'cave',      label: 'Cave',       icon: '🕳️', group: 'Space' },
  { key: 'stadium',   label: 'Stadium',    icon: '🏟️', group: 'Space' },
  { key: 'telephone', label: 'Telephone',  icon: '☎️', group: 'Space' },

  { key: 'underwater', label: 'Underwater', icon: '🌊', group: 'Creative' },
  { key: 'whisper',    label: 'Whisper',    icon: '🤫', group: 'Creative' },
  { key: 'radio',      label: 'Old Radio',  icon: '📻', group: 'Creative' }
];

const EFFECT_MAP = {};
EFFECTS.forEach(e => { EFFECT_MAP[e.key] = e; });

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installAudioEffectRenderer() {
  if (featuresRouter.__audioEffectInstalled) return;
  featuresRouter.__audioEffectInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'audioeffectPanel') {
      this.title.textContent = view.title;
      this.backButton.hidden = view.level === 0;
      this.shelf.classList.remove('circle-shelf');
      this.shelf.style.cssText = '';
      this.shelf.replaceChildren();
      renderTo(this.shelf);
      return;
    }
    return _origRender(view);
  };
})();

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'audioeffect-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .ax-panel{display:flex;flex-direction:column;gap:8px;width:100%;padding:10px 8px 14px;box-sizing:border-box;}
    .ax-panel *{box-sizing:border-box;}
    .ax-hint{font-size:10px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;opacity:.65;padding:0 4px;line-height:1.4;}
    .ax-info{padding:8px 12px;background:rgba(255,209,102,.15);border:1px solid #ffd166;border-radius:8px;font-size:11px;color:#ffd166;font-weight:700;letter-spacing:.02em;}
    .ax-group-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 2px 2px;}
    .ax-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;width:100%;}
    .ax-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:86px;padding:10px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:inherit;transition:all .12s ease;-webkit-tap-highlight-color:transparent;}
    .ax-item:active{background:var(--surface-3);}
    .ax-icon{width:38px;height:38px;border-radius:50%;border:1px solid var(--border);display:grid;place-items:center;font-size:18px;background:var(--surface);}
    .ax-label{font-size:11px;font-weight:600;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}
    .ax-revert-btn{width:100%;padding:11px 16px;min-height:44px;background:var(--surface);color:var(--danger);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px;}
    .ax-revert-btn:active{background:var(--surface-3);}
    @media (max-width:380px){.ax-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px;}.ax-item{min-height:78px;padding:8px 3px;}.ax-icon{width:32px;height:32px;font-size:15px;}.ax-label{font-size:10px;}}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════
export function open({ router }) {
  router.openLevel('audioeffect', [], {
    title: 'Audio FX',
    level: 2,
    renderMode: 'audioeffectPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  try { resumeAudioContext(); } catch (_) {}

  const panel = document.createElement('div');
  panel.className = 'ax-panel';

  const hint = document.createElement('div');
  hint.className = 'ax-hint';
  hint.textContent = 'Tap an effect to add an Audio FX layer at the playhead';
  panel.appendChild(hint);

  const sel = getSelectedAudioFxLayer();
  if (sel) {
    const info = document.createElement('div');
    info.className = 'ax-info';
    const eff = EFFECT_MAP[sel.clip.__audioFxKey] || {};
    info.textContent = '🎙️ Selected: ' + (eff.label || sel.clip.__audioFxKey) +
                       ' — trim/drag on timeline to adjust range';
    panel.appendChild(info);
  }

  const GROUPS = ['Enhance', 'Voice', 'Space', 'Creative'];

  GROUPS.forEach(groupName => {
    const title = document.createElement('div');
    title.className = 'ax-group-title';
    title.textContent = groupName;
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'ax-grid';

    EFFECTS.filter(e => e.group === groupName).forEach(effect => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ax-item';

      const ic = document.createElement('span');
      ic.className = 'ax-icon';
      ic.textContent = effect.icon;

      const lb = document.createElement('span');
      lb.className = 'ax-label';
      lb.textContent = effect.label;

      item.append(ic, lb);

      item.addEventListener('click', () => {
        try { resumeAudioContext(); } catch (_) {}
        const id = createAudioFxLayer(effect.key, effect.icon + ' ' + effect.label);
        if (id) showToast('Added ' + effect.label);
        const c = document.querySelector('#feature-shelf');
        if (c) renderTo(c);
      });

      grid.appendChild(item);
    });

    panel.appendChild(grid);
  });

  if (sel) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ax-revert-btn';
    removeBtn.textContent = '🗑 Remove Selected FX Layer';
    removeBtn.addEventListener('click', () => {
      removeAudioFxLayer(sel.clip);
      showToast('FX layer removed');
      const c = document.querySelector('#feature-shelf');
      if (c) renderTo(c);
    });
    panel.appendChild(removeBtn);
  }

  container.appendChild(panel);
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)','background:rgba(0,0,0,0.9)',
    'color:#fff','padding:9px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit'
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}