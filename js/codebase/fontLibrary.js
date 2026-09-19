// ================================================================
//  js/codebase/fontLibrary.js
//  144 fonts in 12 categories — loaded on-demand from Google Fonts.
//  Web-safe fonts are used directly (no network needed).
// ================================================================

export const FONT_CATEGORIES = {
  music:       ['Bebas Neue', 'Anton', 'Oswald', 'Righteous', 'Bungee', 'Permanent Marker', 'Caveat Brush', 'Rock Salt', 'Amatic SC', 'Kalam', 'Abril Fatface', 'Monoton'],
  educational: ['Open Sans', 'Lato', 'Roboto', 'Source Sans 3', 'Noto Sans', 'Inter', 'Nunito', 'Work Sans', 'Rubik', 'Karla', 'Mulish', 'Manrope'],
  titles:      ['Poppins', 'Montserrat', 'Raleway', 'Playfair Display', 'Cinzel', 'Bebas Neue', 'Alfa Slab One', 'Archivo Black', 'Abril Fatface', 'Bungee Shade', 'Bungee Inline', 'Russo One'],
  handwriting: ['Dancing Script', 'Pacifico', 'Great Vibes', 'Allura', 'Alex Brush', 'Satisfy', 'Kaushan Script', 'Parisienne', 'Sacramento', 'Tangerine', 'Caveat', 'Shadows Into Light'],
  modern:      ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'DM Sans', 'Manrope', 'Space Grotesk', 'Outfit', 'Sora'],
  bold:        ['Impact', 'Arial Black', 'Anton', 'Bebas Neue', 'Archivo Black', 'Oswald', 'Bungee', 'Alfa Slab One', 'Titan One', 'Monoton', 'Russo One', 'Bowlby One SC'],
  retro:       ['Lobster', 'Righteous', 'Bungee Shade', 'Monoton', 'Pacifico', 'Cinzel', 'Alfa Slab One', 'Abril Fatface', 'Bree Serif', 'Special Elite', 'Bungee Inline', 'Ultra'],
  elegant:     ['Playfair Display', 'Cormorant Garamond', 'EB Garamond', 'Lora', 'Merriweather', 'Crimson Text', 'Libre Baskerville', 'Cinzel', 'Cormorant', 'Spectral', 'Prata', 'Cardo'],
  playful:     ['Comic Sans MS', 'Baloo 2', 'Fredoka', 'Chewy', 'Luckiest Guy', 'Bangers', 'Bubblegum Sans', 'Sniglet', 'Grandstander', 'Coiny', 'Titan One', 'Patrick Hand'],
  mono:        ['Courier New', 'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Ubuntu Mono', 'Inconsolata', 'Anonymous Pro', 'Share Tech Mono', 'Major Mono Display'],
  cinematic:   ['Cinzel', 'Playfair Display', 'Cormorant Garamond', 'EB Garamond', 'Prata', 'Cardo', 'Spectral', 'Lora', 'Libre Baskerville', 'Abril Fatface', 'Bodoni Moda', 'Cormorant Upright'],
  minimal:     ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'DM Sans', 'Manrope', 'Karla', 'Rubik', 'IBM Plex Sans', 'Public Sans', 'Archivo']
};

// Fonts that don't need network loading
const WEB_SAFE_FONTS = new Set([
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
  'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Courier New',
  'Arial Black', 'Palatino', 'Garamond', 'Lucida Console', 'Segoe UI',
  'Courier', 'Candara', 'Consolas'
]);

const loadedFonts = new Set();

// ═══════════════════════════════════════════════════════════════
//  RESOLVE — category name → real font name
// ═══════════════════════════════════════════════════════════════
export function resolveFontFamily(input) {
  if (!input) return 'Arial';
  const raw = String(input).trim();
  const key = raw.toLowerCase().replace(/\s+/g, '');

  // 🆕 Category → first font (fixed, not random)
  if (FONT_CATEGORIES[key]) {
    return FONT_CATEGORIES[key][0];
  }

  return raw;
}

// ═══════════════════════════════════════════════════════════════
//  LOAD — inject Google Fonts <link> for the given family
// ═══════════════════════════════════════════════════════════════
export function loadGoogleFont(fontName) {
  if (!fontName) return;
  if (WEB_SAFE_FONTS.has(fontName)) return;
  if (loadedFonts.has(fontName)) return;

  loadedFonts.add(fontName);

  const fam = fontName.replace(/\s+/g, '+');
  const url = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap';

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.font = fontName;
  document.head.appendChild(link);
}

// ═══════════════════════════════════════════════════════════════
//  GET ALL FONTS (flat list)
// ═══════════════════════════════════════════════════════════════
export function getAllFonts() {
  const set = new Set();
  Object.values(FONT_CATEGORIES).forEach(list => list.forEach(f => set.add(f)));
  return Array.from(set).sort();
}

export function getCategoryNames() {
  return Object.keys(FONT_CATEGORIES);
}