export const featureKey = 'reverse';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('reverse', children, { title: item.label || 'reverse', level: 1 });
}
