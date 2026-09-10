# My Offline Editor

ES6-module foundation for an offline 2D Android video editor architecture.

## Important blueprint note
The supplied feature list contains **20 named feature modules**, not 22: music, effect, filters, overlays, text, textFonts, stickers, motion, split, delete, crop, duplicate, freeze, volume, fx, speed, chromakey, reverse, ratio, adjustments. This implementation preserves those names rather than inventing two undocumented features.

The CSS intentionally avoids `display:none` for feature controls. Horizontal and vertical overflow are used to keep controls reachable on constrained viewports.
