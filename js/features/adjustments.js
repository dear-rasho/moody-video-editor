export const featureKey = 'adjustments';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('adjustments', children, { title: item.label || 'adjustments', level: 1 });
}
