import { HEX, toLab } from "@/lib/print/rules/colour";

/** Colour maths in CIE Lab (D65), on `#rrggbb` screen colours. No model is involved. */

const WHITE = [0.95047, 1, 1.08883] as const;
const DEGREES = 180 / Math.PI;

/** Lightness, chroma and hue (0 to 360 degrees) of a screen colour. */
export function lchOf(hex: string): readonly [number, number, number] {
  const [l, a, b] = toLab(hex);
  return [l, Math.hypot(a, b), (Math.atan2(b, a) * DEGREES + 360) % 360];
}

const inverseF = (t: number): number => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const gamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbFromLab(l: number, a: number, b: number): readonly [number, number, number] {
  const fy = (l + 16) / 116;
  const x = inverseF(fy + a / 500) * WHITE[0];
  const y = inverseF(fy) * WHITE[1];
  const z = inverseF(fy - b / 200) * WHITE[2];
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

const EDGE = 1e-4;
const fits = (rgb: readonly number[]): boolean => rgb.every((channel) => channel >= -EDGE && channel <= 1 + EDGE);
const hexOf = (rgb: readonly number[]): string =>
  `#${rgb.map((channel) => Math.round(Math.min(1, Math.max(0, gamma(Math.min(1, Math.max(0, channel))))) * 255).toString(16).padStart(2, "0")).join("")}`;

/**
 * A screen colour from lightness, chroma and hue. When the colour is outside sRGB the chroma is
 * reduced, never the hue or lightness, so a colour is never clipped into a different one.
 */
export function hexFromLch(l: number, chroma: number, hue: number): string {
  const lightness = Math.min(100, Math.max(0, l));
  const radians = (((hue % 360) + 360) % 360) / DEGREES;
  let low = 0;
  let high = Math.max(0, chroma);
  const at = (c: number) => rgbFromLab(lightness, c * Math.cos(radians), c * Math.sin(radians));
  if (fits(at(high))) return hexOf(at(high));
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (fits(at(middle))) low = middle;
    else high = middle;
  }
  return hexOf(at(low));
}

/** The same lightness and chroma with the hue turned by `degrees`. */
export function shiftHue(hex: string, degrees: number): string {
  if (!HEX.test(hex)) throw new RangeError("A colour must look like #1b2a49.");
  const [l, c, h] = lchOf(hex);
  return hexFromLch(l, c, h + degrees);
}
