export const featureKey = 'overlays';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('overlays', children, { title: item.label || 'overlays', level: 1 });
}
