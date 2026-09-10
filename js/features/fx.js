export const featureKey = 'fx';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('fx', children, { title: item.label || 'fx', level: 1 });
}
