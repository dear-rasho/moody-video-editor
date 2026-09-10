export const featureKey = 'filters';

export function open({ router, item }) {
  const filterItems = [
    { key: 'brightness', label: 'Brightness', icon: '☀️', 
      children: [{ key: 'brightness', label: 'Intensity', type: 'slider', min: 0, max: 200, default: 100, suffix: '%' }] },
    { key: 'contrast', label: 'Contrast', icon: '◐', 
      children: [{ key: 'contrast', label: 'Intensity', type: 'slider', min: 0, max: 200, default: 100, suffix: '%' }] },
    { key: 'saturation', label: 'Saturation', icon: '🎨', 
      children: [{ key: 'saturation', label: 'Intensity', type: 'slider', min: 0, max: 200, default: 100, suffix: '%' }] },
    { key: 'blur', label: 'Blur', icon: '💧', 
      children: [{ key: 'blur', label: 'Intensity', type: 'slider', min: 0, max: 20, default: 0, suffix: 'px' }] },
    { key: 'sharpen', label: 'Sharpen', icon: '🔍', 
      children: [{ key: 'sharpen', label: 'Intensity', type: 'slider', min: 0, max: 100, default: 0, suffix: '%' }] },
    { key: 'warmth', label: 'Warmth', icon: '🔥', 
      children: [{ key: 'warmth', label: 'Intensity', type: 'slider', min: 0, max: 200, default: 100, suffix: '%' }] },
    { key: 'vignette', label: 'Vignette', icon: '⬤', 
      children: [{ key: 'vignette', label: 'Intensity', type: 'slider', min: 0, max: 100, default: 0, suffix: '%' }] },
    { key: 'hue', label: 'Hue', icon: '🌈', 
      children: [{ key: 'hue', label: 'Intensity', type: 'slider', min: 0, max: 360, default: 0, suffix: '°' }] },
    { key: 'sepia', label: 'Sepia', icon: '🟫', 
      children: [{ key: 'sepia', label: 'Intensity', type: 'slider', min: 0, max: 100, default: 0, suffix: '%' }] }
  ];

  router.openLevel('filters', filterItems, { title: 'Filters', level: 1 });
}


