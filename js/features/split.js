export const featureKey = 'split';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('split', children, { title: item.label || 'split', level: 1 });
}
