export const featureKey = 'textFonts';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('textFonts', children, { title: item.label || 'textFonts', level: 1 });
}
