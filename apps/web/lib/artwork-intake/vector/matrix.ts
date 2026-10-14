/** A 2D transform [a, b, c, d, e, f] as in SVG: x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const isIdentity = (m: Matrix): boolean => m.every((value, i) => Math.abs(value - IDENTITY[i]) < 1e-9);

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

const numbers = (text: string): number[] | null => {
  const found = text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const values = found.map(Number);
  return values.every(Number.isFinite) ? values : null;
};

const single = (name: string, args: number[]): Matrix | null => {
  switch (name) {
    case "matrix":
      return args.length === 6 ? [args[0], args[1], args[2], args[3], args[4], args[5]] : null;
    case "translate":
      return args.length === 1 || args.length === 2 ? [1, 0, 0, 1, args[0], args[1] ?? 0] : null;
    case "scale":
      return args.length === 1 || args.length === 2 ? [args[0], 0, 0, args[1] ?? args[0], 0, 0] : null;
    case "rotate": {
      if (args.length !== 1 && args.length !== 3) return null;
      const [angle, cx = 0, cy = 0] = args;
      const turn: Matrix = [Math.cos(rad(angle)), Math.sin(rad(angle)), -Math.sin(rad(angle)), Math.cos(rad(angle)), 0, 0];
      return multiply(multiply([1, 0, 0, 1, cx, cy], turn), [1, 0, 0, 1, -cx, -cy]);
    }
    case "skewX":
      return args.length === 1 ? [1, 0, Math.tan(rad(args[0])), 1, 0, 0] : null;
    case "skewY":
      return args.length === 1 ? [1, Math.tan(rad(args[0])), 0, 1, 0, 0] : null;
    default:
      return null;
  }
};

/** An SVG transform list. Null when it is malformed, so the caller can say the file was not read as written. */
export function parseTransform(text: string | undefined): Matrix | null {
  if (text === undefined || text.trim() === "") return IDENTITY;
  const pattern = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
  let result: Matrix = IDENTITY;
  let consumed = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    consumed = pattern.lastIndex;
    const args = numbers(match[2]);
    const next = args && single(match[1], args);
    if (!next) return null;
    result = multiply(result, next);
  }
  return consumed >= text.trimEnd().length ? result : null;
}

export const apply = (m: Matrix, x: number, y: number): readonly [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** The mean scale of a transform, for scaling stroke widths. */
export const meanScale = (m: Matrix): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
