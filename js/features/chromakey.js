export const featureKey = 'chromakey';
export function open({ router, item }) {
  const children = item?.children || [];
  if (children.length) router.openLevel('chromakey', children, { title: item.label || 'chromakey', level: 1 });
}
