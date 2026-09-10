export const featureKey = 'delete';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('delete', children, { title: item.label || 'delete', level: 1 });
}
