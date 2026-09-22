// ================================================================
//  js/features/effect.js
//  Effects shelf — creates effect layers as presets.
//  Full library: 70+ motion + 100+ color grades.
// ================================================================

import { featuresRouter } from './featuresRouter.js';
import {
  getSelectedEffectLayer,
  hasSelectedLayer,
  createEffectLayer,
  createEffectLayerAtRange,
  updateEffectLayer,
  findEffectLayerById
} from '../workspace/effectLayer.js';

export const featureKey = 'effect';
export const featureLabel = 'Effects';
export const featureIcon = '✨';

// ═══════════════════════════════════════════════════════════════
//  PRESET LIBRARY
// ═══════════════════════════════════════════════════════════════
const PRESETS = [
  // ─── MOTION: SHAKE FAMILY ────────────────────────────────
  { key: 'shake',      label: 'Shake',       icon: '📳', kind: 'motion',
    motion: { type: 'shake', intensity: 90,  speed: 1.2 } },
  { key: 'tremor',     label: 'Tremor',      icon: '💥', kind: 'motion',
    motion: { type: 'shake', intensity: 140, speed: 1.5 } },
  { key: 'quake',      label: 'Quake',       icon: '🌋', kind: 'motion',
    motion: { type: 'shake', intensity: 180, speed: 1.8 } },
  { key: 'earthquake', label: 'Earthquake',  icon: '🏚️', kind: 'motion',
    motion: { type: 'shake', intensity: 220, speed: 2.0 } },
  { key: 'hit',        label: 'Hit',         icon: '👊', kind: 'motion',
    motion: { type: 'shake', intensity: 130, speed: 2.2 } },
  { key: 'impact',     label: 'Impact',      icon: '💢', kind: 'motion',
    motion: { type: 'shake', intensity: 150, speed: 1.6 } },
  { key: 'jolt',       label: 'Jolt',        icon: '⚡', kind: 'motion',
    motion: { type: 'shake', intensity: 120, speed: 2.5 } },
  { key: 'rumble',     label: 'Rumble',      icon: '🥁', kind: 'motion',
    motion: { type: 'shake', intensity: 160, speed: 1.3 } },
  { key: 'vibration',  label: 'Vibration',   icon: '📱', kind: 'motion',
    motion: { type: 'shake', intensity: 60,  speed: 3.0 } },
  { key: 'micro',      label: 'Micro Shake', icon: '🫨', kind: 'motion',
    motion: { type: 'shake', intensity: 40,  speed: 4.0 } },
  { key: 'jitter',     label: 'Jitter',      icon: '🥶', kind: 'motion',
    motion: { type: 'shake', intensity: 70,  speed: 3.5 } },
  { key: 'chaos',      label: 'Chaos',       icon: '🌀', kind: 'motion',
    motion: { type: 'shake', intensity: 170, speed: 2.6 } },
  { key: 'turbulent',  label: 'Turbulent',   icon: '🌪️', kind: 'motion',
    motion: { type: 'shake', intensity: 130, speed: 3.2 } },

  // ─── MOTION: BOUNCE FAMILY ───────────────────────────────
  { key: 'bounce',     label: 'Bounce',      icon: '🏀', kind: 'motion',
    motion: { type: 'bounce', intensity: 100, speed: 1.4 } },
  { key: 'punch',      label: 'Punch',       icon: '🥊', kind: 'motion',
    motion: { type: 'bounce', intensity: 130, speed: 1.8 } },
  { key: 'kick',       label: 'Kick',        icon: '🦵', kind: 'motion',
    motion: { type: 'bounce', intensity: 140, speed: 2.2 } },
  { key: 'throb',      label: 'Throb',       icon: '💓', kind: 'motion',
    motion: { type: 'bounce', intensity: 90,  speed: 1.0 } },
  { key: 'beat',       label: 'Beat',        icon: '🎵', kind: 'motion',
    motion: { type: 'bounce', intensity: 110, speed: 1.6 } },
  { key: 'drop',       label: 'Drop',        icon: '📉', kind: 'motion',
    motion: { type: 'bounce', intensity: 120, speed: 1.3 } },
  { key: 'spring',     label: 'Spring',      icon: '🪀', kind: 'motion',
    motion: { type: 'bounce', intensity: 150, speed: 1.9 } },
  { key: 'elastic',    label: 'Elastic',     icon: '🪃', kind: 'motion',
    motion: { type: 'bounce', intensity: 130, speed: 1.5 } },
  { key: 'boing',      label: 'Boing',       icon: '🟢', kind: 'motion',
    motion: { type: 'bounce', intensity: 160, speed: 2.1 } },
  { key: 'headbang',   label: 'Headbang',    icon: '🤘', kind: 'motion',
    motion: { type: 'bounce', intensity: 150, speed: 1.5 } },

  // ─── MOTION: PULSE FAMILY ────────────────────────────────
  { key: 'pulse',      label: 'Pulse',       icon: '💓', kind: 'motion',
    motion: { type: 'pulse', intensity: 100, speed: 1.2 } },
  { key: 'heartbeat',  label: 'Heartbeat',   icon: '❤️', kind: 'motion',
    motion: { type: 'pulse', intensity: 130, speed: 0.6 } },
  { key: 'breath',     label: 'Breathe',     icon: '🫁', kind: 'motion',
    motion: { type: 'pulse', intensity: 80,  speed: 0.5 } },
  { key: 'pump',       label: 'Pump',        icon: '💪', kind: 'motion',
    motion: { type: 'pulse', intensity: 110, speed: 1.8 } },
  { key: 'thump',      label: 'Thump',       icon: '🫀', kind: 'motion',
    motion: { type: 'pulse', intensity: 140, speed: 0.8 } },
  { key: 'drum',       label: 'Drum',        icon: '🥁', kind: 'motion',
    motion: { type: 'pulse', intensity: 120, speed: 2.0 } },

  // ─── MOTION: ZOOM FAMILY ─────────────────────────────────
  { key: 'zoomPulse',  label: 'Zoom Pulse',  icon: '🔍', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 100, speed: 1.0 } },
  { key: 'zoomHard',   label: 'Zoom Hard',   icon: '🔎', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 180, speed: 1.2 } },
  { key: 'zoomSoft',   label: 'Zoom Soft',   icon: '🔍', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 60,  speed: 0.8 } },
  { key: 'push',       label: 'Push',        icon: '➡️', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 140, speed: 1.1 } },
  { key: 'pull',       label: 'Pull',        icon: '⬅️', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 120, speed: 0.9 } },
  { key: 'rush',       label: 'Rush',        icon: '⚡', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 160, speed: 1.5 } },
  { key: 'slam',       label: 'Slam',        icon: '💥', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 200, speed: 1.8 } },
  { key: 'zoomBreathe',label: 'Zoom Breathe',icon: '🌬️', kind: 'motion',
    motion: { type: 'zoomPulse', intensity: 80,  speed: 0.7 } },

  // ─── MOTION: ROTATE FAMILY ───────────────────────────────
  { key: 'wobble',     label: 'Wobble',      icon: '🔄', kind: 'motion',
    motion: { type: 'rotate', intensity: 80,  speed: 1.0 } },
  { key: 'swing',      label: 'Swing',       icon: '🎢', kind: 'motion',
    motion: { type: 'rotate', intensity: 100, speed: 1.2 } },
  { key: 'sway',       label: 'Sway',        icon: '🌊', kind: 'motion',
    motion: { type: 'rotate', intensity: 50,  speed: 0.8 } },
  { key: 'rock',       label: 'Rock',        icon: '🪨', kind: 'motion',
    motion: { type: 'rotate', intensity: 90,  speed: 1.0 } },
  { key: 'spin',       label: 'Spin',        icon: '🌪️', kind: 'motion',
    motion: { type: 'rotate', intensity: 200, speed: 2.0 } },
  { key: 'roll',       label: 'Roll',        icon: '🎳', kind: 'motion',
    motion: { type: 'rotate', intensity: 120, speed: 1.4 } },
  { key: 'whirl',      label: 'Whirl',       icon: '🌀', kind: 'motion',
    motion: { type: 'rotate', intensity: 180, speed: 1.8 } },
  { key: 'pendulum',   label: 'Pendulum',    icon: '🕰️', kind: 'motion',
    motion: { type: 'rotate', intensity: 110, speed: 0.9 } },
  { key: 'tilt',       label: 'Tilt',        icon: '📐', kind: 'motion',
    motion: { type: 'rotate', intensity: 60,  speed: 0.7 } },
  { key: 'drift',      label: 'Drift',       icon: '🎈', kind: 'motion',
    motion: { type: 'rotate', intensity: 40,  speed: 0.4 } },

  // ─── MOTION: GLITCH FAMILY ───────────────────────────────
  { key: 'glitch',     label: 'Glitch',      icon: '⚡', kind: 'motion',
    motion: { type: 'glitch', intensity: 100, speed: 2.0 } },
  { key: 'noise',      label: 'Noise',       icon: '📺', kind: 'motion',
    motion: { type: 'glitch', intensity: 120, speed: 2.5 } },
  { key: 'digital',    label: 'Digital',     icon: '💻', kind: 'motion',
    motion: { type: 'glitch', intensity: 100, speed: 3.0 } },
  { key: 'rgbSplit',   label: 'RGB Split',   icon: '🌈', kind: 'motion',
    motion: { type: 'glitch', intensity: 85,  speed: 2.1 } },
  { key: 'pixel',      label: 'Pixel Glitch',icon: '🟦', kind: 'motion',
    motion: { type: 'glitch', intensity: 80,  speed: 2.8 } },
  { key: 'stutter',    label: 'Stutter',     icon: '⏸️', kind: 'motion',
    motion: { type: 'glitch', intensity: 140, speed: 4.0 } },
  { key: 'tear',       label: 'Tear',        icon: '✂️', kind: 'motion',
    motion: { type: 'glitch', intensity: 110, speed: 3.2 } },
  { key: 'vhs',        label: 'VHS',         icon: '📼', kind: 'motion',
    motion: { type: 'glitch', intensity: 130, speed: 2.0 } },
  { key: 'staticFx',   label: 'Static',      icon: '📻', kind: 'motion',
    motion: { type: 'glitch', intensity: 150, speed: 3.5 } },
  { key: 'tracking',   label: 'Tracking',    icon: '📡', kind: 'motion',
    motion: { type: 'glitch', intensity: 100, speed: 2.4 } },
  { key: 'datamosh',   label: 'Data Moshing',icon: '🌀', kind: 'motion',
    motion: { type: 'glitch', intensity: 110, speed: 2.3 } },
  { key: 'signalLoss', label: 'Signal Loss', icon: '📵', kind: 'motion',
    motion: { type: 'glitch', intensity: 160, speed: 3.8 } },

  // ─── MOTION: FLICKER FAMILY ──────────────────────────────
  { key: 'flicker',    label: 'Flicker',     icon: '🕯️', kind: 'motion',
    motion: { type: 'glitch', intensity: 60,  speed: 3.0 } },
  { key: 'strobe',     label: 'Strobe',      icon: '💡', kind: 'motion',
    motion: { type: 'glitch', intensity: 90,  speed: 5.0 } },
  { key: 'flashFast',  label: 'Flash Fast',  icon: '⚡', kind: 'motion',
    motion: { type: 'glitch', intensity: 70,  speed: 6.0 } },
  { key: 'tv',         label: 'TV Static',   icon: '📺', kind: 'motion',
    motion: { type: 'glitch', intensity: 50,  speed: 2.5 } },
  { key: 'lightning',  label: 'Lightning',   icon: '🌩️', kind: 'motion',
    motion: { type: 'glitch', intensity: 120, speed: 4.2 } },
  { key: 'blink',      label: 'Blink',       icon: '😉', kind: 'motion',
    motion: { type: 'glitch', intensity: 40,  speed: 7.0 } },
  { key: 'spark',      label: 'Spark',       icon: '✨', kind: 'motion',
    motion: { type: 'glitch', intensity: 75,  speed: 4.8 } },

  // ═══ COLOR: ORIGINAL ════════════════════════════════════
  { key: 'warm',       label: 'Warm Glow',   icon: '🌅', filters: { brightness: 108, contrast: 105, saturation: 115 } },
  { key: 'cool',       label: 'Cool Blue',   icon: '❄️', filters: { brightness: 100, contrast: 108, saturation: 95 } },
  { key: 'vintage',    label: 'Vintage',     icon: '📼', filters: { brightness: 98, contrast: 92, saturation: 80, sepia: 25 } },
  { key: 'cinematic',  label: 'Cinematic',   icon: '🎬', filters: { brightness: 98, contrast: 118, saturation: 90 } },
  { key: 'bw',         label: 'Black & White',icon: '⚫', filters: { grayscale: 100, contrast: 110 } },
  { key: 'dreamy',     label: 'Dreamy',      icon: '💭', filters: { brightness: 105, contrast: 92, saturation: 105, blur: 0.6 } },
  { key: 'vivid',      label: 'Vivid',       icon: '🎨', filters: { brightness: 102, contrast: 112, saturation: 145 } },
  { key: 'faded',      label: 'Faded',       icon: '🌫️', filters: { brightness: 108, contrast: 82, saturation: 75 } },
  { key: 'dramatic',   label: 'Dramatic',    icon: '🎭', filters: { contrast: 130, saturation: 110 } },
  { key: 'negative',   label: 'Negative',    icon: '🔄', filters: { invert: 100 } },
  { key: 'softGlow',   label: 'Soft Glow',   icon: '💫', filters: { brightness: 112, contrast: 95, saturation: 108, blur: 0.4 } },
  { key: 'noir',       label: 'Noir',        icon: '🖤', filters: { grayscale: 100, contrast: 135, brightness: 92 } },

  // ═══ COLOR: CINEMATIC ══════════════════════════════════
  { key: 'tealOrange', label: 'Teal & Orange',icon: '🟠', filters: { brightness: 100, contrast: 115, saturation: 110 } },
  { key: 'hollywood',  label: 'Hollywood',   icon: '🌟', filters: { brightness: 98, contrast: 120, saturation: 105 } },
  { key: 'blockbuster',label: 'Blockbuster', icon: '🎥', filters: { brightness: 102, contrast: 118, saturation: 115 } },
  { key: 'filmLook',   label: 'Film Look',   icon: '🎞️', filters: { brightness: 96, contrast: 116, saturation: 92 } },
  { key: 'drama',      label: 'Drama',       icon: '🎭', filters: { brightness: 92, contrast: 128, saturation: 88 } },
  { key: 'epic',       label: 'Epic',        icon: '⚔️', filters: { brightness: 100, contrast: 125, saturation: 110 } },
  { key: 'thriller',   label: 'Thriller',    icon: '🔪', filters: { brightness: 88, contrast: 135, saturation: 85 } },

  // ═══ COLOR: FILM / VINTAGE ═════════════════════════════
  { key: 'bleach',     label: 'Bleach',      icon: '🧴', filters: { brightness: 105, contrast: 140, saturation: 55 } },
  { key: 'bleachBypass',label: 'Bleach Bypass',icon: '⚪', filters: { brightness: 102, contrast: 145, saturation: 50 } },
  { key: 'sepiaMem',   label: 'Sepia Memory',icon: '🟤', filters: { brightness: 100, contrast: 100, saturation: 65, sepia: 55 } },
  { key: 'sepiaDeep',  label: 'Sepia Deep',  icon: '🟫', filters: { brightness: 95, contrast: 105, saturation: 60, sepia: 75 } },
  { key: 'retro8mm',   label: 'Retro 8mm',   icon: '📽️', filters: { brightness: 102, contrast: 108, saturation: 75, sepia: 30 } },
  { key: 'kodak',      label: 'Kodak Film',  icon: '📷', filters: { brightness: 102, contrast: 110, saturation: 118, sepia: 8 } },
  { key: 'polaroid',   label: 'Polaroid',    icon: '🖼️', filters: { brightness: 105, contrast: 95, saturation: 90, sepia: 15 } },
  { key: 'oldFilm',    label: 'Old Film',    icon: '🎞️', filters: { brightness: 95, contrast: 108, saturation: 70, sepia: 40 } },
  { key: 'antique',    label: 'Antique',     icon: '🏛️', filters: { brightness: 92, contrast: 105, saturation: 75, sepia: 60 } },

  // ═══ COLOR: MONOCHROME ═════════════════════════════════
  { key: 'monochrome', label: 'Monochrome',  icon: '⬛', filters: { grayscale: 100, contrast: 120 } },
  { key: 'graySoft',   label: 'Gray Soft',   icon: '🌫️', filters: { grayscale: 100, contrast: 90, brightness: 105 } },
  { key: 'grayHard',   label: 'Gray Hard',   icon: '⬜', filters: { grayscale: 100, contrast: 145 } },
  { key: 'inkwell',    label: 'Inkwell',     icon: '🖋️', filters: { grayscale: 100, contrast: 160, brightness: 90 } },
  { key: 'filmNoir',   label: 'Film Noir',   icon: '🌑', filters: { grayscale: 100, contrast: 155, brightness: 88 } },

  // ═══ COLOR: NEON / CYBERPUNK ═══════════════════════════
  { key: 'cyberpunk',  label: 'Cyberpunk',   icon: '🤖', filters: { brightness: 105, contrast: 120, saturation: 170 } },
  { key: 'vaporwave',  label: 'Vaporwave',   icon: '🌆', filters: { brightness: 102, contrast: 108, saturation: 165 } },
  { key: 'synthwave',  label: 'Synthwave',   icon: '🎹', filters: { brightness: 100, contrast: 125, saturation: 155 } },
  { key: 'plasma',     label: 'Plasma',      icon: '🔥', filters: { brightness: 108, contrast: 115, saturation: 175 } },
  { key: 'electric',   label: 'Electric',    icon: '⚡', filters: { brightness: 105, contrast: 122, saturation: 180 } },
  { key: 'techno',     label: 'Techno',      icon: '🎛️', filters: { brightness: 100, contrast: 130, saturation: 165 } },
  { key: 'neonCity',   label: 'Neon City',   icon: '🌃', filters: { brightness: 102, contrast: 118, saturation: 175 } },
  { key: 'retrowave',  label: 'Retrowave',   icon: '🕹️', filters: { brightness: 100, contrast: 112, saturation: 160 } },

  // ═══ COLOR: WARM ═══════════════════════════════════════
  { key: 'gold',       label: 'Gold',        icon: '🟡', filters: { brightness: 108, contrast: 108, saturation: 130 } },
  { key: 'sunrise',    label: 'Sunrise',     icon: '🌅', filters: { brightness: 110, contrast: 100, saturation: 125 } },
  { key: 'sunset',     label: 'Sunset',      icon: '🌇', filters: { brightness: 105, contrast: 105, saturation: 140 } },
  { key: 'goldenHour', label: 'Golden Hour', icon: '⏰', filters: { brightness: 112, contrast: 102, saturation: 135 } },
  { key: 'amber',      label: 'Amber',       icon: '🟠', filters: { brightness: 105, contrast: 105, saturation: 125 } },
  { key: 'ember',      label: 'Ember',       icon: '🔥', filters: { brightness: 100, contrast: 115, saturation: 135 } },
  { key: 'copper',     label: 'Copper',      icon: '🟤', filters: { brightness: 102, contrast: 108, saturation: 128 } },
  { key: 'autumn',     label: 'Autumn',      icon: '🍂', filters: { brightness: 100, contrast: 105, saturation: 140 } },

  // ═══ COLOR: COOL ═══════════════════════════════════════
  { key: 'moonlight',  label: 'Moonlight',   icon: '🌙', filters: { brightness: 95, contrast: 110, saturation: 90 } },
  { key: 'midnight',   label: 'Midnight',    icon: '🌌', filters: { brightness: 85, contrast: 120, saturation: 95 } },
  { key: 'ice',        label: 'Ice',         icon: '🧊', filters: { brightness: 110, contrast: 105, saturation: 100 } },
  { key: 'frost',      label: 'Frost',       icon: '❄️', filters: { brightness: 108, contrast: 108, saturation: 95 } },
  { key: 'ocean',      label: 'Ocean',       icon: '🌊', filters: { brightness: 100, contrast: 110, saturation: 120 } },
  { key: 'sky',        label: 'Sky',         icon: '☁️', filters: { brightness: 105, contrast: 100, saturation: 115 } },
  { key: 'deepBlue',   label: 'Deep Blue',   icon: '🔵', filters: { brightness: 90, contrast: 115, saturation: 130 } },

  // ═══ COLOR: MOODY / DARK ═══════════════════════════════
  { key: 'moody',      label: 'Moody',       icon: '🌑', filters: { brightness: 90, contrast: 118, saturation: 85 } },
  { key: 'darkDrama',  label: 'Dark Drama',  icon: '🎬', filters: { brightness: 85, contrast: 130, saturation: 80 } },
  { key: 'grunge',     label: 'Grunge',      icon: '🖤', filters: { brightness: 95, contrast: 135, saturation: 70 } },
  { key: 'gritty',     label: 'Gritty',      icon: '⚫', filters: { brightness: 92, contrast: 132, saturation: 88 } },
  { key: 'somber',     label: 'Somber',      icon: '🌧️', filters: { brightness: 88, contrast: 115, saturation: 75 } },

  // ═══ COLOR: SPECIAL FX ═════════════════════════════════
  { key: 'infrared',   label: 'Infrared',    icon: '🟥', filters: { brightness: 105, contrast: 115, saturation: 160, invert: 20 } },
  { key: 'matrix',     label: 'Matrix',      icon: '🟢', filters: { brightness: 95, contrast: 120, saturation: 130 } },
  { key: 'thermal',    label: 'Thermal',     icon: '🌡️', filters: { brightness: 108, contrast: 125, saturation: 180 } },
  { key: 'xray',       label: 'X-Ray',       icon: '🩻', filters: { brightness: 100, contrast: 150, saturation: 10, invert: 30 } },
  { key: 'negativeSoft',label: 'Negative Soft',icon: '🔄', filters: { invert: 50, contrast: 105 } },
  { key: 'duotone',    label: 'Duotone',     icon: '🎨', filters: { brightness: 100, contrast: 125, saturation: 110 } },
  { key: 'spectrum',   label: 'Spectrum',    icon: '🌈', filters: { brightness: 105, contrast: 115, saturation: 175 } },
  { key: 'hyperSat',   label: 'Hyper Sat',   icon: '🎆', filters: { brightness: 102, contrast: 108, saturation: 190 } },

  // ═══ COLOR: SOFT / DREAMY ══════════════════════════════
  { key: 'softFocus',  label: 'Soft Focus',  icon: '💫', filters: { brightness: 108, contrast: 95, saturation: 108, blur: 0.8 } },
  { key: 'pastel',     label: 'Pastel',      icon: '🌸', filters: { brightness: 112, contrast: 88, saturation: 95 } },
  { key: 'creamy',     label: 'Creamy',      icon: '🍦', filters: { brightness: 108, contrast: 92, saturation: 100, sepia: 10 } },
  { key: 'haze',       label: 'Haze',        icon: '🌁', filters: { brightness: 110, contrast: 85, saturation: 100, blur: 0.7 } },
  { key: 'bloom',      label: 'Bloom',       icon: '🌺', filters: { brightness: 118, contrast: 95, saturation: 115, blur: 0.4 } },
  { key: 'ethereal',   label: 'Ethereal',    icon: '👻', filters: { brightness: 112, contrast: 90, saturation: 115, blur: 0.8 } },

  // ═══ COLOR: HDR / CONTRAST ═════════════════════════════
  { key: 'hdr',        label: 'HDR',         icon: '🔆', filters: { brightness: 105, contrast: 135, saturation: 125 } },
  { key: 'punchy',     label: 'Punchy',      icon: '👊', filters: { brightness: 100, contrast: 130, saturation: 140 } },
  { key: 'dynamic',    label: 'Dynamic',     icon: '💥', filters: { brightness: 105, contrast: 128, saturation: 130 } },
  { key: 'vividHard',  label: 'Vivid Hard',  icon: '🎨', filters: { brightness: 102, contrast: 120, saturation: 170 } },
  { key: 'contrastMax',label: 'Contrast Max',icon: '◐', filters: { brightness: 95, contrast: 155, saturation: 120 } },

  // ═══ COLOR: SEPIA ══════════════════════════════════════
  { key: 'sepia',      label: 'Sepia',       icon: '🟫', filters: { sepia: 100 } },
  { key: 'sepiaWarm',  label: 'Sepia Warm',  icon: '🟤', filters: { sepia: 75, brightness: 103, contrast: 105 } },
  { key: 'brownTone',  label: 'Brown Tone',  icon: '🍫', filters: { sepia: 85, brightness: 98, contrast: 108 } },
  { key: 'coffee',     label: 'Coffee',      icon: '☕', filters: { sepia: 60, brightness: 95, contrast: 110 } },

  // ═══ COLOR: FLASH / LIGHT ══════════════════════════════
  { key: 'flashWhite', label: 'Flash White', icon: '⚪', filters: { brightness: 200, contrast: 100, saturation: 100 } },
  { key: 'flashSoft',  label: 'Flash Soft',  icon: '🔆', filters: { brightness: 150, contrast: 108, saturation: 110 } },
  { key: 'lightBurst', label: 'Light Burst', icon: '💡', filters: { brightness: 175, contrast: 105, saturation: 120 } },
  { key: 'overexpose', label: 'Overexpose',  icon: '☀️', filters: { brightness: 165, contrast: 95, saturation: 105 } },

  // ═══ OVERLAY: PARTICLES ════════════════════════════════
  { key: 'oRain',      label: 'Rain',       icon: '🌧️', kind: 'overlay', overlay: { type: 'rain', intensity: 100 } },
  { key: 'oSnow',      label: 'Snow',       icon: '❄️', kind: 'overlay', overlay: { type: 'snow', intensity: 100 } },
  { key: 'oDust',      label: 'Dust',       icon: '🌫️', kind: 'overlay', overlay: { type: 'dust', intensity: 100 } },
  { key: 'oSparks',    label: 'Sparks',     icon: '✨', kind: 'overlay', overlay: { type: 'sparks', intensity: 100, color: '#ffaa33' } },
  { key: 'oEmbers',    label: 'Embers',     icon: '🔥', kind: 'overlay', overlay: { type: 'embers', intensity: 100 } },
  { key: 'oStars',     label: 'Stars',      icon: '⭐', kind: 'overlay', overlay: { type: 'stars', intensity: 100, color: '#ffffff' } },
  { key: 'oBokeh',     label: 'Bokeh',      icon: '🔮', kind: 'overlay', overlay: { type: 'bokeh', intensity: 100, color: '#ffd1ff' } },
  { key: 'oFireFlies', label: 'Fire Flies', icon: '🪰', kind: 'overlay', overlay: { type: 'fireFlies', intensity: 100 } },

  // ═══ OVERLAY: ATMOSPHERE ═══════════════════════════════
  { key: 'oFog',       label: 'Fog',        icon: '🌁', kind: 'overlay', overlay: { type: 'fog', intensity: 100, color: '#aabbcc' } },
  { key: 'oSmoke',     label: 'Smoke',      icon: '💨', kind: 'overlay', overlay: { type: 'smoke', intensity: 100 } },
  { key: 'oHaze',      label: 'Haze',       icon: '☁️', kind: 'overlay', overlay: { type: 'haze', intensity: 100, color: '#ddeeff' } },
  { key: 'oMist',      label: 'Mist',       icon: '🌊', kind: 'overlay', overlay: { type: 'mist', intensity: 100, color: '#ffffff' } },

  // ═══ OVERLAY: NOISE ════════════════════════════════════
  { key: 'oNoise',     label: 'Noise',      icon: '📡', kind: 'overlay', overlay: { type: 'noise', intensity: 100 } },
  { key: 'oFilmGrain', label: 'Film Grain', icon: '🎞️', kind: 'overlay', overlay: { type: 'filmGrain', intensity: 100 } },
  { key: 'oBlackNoise',label: 'Black Noise',icon: '⬛', kind: 'overlay', overlay: { type: 'blackNoise', intensity: 100 } },
  { key: 'oWhiteNoise',label: 'White Noise',icon: '⬜', kind: 'overlay', overlay: { type: 'whiteNoise', intensity: 100 } },
  { key: 'oScanlines', label: 'Scanlines',  icon: '📺', kind: 'overlay', overlay: { type: 'scanlines', intensity: 100 } },
  { key: 'oStaticTV',  label: 'Static TV',  icon: '📻', kind: 'overlay', overlay: { type: 'staticTV', intensity: 100 } },

  // ═══ OVERLAY: LIGHT ════════════════════════════════════
  { key: 'oLightLeak', label: 'Light Leak', icon: '🌅', kind: 'overlay', overlay: { type: 'lightLeak', intensity: 100 } },
  { key: 'oLensFlare', label: 'Lens Flare', icon: '💡', kind: 'overlay', overlay: { type: 'lensFlare', intensity: 100, color: '#d0e0ff' } },
  { key: 'oBloom',     label: 'Bloom',      icon: '🌺', kind: 'overlay', overlay: { type: 'bloom', intensity: 100, color: '#ffffff' } },
  { key: 'oSunburst',  label: 'Sunburst',   icon: '☀️', kind: 'overlay', overlay: { type: 'sunburst', intensity: 100 } },
  { key: 'oGodRays',   label: 'God Rays',   icon: '🌟', kind: 'overlay', overlay: { type: 'godRays', intensity: 100 } },

  // ═══ OVERLAY: FLICKER ══════════════════════════════════
  { key: 'oFlicker',   label: 'Flicker',    icon: '🕯️', kind: 'overlay', overlay: { type: 'flicker', intensity: 100 } },
  { key: 'oStrobe',    label: 'Strobe',     icon: '💡', kind: 'overlay', overlay: { type: 'strobe', intensity: 100 } },
  { key: 'oPulseFx',   label: 'Pulse FX',   icon: '💓', kind: 'overlay', overlay: { type: 'pulseFx', intensity: 100 } },
  { key: 'oBlink',     label: 'Blink',      icon: '😉', kind: 'overlay', overlay: { type: 'blink', intensity: 100 } },

  // ═══ OVERLAY: TONE WASH ════════════════════════════════
  { key: 'oBlueLake',  label: 'Blue Lake',  icon: '🌊', kind: 'overlay', overlay: { type: 'blueLake', intensity: 100 } },
  { key: 'oWarmWash',  label: 'Warm Wash',  icon: '🌅', kind: 'overlay', overlay: { type: 'warmWash', intensity: 100 } },
  { key: 'oCoolWash',  label: 'Cool Wash',  icon: '🧊', kind: 'overlay', overlay: { type: 'coolWash', intensity: 100 } },
  { key: 'oTealWash',  label: 'Teal Wash',  icon: '🟢', kind: 'overlay', overlay: { type: 'tealWash', intensity: 100 } },
  { key: 'oRoseWash',  label: 'Rose Wash',  icon: '🌸', kind: 'overlay', overlay: { type: 'roseWash', intensity: 100 } },

  // ═══ OVERLAY: EDGES ════════════════════════════════════
  { key: 'oSharpenEdges', label: 'Sharpen Edges', icon: '🔪', kind: 'overlay', overlay: { type: 'sharpenEdges', intensity: 100 } },
  { key: 'oEdgeGlow',     label: 'Edge Glow',     icon: '✨', kind: 'overlay', overlay: { type: 'edgeGlow', intensity: 100, color: '#00ffff' } },

  // ═══ OVERLAY: MISC ═════════════════════════════════════
  { key: 'oVignette',  label: 'Vignette',   icon: '🕳️', kind: 'overlay', overlay: { type: 'vignette', intensity: 100 } },
  { key: 'oBlackBars', label: 'Black Bars', icon: '📺', kind: 'overlay', overlay: { type: 'blackBars', intensity: 100 } },
  { key: 'oVhsLines',  label: 'VHS Lines',  icon: '📼', kind: 'overlay', overlay: { type: 'vhsLines', intensity: 100 } },
  { key: 'oGlitchBars',label: 'Glitch Bars',icon: '⚡', kind: 'overlay', overlay: { type: 'glitchBars', intensity: 100 } }
];

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let editingLayer = null;

// ═══════════════════════════════════════════════════════════════
//  ROUTER INSTALL
// ═══════════════════════════════════════════════════════════════
(function installEffectRenderer() {
  if (featuresRouter.__effectInstalled) return;
  featuresRouter.__effectInstalled = true;
  const _origRender = featuresRouter.render.bind(featuresRouter);
  featuresRouter.render = function (view) {
    if (view.renderMode === 'effectPanel') {
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
const CSS_ID = 'effect-styles';
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .ef-panel { display:flex;flex-direction:column;gap:10px;padding:10px 8px 14px;width:100%;box-sizing:border-box; }
    .ef-panel * { box-sizing:border-box; }
    .ef-warn { padding:10px 12px;background:rgba(255,107,107,0.12);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);font-weight:700; }
    .ef-badge { padding:8px 12px;background:rgba(255,209,102,0.15);border:1px solid #ffd166;border-radius:8px;font-size:11px;color:#ffd166;font-weight:700; }
    .ef-section-label { font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);padding:0 4px;opacity:0.7; }
    .ef-shelf-hint { font-size:9px;color:var(--muted);letter-spacing:0.04em;text-transform:uppercase;opacity:0.6;padding:0 2px; }
    .ef-shelf { display:flex;gap:8px;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin;touch-action:pan-x; }
    .ef-shelf::-webkit-scrollbar { height:5px; }
    .ef-shelf::-webkit-scrollbar-thumb { background:var(--border);border-radius:3px; }
    .ef-card { flex:0 0 92px;width:92px;min-height:92px;padding:8px 6px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;scroll-snap-align:start;transition:all 0.12s ease;-webkit-tap-highlight-color:transparent; }
    .ef-card:active { background:var(--surface-3); }
    .ef-card.active { border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent); }
    .ef-card.motion { border-left:3px solid #a78bfa; }
    .ef-icon { width:38px;height:38px;border-radius:50%;border:1px solid var(--border);display:grid;place-items:center;font-size:18px;background:var(--surface); }
    .ef-card.active .ef-icon { background:var(--accent);color:#000;border-color:var(--accent); }
    .ef-label { font-size:10.5px;font-weight:600;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%; }
    .ef-actions { display:flex;gap:8px;margin-top:6px; }
    .ef-btn { flex:1;padding:10px 12px;min-height:44px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit; }
    .ef-btn.danger { color:var(--danger); }
  `;
  document.head.appendChild(s);
}

export function open({ router }) {
  editingLayer = null;
  router.openLevel('effect', [], {
    title: 'Effects',
    level: 2,
    renderMode: 'effectPanel'
  });
}

export function renderTo(container) {
  injectStyles();
  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'ef-panel';

  if (!hasSelectedLayer()) {
    const warn = document.createElement('div');
    warn.className = 'ef-warn';
    warn.textContent = '⚠️ Select a timeline layer first';
    panel.appendChild(warn);
  }

  const currentSel = getSelectedEffectLayer('effect');
  const activeKey = currentSel && currentSel.clip && currentSel.clip.effectState
    ? currentSel.clip.effectState.presetKey
    : null;

  // Motion section
  panel.appendChild(buildSectionLabel('Motion (' + PRESETS.filter(p => p.kind === 'motion').length + ')'));
  panel.appendChild(buildShelf(
    PRESETS.filter(p => p.kind === 'motion'),
    activeKey,
    true
  ));

  // Color section
  panel.appendChild(buildSectionLabel('Color Grade (' + PRESETS.filter(p => p.kind !== 'motion' && p.kind !== 'overlay').length + ')'));
  panel.appendChild(buildShelf(
    PRESETS.filter(p => p.kind !== 'motion' && p.kind !== 'overlay'),
    activeKey,
    false
  ));

  // Overlay section
  panel.appendChild(buildSectionLabel('Overlays (' + PRESETS.filter(p => p.kind === 'overlay').length + ')'));
  panel.appendChild(buildShelf(
    PRESETS.filter(p => p.kind === 'overlay'),
    activeKey,
    false
  ));

  // Remove button
  if (currentSel && currentSel.clip) {
    const actions = document.createElement('div');
    actions.className = 'ef-actions';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ef-btn danger';
    removeBtn.textContent = '🗑 Remove "' +
      (currentSel.clip.name || 'Effect').slice(0, 20) + '"';
    removeBtn.addEventListener('click', removeCurrentLayer);

    actions.appendChild(removeBtn);
    panel.appendChild(actions);
  }

  container.appendChild(panel);
}

function buildSectionLabel(text) {
  const el = document.createElement('div');
  el.className = 'ef-section-label';
  el.textContent = text;
  return el;
}

function buildShelf(list, activeKey, isMotion) {
  const hint = document.createElement('div');
  hint.className = 'ef-shelf-hint';
  hint.textContent = '← Swipe →';

  const shelf = document.createElement('div');
  shelf.className = 'ef-shelf';

  list.forEach(preset => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ef-card';
    if (isMotion) card.classList.add('motion');
    if (activeKey === preset.key) card.classList.add('active');

    const ico = document.createElement('span');
    ico.className = 'ef-icon';
    ico.textContent = preset.icon;

    const lbl = document.createElement('span');
    lbl.className = 'ef-label';
    lbl.textContent = preset.label;

    card.append(ico, lbl);
    card.addEventListener('click', () => applyPreset(preset));
    shelf.appendChild(card);
  });

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '4px';
  wrap.style.minWidth = '0';
  wrap.append(hint, shelf);
  return wrap;
}

function applyPreset(preset) {
  if (!hasSelectedLayer()) {
    showToast('Select a timeline layer first', false);
    return;
  }

  const range = computeEffectRange();
  if (!range) {
    showToast('Move playhead onto a clip first', false);
    return;
  }

  const baseFilters = {
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    grayscale: 0, sepia: 0, invert: 0, blur: 0, opacity: 100
  };
  const filters = Object.assign(baseFilters, preset.filters || {});

  const payload = {
    presetKey: preset.key,
    filters: filters,
    motion: preset.motion || null
  };

  const state = Object.assign({ kind: 'effect' }, payload);
  const id = createEffectLayerAtRange(
    'effect',
    state,
    preset.label,
    range.start,
    range.duration
  );

  if (id) {
    showToast('Added ' + preset.label + ' · ' + range.duration.toFixed(2) + 's');
  } else {
    showToast('Failed to add effect', false);
    return;
  }

  document.dispatchEvent(new CustomEvent('effects:refresh'));

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.querySelector('#feature-shelf');
    if (c) renderTo(c);
  }));
}

function computeEffectRange() {
  const appState = window.__appState;
  if (!appState) return null;

  const eng = window.__playbackEngine;
  const playhead = eng && typeof eng.getTime === 'function' ? eng.getTime() : 0;

  const tracks = appState.timeline.visual || [];
  const hidden = appState.timeline.hiddenVisualTracks || new Set();

  let clipAtPlayhead = null;
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (hidden.has(t)) continue;
    const track = tracks[t];
    if (!Array.isArray(track)) continue;
    for (let c = 0; c < track.length; c++) {
      const clip = track[c];
      if (!clip || !clip.type) continue;
      const isV = clip.type.indexOf('video/') === 0;
      const isI = clip.type.indexOf('image/') === 0;
      if (!isV && !isI) continue;
      const s = Number.isFinite(clip.startTime) ? clip.startTime : 0;
      const d = Number.isFinite(clip.duration) ? clip.duration : 0;
      if (playhead >= s && playhead < s + d) {
        clipAtPlayhead = clip;
        break;
      }
    }
    if (clipAtPlayhead) break;
  }

  let target = clipAtPlayhead;
  if (!target) {
    const el = document.querySelector('.clip.selected');
    if (el) {
      const label = el.dataset.track;
      const clipIdx = Number(el.dataset.clip);
      if (label && label.charAt(0) === 'V' && Number.isFinite(clipIdx)) {
        const ti = Number(label.slice(1)) - 1;
        const tr = tracks[ti];
        if (Array.isArray(tr)) {
          const c = tr[clipIdx];
          if (c && c.type &&
              (c.type.indexOf('video/') === 0 || c.type.indexOf('image/') === 0)) {
            target = c;
          }
        }
      }
    }
  }

  if (!target) return null;

  const clipStart = Number.isFinite(target.startTime) ? target.startTime : 0;
  const clipDur = Number.isFinite(target.duration) ? target.duration : 3;
  const clipEnd = clipStart + clipDur;

  let start = Math.max(clipStart, Math.min(playhead, clipEnd - 0.15));
  let end = clipEnd;

  if (end - start < 0.15) {
    start = clipStart;
    end = clipEnd;
  }

  return { start, end, duration: Math.max(0.15, end - start) };
}

function removeCurrentLayer() {
  const sel = getSelectedEffectLayer('effect');
  if (!sel || !sel.clip) {
    showToast('No effect layer selected', false);
    return;
  }

  const clip = sel.clip;
  const appState = window.__appState;

  const allTracks = (appState && appState.timeline.visual) || [];
  let removed = false;
  for (let t = 0; t < allTracks.length; t++) {
    const track = allTracks[t];
    if (!Array.isArray(track)) continue;
    const idx = track.findIndex(c => c && c.__effectId === clip.__effectId);
    if (idx >= 0) {
      track.splice(idx, 1);
      removed = true;
      break;
    }
  }

  if (!removed) {
    showToast('Effect layer not found', false);
    return;
  }

  editingLayer = null;
  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  document.dispatchEvent(new CustomEvent('effects:refresh'));
  showToast('Effect layer removed');

  const c = document.querySelector('#feature-shelf');
  if (c) renderTo(c);
}

function showToast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:' + (ok ? 'rgba(0,0,0,0.9)' : 'rgba(180,40,40,0.92)'),
    'color:#fff','padding:10px 20px','border-radius:22px',
    'font-size:13px','font-weight:600','z-index:9999',
    'pointer-events:none','opacity:0',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'font-family:inherit','max-width:80vw','white-space:nowrap',
    'overflow:hidden','text-overflow:ellipsis'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, 1500);
}