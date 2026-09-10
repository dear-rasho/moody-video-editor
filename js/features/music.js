export const featureKey = 'music';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('music', children, { title: item.label || 'music', level: 1 });
}
