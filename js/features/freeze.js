export const featureKey = 'freeze';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('freeze', children, { title: item.label || 'freeze', level: 1 });
}
