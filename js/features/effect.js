export const featureKey = 'effect';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('effect', children, { title: item.label || 'effect', level: 1 });
}
