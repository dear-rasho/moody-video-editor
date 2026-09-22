// ================================================================
//  js/codebase/fontLibrary.js
//  Font library — Google Fonts (online) + Local fonts (offline)
// ================================================================

import { LOCAL_FONTS, injectLocalFonts, isLocalFont, resolveLocalFontName } from './localFonts.js';

export const FONT_CATEGORIES = {
  // ═══ 🆕 LOCAL / CUSTOM (Offline, from ./fonts/) ═══════════
  custom: [
    'Amita', 'Bangela', 'Brisound', 'Chopin Script', 'Christmas Music',
    'Daffiys', 'Eighties', 'Fighter Attack', 'Forceless Demo',
    'Funkora', 'Funky Groove', 'Gwathlyn', 'Kaway', 'Komika',
    'Legendary Brush', 'Musiclife', 'Orchard Song', 'Pricedown',
    'Rengkox', 'Rockybilly', 'Rumburak', 'Shockwave'
  ],

  // ═══ SYSTEM (Always offline) ══════════════════════════════
  system: [
    'Arial', 'Helvetica', 'Segoe UI', 'Roboto', 'Inter',
    'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Candara',
    'Corbel', 'Franklin Gothic Medium', 'Lucida Grande', 'Geneva',
    'Optima', 'Avenir', 'Futura', 'Gill Sans',
    'Century Gothic', 'Tw Cen MT'
  ],

  // ═══ SERIF ═════════════════════════════════════════════════
  serif: [
    'Times New Roman', 'Georgia', 'Cambria', 'Constantia',
    'Palatino Linotype', 'Book Antiqua', 'Bookman Old Style',
    'Garamond', 'Baskerville', 'Didot', 'Rockwell', 'Courier New'
  ],

  // ═══ MONO ═════════════════════════════════════════════════
  mono: [
    'Courier New', 'Consolas', 'Monaco', 'Menlo', 'Lucida Console',
    'Andale Mono', 'Courier', 'Inconsolata', 'Source Code Pro',
    'Roboto Mono', 'Fira Code', 'JetBrains Mono', 'Space Mono',
    'IBM Plex Mono', 'Cascadia Code', 'Cascadia Mono'
  ],

  // ═══ DISPLAY / BOLD ═══════════════════════════════════════
  display: [
    'Shockwave', 'Fighter Attack', 'Pricedown', 'Rockybilly',
    'Impact', 'Arial Black', 'Franklin Gothic Heavy', 'Haettenschweiler',
    'Anton', 'Bebas Neue', 'Oswald', 'Archivo Black',
    'Bungee', 'Titan One', 'Bowlby One SC', 'Alfa Slab One',
    'Russo One', 'Righteous', 'Bungee Inline', 'Bungee Shade',
    'Monoton', 'Audiowide', 'Orbitron'
  ],

  // ═══ HANDWRITING / SCRIPT ═════════════════════════════════
  handwriting: [
    'Amita', 'Chopin Script', 'Gwathlyn', 'Legendary Brush',
    'Musiclife', 'Orchard Song',
    'Comic Sans MS', 'Brush Script MT', 'Segoe Script', 'Bradley Hand',
    'Lucida Handwriting', 'Apple Chancery',
    'Dancing Script', 'Pacifico', 'Great Vibes', 'Allura',
    'Alex Brush', 'Satisfy', 'Kaushan Script', 'Parisienne',
    'Sacramento', 'Tangerine', 'Caveat', 'Shadows Into Light',
    'Indie Flower', 'Amatic SC', 'Patrick Hand', 'Kalam'
  ],

  // ═══ ELEGANT ══════════════════════════════════════════════
  elegant: [
    'Amita', 'Orchard Song', 'Brisound',
    'Playfair Display', 'Cormorant Garamond', 'EB Garamond',
    'Lora', 'Merriweather', 'Crimson Text', 'Libre Baskerville',
    'Cinzel', 'Cormorant', 'Spectral', 'Prata', 'Cardo',
    'Bodoni Moda', 'Cormorant Upright', 'Abril Fatface'
  ],

  // ═══ MODERN ═══════════════════════════════════════════════
  modern: [
    'Brisound', 'Forceless Demo', 'Rengkox', 'Daffiys',
    'Poppins', 'Montserrat', 'Raleway', 'Work Sans',
    'DM Sans', 'Manrope', 'Space Grotesk', 'Outfit', 'Sora',
    'IBM Plex Sans', 'Public Sans', 'Archivo', 'Mulish',
    'Nunito', 'Rubik', 'Karla', 'Lato', 'Open Sans'
  ],

  // ═══ TITLES ═══════════════════════════════════════════════
  titles: [
    'Bangela', 'Shockwave', 'Fighter Attack', 'Pricedown',
    'Poppins', 'Montserrat', 'Raleway', 'Playfair Display',
    'Cinzel', 'Bebas Neue', 'Alfa Slab One', 'Archivo Black',
    'Abril Fatface', 'Bungee Shade', 'Bungee Inline', 'Russo One',
    'Anton', 'Oswald', 'Righteous', 'Bungee'
  ],

  // ═══ MUSIC / BOLD ═════════════════════════════════════════
  music: [
    'Eighties', 'Funkora', 'Funky Groove', 'Christmas Music',
    'Bebas Neue', 'Anton', 'Oswald', 'Righteous', 'Bungee',
    'Permanent Marker', 'Caveat Brush', 'Rock Salt', 'Amatic SC',
    'Kalam', 'Abril Fatface', 'Monoton', 'Titan One', 'Bowlby One SC'
  ],

  // ═══ PLAYFUL ══════════════════════════════════════════════
  playful: [
    'Komika', 'Kaway', 'Rumburak', 'Christmas Music',
    'Comic Sans MS', 'Baloo 2', 'Fredoka', 'Chewy', 'Luckiest Guy',
    'Bangers', 'Bubblegum Sans', 'Sniglet', 'Grandstander',
    'Coiny', 'Titan One', 'Patrick Hand'
  ],

  // ═══ RETRO / DECORATIVE ═══════════════════════════════════
  retro: [
    'Eighties', 'Funky Groove', 'Rockybilly', 'Pricedown',
    'Lobster', 'Righteous', 'Bungee Shade', 'Monoton', 'Pacifico',
    'Cinzel', 'Alfa Slab One', 'Abril Fatface', 'Bree Serif',
    'Special Elite', 'Bungee Inline', 'Ultra', 'Bowlby One SC'
  ],

  // ═══ EDUCATIONAL / CLEAN ══════════════════════════════════
  educational: [
    'Open Sans', 'Lato', 'Roboto', 'Source Sans 3', 'Noto Sans',
    'Inter', 'Nunito', 'Work Sans', 'Rubik', 'Karla',
    'Mulish', 'Manrope', 'Public Sans', 'IBM Plex Sans'
  ],

  // ═══ CINEMATIC ════════════════════════════════════════════
  cinematic: [
    'Cinzel', 'Playfair Display', 'Cormorant Garamond', 'EB Garamond',
    'Prata', 'Cardo', 'Spectral', 'Lora', 'Libre Baskerville',
    'Abril Fatface', 'Bodoni Moda', 'Cormorant Upright'
  ],

  // ═══ MINIMAL ══════════════════════════════════════════════
  minimal: [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Work Sans',
    'DM Sans', 'Manrope', 'Karla', 'Rubik', 'IBM Plex Sans',
    'Public Sans', 'Archivo'
  ]
};

// ═══════════════════════════════════════════════════════════════
//  WEB-SAFE FONTS
// ═══════════════════════════════════════════════════════════════
const WEB_SAFE_FONTS = new Set([
  'Arial', 'Arial Black', 'Arial Narrow',
  'Calibri', 'Cambria', 'Candara', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Corbel', 'Courier New',
  'Franklin Gothic Medium', 'Franklin Gothic Heavy', 'Gabriola',
  'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
  'Malgun Gothic', 'Microsoft Sans Serif',
  'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI',
  'Sylfaen', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
  'Haettenschweiler', 'Ebrima', 'Nirmala UI',
  'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco',
  'San Francisco', 'Avenir', 'Avenir Next', 'Geneva', 'Optima',
  'Futura', 'Gill Sans', 'Apple Chancery', 'Bradley Hand',
  'Snell Roundhand', 'Zapfino', 'Lucida Grande', 'Lucida Handwriting',
  'Baskerville', 'Didot', 'Rockwell', 'Papyrus',
  'Chalkboard', 'Chalkduster', 'Copperplate',
  'Roboto', 'Noto Sans', 'Noto Serif', 'Droid Sans', 'Droid Serif',
  'Droid Sans Mono', 'Cutive Mono',
  'PingFang SC',
  'Century Gothic', 'Tw Cen MT', 'Book Antiqua', 'Bookman Old Style',
  'Garamond', 'Courier', 'Palatino', 'Bodoni MT',
  'Andale Mono', 'Cascadia Code', 'Cascadia Mono'
]);

const loadedFonts = new Set();

// ═══════════════════════════════════════════════════════════════
//  AUTO-INJECT local fonts on import
// ═══════════════════════════════════════════════════════════════
injectLocalFonts();

// ═══════════════════════════════════════════════════════════════
//  RESOLVE — category name or font name → real font
// ═══════════════════════════════════════════════════════════════
export function resolveFontFamily(input) {
  if (!input) return 'Arial';
  const raw = String(input).trim();
  const key = raw.toLowerCase().replace(/\s+/g, '');

  // 🆕 Local font check first
  const localMatch = resolveLocalFontName(raw);
  if (localMatch) return localMatch;

  // Category → first font
  if (FONT_CATEGORIES[key]) {
    return FONT_CATEGORIES[key][0];
  }

  // Aliases
  const ALIAS = {
    bold: 'display',
    serifsans: 'serif',
    monospace: 'mono',
    clean: 'modern',
    sans: 'modern',
    local: 'custom',
    offline: 'custom',
    mine: 'custom'
  };
  if (ALIAS[key] && FONT_CATEGORIES[ALIAS[key]]) {
    return FONT_CATEGORIES[ALIAS[key]][0];
  }

  return raw;
}

// ═══════════════════════════════════════════════════════════════
//  LOAD FONT
//  Local fonts → already @font-face injected (no-op here)
//  Google fonts → <link> inject (with offline fallback)
// ═══════════════════════════════════════════════════════════════
export function loadGoogleFont(fontName) {
  if (!fontName) return;

  // 🆕 Local font → already injected
  if (isLocalFont(fontName)) return;

  if (WEB_SAFE_FONTS.has(fontName)) return;
  if (loadedFonts.has(fontName)) return;

  loadedFonts.add(fontName);

  const fam = fontName.replace(/\s+/g, '+');
  const url = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap';

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.font = fontName;
  link.onerror = function () {
    console.warn('[fontLibrary] offline fallback for:', fontName);
    try { link.remove(); } catch (_) {}
  };
  document.head.appendChild(link);
}

// ═══════════════════════════════════════════════════════════════
//  GET ALL
// ═══════════════════════════════════════════════════════════════
export function getAllFonts() {
  const set = new Set();
  Object.values(FONT_CATEGORIES).forEach(list => list.forEach(f => set.add(f)));
  WEB_SAFE_FONTS.forEach(f => set.add(f));
  LOCAL_FONTS.forEach(f => set.add(f.family));
  return Array.from(set).sort();
}

export function getCategoryNames() {
  return Object.keys(FONT_CATEGORIES);
}

// ═══════════════════════════════════════════════════════════════
//  🆕 BONUS — Get all local font names (for UI dropdowns)
// ═══════════════════════════════════════════════════════════════
export function getLocalFonts() {
  return LOCAL_FONTS.map(f => ({ family: f.family, file: f.file }));
}

export function isOfflineFont(fontName) {
  return WEB_SAFE_FONTS.has(fontName) || isLocalFont(fontName);
}