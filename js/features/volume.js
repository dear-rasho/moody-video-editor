export const featureKey = 'volume';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('volume', children, { title: item.label || 'volume', level: 1 });
}
