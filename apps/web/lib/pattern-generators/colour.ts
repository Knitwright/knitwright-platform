/** Small colour helpers for screen colours (`#rrggbb`). Rounded to whole steps, so a mix is the same on any machine. */

export const FALLBACK_INK = "#9aa3ae";

type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "9aa3ae";
  return [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16)) as unknown as Rgb;
}

const toHex = (rgb: Rgb): string => `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;

/** `share` of `to` mixed into `from`. */
export function mixHex(from: string, to: string, share: number): string {
  const [a, b] = [parseHex(from), parseHex(to)];
  return toHex(a.map((value, at) => value + (b[at] - value) * share) as unknown as Rgb);
}

export const darken = (hex: string, share: number): string => mixHex(hex, "#000000", share);
export const lighten = (hex: string, share: number): string => mixHex(hex, "#ffffff", share);

/** Hue 0 to 360, saturation and lightness 0 to 1. */
export function hslOf(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = parseHex(hex).map((value) => value / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** The plain colour word for a screen colour, by hue: how a person would name it. */
export function hueWord(hex: string): string {
  const { h, s, l } = hslOf(hex);
  if (l < 0.12) return "black";
  if (l > 0.92) return "white";
  if (s < 0.12) return "grey";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return l < 0.4 ? "brown" : "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}
