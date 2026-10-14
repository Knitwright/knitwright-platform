/** Colours as the print rules see them: `#rrggbb` screen colours compared in CIE Lab. */

export const HEX = /^#[0-9a-fA-F]{6}$/;

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function toLab(hex: string): readonly [number, number, number] {
  if (!HEX.test(hex)) throw new RangeError("A colour must look like #1b2a49.");
  const [r, g, b] = [1, 3, 5].map((at) => linear(parseInt(hex.slice(at, at + 2), 16))) as [number, number, number];
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ];
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f) as [number, number, number];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. Under about 2.3 an eye can barely tell two colours apart. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** How close a colour must be to one on the avoid list to count as it. A setting, not a measurement. */
export const AVOID_DELTA_E = 4;

/** The colours used that sit on the avoid list, each once, in the order first used. */
export function avoidedColours(used: readonly string[], avoid: readonly string[]): string[] {
  const seen = new Set<string>();
  return used.filter((colour) => {
    const key = colour.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return avoid.some((bad) => deltaE(colour, bad) <= AVOID_DELTA_E);
  });
}
