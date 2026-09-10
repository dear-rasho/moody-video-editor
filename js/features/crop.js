export const featureKey = 'crop';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('crop', children, { title: item.label || 'crop', level: 1 });
}
