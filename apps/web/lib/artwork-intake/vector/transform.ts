/** A 2D transform as [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `left` applied after `right`, as nested transforms compose. */
export const multiply = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];

export const apply = (matrix: Matrix, x: number, y: number): readonly [number, number] => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
];

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const build = (name: string, a: readonly number[]): Matrix | null => {
  switch (name) {
    case "matrix":
      return a.length === 6 ? [a[0], a[1], a[2], a[3], a[4], a[5]] : null;
    case "translate":
      return a.length === 1 || a.length === 2 ? [1, 0, 0, 1, a[0], a[1] ?? 0] : null;
    case "scale":
      return a.length === 1 || a.length === 2 ? [a[0], 0, 0, a[1] ?? a[0], 0, 0] : null;
    case "rotate": {
      if (a.length !== 1 && a.length !== 3) return null;
      const cos = Math.cos(radians(a[0]));
      const sin = Math.sin(radians(a[0]));
      const turn: Matrix = [cos, sin, -sin, cos, 0, 0];
      if (a.length === 1) return turn;
      return multiply(multiply([1, 0, 0, 1, a[1], a[2]], turn), [1, 0, 0, 1, -a[1], -a[2]]);
    }
    case "skewx":
      return a.length === 1 ? [1, 0, Math.tan(radians(a[0])), 1, 0, 0] : null;
    case "skewy":
      return a.length === 1 ? [1, Math.tan(radians(a[0])), 0, 1, 0, 0] : null;
    default:
      return null;
  }
};

/** Reads an SVG transform list. Null when it is not well formed, so the caller can say so. */
export const parseTransform = (text: string): Matrix | null => {
  let rest = text.trim();
  let result: Matrix = IDENTITY;
  while (rest !== "") {
    const match = /^([a-zA-Z]+)\s*\(([^)]*)\)\s*,?\s*/.exec(rest);
    if (!match) return null;
    const numbers = match[2].split(/[\s,]+/).filter((part) => part !== "").map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) return null;
    const step = build(match[1].toLowerCase(), numbers);
    if (!step) return null;
    result = multiply(result, step);
    rest = rest.slice(match[0].length);
  }
  return result;
};

export const isIdentity = (matrix: Matrix): boolean => matrix.every((value, index) => Math.abs(value - IDENTITY[index]) < 1e-9);
