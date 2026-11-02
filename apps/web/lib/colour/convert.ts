/**
 * sRGB and CIE Lab, both ways, in the platform's own convention: D65 white point, 2 degree observer
 * (owner decision 15). `toLab` and `deltaE` already live in `lib/print/rules/colour`, which every
 * print check uses; this file adds only the way back, so a colour worked out in Lab can be shown.
 * Nothing here is a measurement: it is the same arithmetic as the forward transform, reversed.
 */

import { HEX, deltaE, toLab } from "@/lib/print/rules/colour";

export { HEX, deltaE, toLab };

/** A colour in CIE Lab: lightness 0 to 100, then a* and b*. */
export type Lab = readonly [number, number, number];

/** The D65 white point `lib/print/rules/colour` divides by, repeated here so the inverse matches it exactly. */
const WHITE = [0.95047, 1, 1.08883] as const;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/** The sRGB transfer function, the inverse of `linear` in `lib/print/rules/colour`. */
const encode = (channel: number): number => {
  const c = clamp01(channel);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
};

const byteOf = (channel: number): string =>
  Math.round(encode(channel) * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * The `#rrggbb` nearest to a Lab colour. A Lab colour outside sRGB has no exact screen colour, so
 * each channel is clipped to the range a screen can show; `toLab(labToHex(lab))` is then not `lab`.
 */
export function labToHex(lab: Lab): string {
  const [l, a, b] = lab;
  const fy = (l + 16) / 116;
  const f = [fy + a / 500, fy, fy - b / 200] as const;
  const back = (t: number): number => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const [x, y, z] = f.map((t, at) => back(t) * WHITE[at]) as [number, number, number];
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return `#${byteOf(r)}${byteOf(g)}${byteOf(blue)}`;
}

/** Lightness, chroma and hue in degrees, which is how a person reasons about a colour. */
export const toLch = (hex: string): Readonly<{ l: number; c: number; h: number }> => {
  const [l, a, b] = toLab(hex);
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
};

/** A Lab colour from lightness, chroma and hue in degrees. */
export const fromLch = (l: number, c: number, h: number): Lab => {
  const radians = (h * Math.PI) / 180;
  return [l, c * Math.cos(radians), c * Math.sin(radians)];
};
