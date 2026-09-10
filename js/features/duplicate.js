export const featureKey = 'duplicate';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('duplicate', children, { title: item.label || 'duplicate', level: 1 });
}
