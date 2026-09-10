export const featureKey = 'motion';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('motion', children, { title: item.label || 'motion', level: 1 });
}
