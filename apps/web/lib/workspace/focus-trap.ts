/**
 * Where Tab should send focus inside a sheet that holds it. `index` is the position of the focused
 * control among the `count` the sheet holds, or -1 when focus is outside them. Returns the position
 * to focus instead of the browser's own choice, or null to let the browser move on as usual.
 */
export const trapTarget = (count: number, index: number, backwards: boolean): number | null => {
  if (count <= 0) return null;
  if (index < 0) return backwards ? count - 1 : 0;
  if (backwards && index === 0) return count - 1;
  if (!backwards && index === count - 1) return 0;
  return null;
};
