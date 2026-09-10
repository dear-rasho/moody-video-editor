export const featureKey = 'speed';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('speed', children, { title: item.label || 'speed', level: 1 });
}
