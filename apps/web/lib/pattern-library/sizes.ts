const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "5XL"];

/**
 * Sizes in the order a size run is read: letter sizes from small to large, then number sizes
 * from small to large, then anything else in the order the files gave it.
 */
export function orderSizes(labels: readonly string[], preferred?: readonly string[]): string[] {
  const unique = [...new Set(labels)];
  if (preferred && preferred.length > 0) {
    const rest = unique.filter((label) => !preferred.includes(label));
    return [...preferred.filter((label) => unique.includes(label)), ...orderSizes(rest)];
  }
  const rank = (label: string): [number, number] => {
    const letter = LETTERS.indexOf(label.toUpperCase());
    if (letter >= 0) return [0, letter];
    const number = Number(label);
    return Number.isFinite(number) && label.trim() !== "" ? [1, number] : [2, unique.indexOf(label)];
  };
  return [...unique].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1];
  });
}
