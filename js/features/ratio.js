export const featureKey = 'ratio';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('ratio', children, { title: item.label || 'ratio', level: 1 });
}
