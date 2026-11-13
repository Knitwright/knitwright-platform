import { nearestSublimationSafe } from "@/lib/colour/palette";

/**
 * THE COLOUR PICKER'S MATHS (plan v6 E5, decision 0149; `08` §5.7 "Color picker", v3.3, prototype e33).
 *
 * The square is saturation (x) by value (y) at one hue; the bars are hue and alpha. A colour is kept
 * as HSV while the person drags, so dragging through black or grey does not lose the hue, and is
 * handed out as `#rrggbb` plus an opacity in per cent -- the shape the project colours already hold.
 *
 * The garment-panel warning is the sublimation estimate's own (`nearestSublimationSafe`), the same
 * words Brand Studio shows, never a sentence of this file's.
 */

export interface Hsv {
  /** 0–360. */
  readonly h: number;
  /** 0–1. */
  readonly s: number;
  /** 0–1. */
  readonly v: number;
}

export interface PickedColour {
  readonly hex: string;
  /** 0–100. */
  readonly opacity: number;
}

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

/** What a person typed, as `#rrggbb`, or null. Three digits are widened; case is ignored. */
export function parseHex(input: string): string | null {
  const text = input.trim();
  const six = HEX6.exec(text);
  if (six) return `#${six[1]!.toLowerCase()}`;
  const three = HEX3.exec(text);
  if (three) return `#${[...three[1]!.toLowerCase()].map((digit) => digit + digit).join("")}`;
  return null;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export const clampOpacity = (value: number): number => (Number.isFinite(value) ? Math.round(clamp(value, 0, 100)) : 100);

export function hexToRgb(hex: string): readonly [number, number, number] {
  const clean = parseHex(hex) ?? "#000000";
  return [1, 3, 5].map((at) => Number.parseInt(clean.slice(at, at + 2), 16)) as unknown as readonly [number, number, number];
}

const byte = (value: number): string => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

export const rgbToHex = (r: number, g: number, b: number): string => `#${byte(r)}${byte(g)}${byte(b)}`;

/** "11, 31, 75", the RGB field's own text. */
export const rgbText = (hex: string): string => hexToRgb(hex).join(", ");

/** What a person typed in the RGB field, or null. */
export function parseRgb(input: string): string | null {
  const parts = input.split(/[\s,]+/).filter((part) => part !== "").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return rgbToHex(parts[0]!, parts[1]!, parts[2]!);
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const s = max === 0 ? 0 : delta / max;
  if (delta === 0) return { h: 0, s, v: max };
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (sector * 60 + 360) % 360, s, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const chroma = v * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] =
    sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0] : sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] : sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = v - chroma;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** A point in the square (0–1 each way, y down) as saturation and value at a hue. */
export const fromSquare = (h: number, x: number, y: number): Hsv => ({ h, s: clamp(x, 0, 1), v: clamp(1 - y, 0, 1) });

/** One arrow-key step in the square, the hue bar or the alpha bar; Shift takes ten. */
export const nudge = (value: number, by: number, low: number, high: number): number => clamp(value + by, low, high);

/** The pure hue, for the square's background. */
export const hueHex = (h: number): string => hsvToHex({ h, s: 1, v: 1 });

/** The print warning for a garment panel, or null when the estimate is happy with the colour. */
export function printWarning(hex: string): string | null {
  const clean = parseHex(hex);
  if (clean === null) return null;
  const match = nearestSublimationSafe(clean);
  return match.inGamut ? null : match.warning;
}

/** `rgba()` for a swatch shown with its opacity. */
export function cssColour({ hex, opacity }: PickedColour): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clampOpacity(opacity) / 100})`;
}

/** Upper case without the #, as the field and the project colours row show it. */
export const hexLabel = (hex: string): string => (parseHex(hex) ?? "#000000").slice(1).toUpperCase();
