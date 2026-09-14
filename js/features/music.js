// ================================================================
//  js/features/music.js
//  Placeholder — Music library (future)
// ================================================================

export const featureKey = 'music';
export const featureLabel = 'Music';
export const featureIcon = '🎵';

export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) {
    router.openLevel('music', children, { title: item.label || 'Music', level: 1 });
  }
}