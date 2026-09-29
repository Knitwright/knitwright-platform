export type NonEmpty<T> = readonly [T, ...T[]];

/** Returns the list as a non-empty tuple, or null when it is empty. */
export function nonEmpty<T>(list: readonly T[]): NonEmpty<T> | null {
  const [first, ...rest] = list;
  return list.length > 0 ? [first, ...rest] : null;
}
