export function closeOrder(indexes) {
  return [...new Set(indexes)]
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => b - a);
}

export function getTabTargetIndexes(tabCount, currentIndex) {
  const count = Number.isInteger(tabCount) && tabCount > 0 ? tabCount : 0;
  const all = Array.from({ length: count }, (_, index) => index);
  const validCurrent = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < count;

  if (!validCurrent) {
    return { all, others: [], left: [], right: [] };
  }

  return {
    all,
    others: all.filter((index) => index !== currentIndex),
    left: all.filter((index) => index < currentIndex),
    right: all.filter((index) => index > currentIndex),
  };
}
