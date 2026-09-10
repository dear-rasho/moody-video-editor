export const featureKey = 'stickers';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('stickers', children, { title: item.label || 'stickers', level: 1 });
}
