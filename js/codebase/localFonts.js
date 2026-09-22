// ================================================================
//  js/codebase/localFonts.js
//  Local font files in ./fonts/ — auto-registered via @font-face.
//  Works 100% offline.
// ================================================================

// 🎯 Font registry — { family: 'Display Name', file: 'filename', format: 'woff2|otf|ttf', weight, style }
export const LOCAL_FONTS = [
  { family: 'Amita',            file: 'amita-v20-latin-regular.woff2',  format: 'woff2', weight: 400, style: 'normal' },
  { family: 'Bangela',          file: 'Bangela.otf',                     format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Brisound',         file: 'Brisound Regular.otf',            format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Chopin Script',    file: 'ChopinScript.ttf',                format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Christmas Music',  file: 'Christmas Music.otf',             format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Daffiys',          file: 'Daffiys.otf',                     format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Eighties',         file: 'Eighties.ttf',                    format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Fighter Attack',   file: 'Fighter Attack.ttf',              format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Forceless Demo',   file: 'ForcelessDemoRegular.ttf',        format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Funkora',          file: 'Funkora-Demo.otf',                format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Funky Groove',     file: 'Funky Groove.otf',                format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Gwathlyn',         file: 'GwathlynDEMO-Regular.otf',        format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Kaway',            file: 'Kaway.ttf',                       format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Komika',           file: 'KOMIKAHN.ttf',                    format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Legendary Brush',  file: 'Legendary Brush.otf',             format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Musiclife',        file: 'Musiclife Regular.ttf',           format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Orchard Song',     file: 'Orchard Song Free Trial.otf',     format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Pricedown',        file: 'Pricedown Bl.otf',                format: 'opentype', weight: 700, style: 'normal' },
  { family: 'Rengkox',          file: 'Rengkoxpersonal.otf',             format: 'opentype', weight: 400, style: 'normal' },
  { family: 'Rockybilly',       file: 'Rockybilly.ttf',                  format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Rumburak',         file: 'Rumburak.ttf',                    format: 'truetype', weight: 400, style: 'normal' },
  { family: 'Shockwave',        file: 'Shockwave.otf',                   format: 'opentype', weight: 400, style: 'normal' }
];

// ═══════════════════════════════════════════════════════════════
//  AUTO-INJECT @font-face
// ═══════════════════════════════════════════════════════════════
const CSS_ID = 'local-fonts-styles';
let injected = false;

function urlEncodePath(name) {
  // Encode spaces and special chars; keep slashes and dots
  return name.split('/').map(seg =>
    encodeURIComponent(seg).replace(/%2F/g, '/')
  ).join('/');
}

export function injectLocalFonts() {
  if (injected && document.getElementById(CSS_ID)) return;

  const existing = document.getElementById(CSS_ID);
  if (existing) existing.remove();

  const rules = LOCAL_FONTS.map(function (f) {
    const url = './fonts/' + urlEncodePath(f.file);
    return (
      '@font-face {\n' +
      '  font-family: "' + f.family + '";\n' +
      '  src: url("' + url + '") format("' + f.format + '");\n' +
      '  font-weight: ' + (f.weight || 400) + ';\n' +
      '  font-style: ' + (f.style || 'normal') + ';\n' +
      '  font-display: swap;\n' +
      '}'
    );
  }).join('\n\n');

  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = rules;
  document.head.appendChild(style);
  injected = true;

  console.log('[localFonts] Injected ' + LOCAL_FONTS.length + ' @font-face rules');
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC HELPERS
// ═══════════════════════════════════════════════════════════════
export function getLocalFontNames() {
  return LOCAL_FONTS.map(f => f.family);
}

export function isLocalFont(name) {
  if (!name) return false;
  const low = String(name).toLowerCase().trim();
  return LOCAL_FONTS.some(f => f.family.toLowerCase() === low);
}

export function resolveLocalFontName(input) {
  if (!input) return null;
  const low = String(input).toLowerCase().trim();
  for (const f of LOCAL_FONTS) {
    if (f.family.toLowerCase() === low) return f.family;
  }
  // Partial match
  for (const f of LOCAL_FONTS) {
    if (f.family.toLowerCase().indexOf(low) >= 0) return f.family;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-INJECT ON MODULE LOAD
// ═══════════════════════════════════════════════════════════════
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLocalFonts);
  } else {
    injectLocalFonts();
  }
}