import { SWATCH_PATTERN } from "@/lib/garment";

export const COLOUR_FAMILIES = ["red", "orange", "yellow", "green", "blue", "purple", "black", "white", "grey"] as const;
export type ColourFamily = (typeof COLOUR_FAMILIES)[number];

export const COLOUR_FAMILY_LABELS: Readonly<Record<ColourFamily, string>> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow and gold",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  black: "Black",
  white: "White",
  grey: "Grey",
};

/** Hue in degrees, saturation and lightness from 0 to 1, of a `#rrggbb` swatch. */
function hsl(swatch: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(swatch.slice(at, at + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const span = max - min;
  if (span === 0) return { h: 0, s: 0, l };
  const s = span / (1 - Math.abs(2 * l - 1));
  const raw = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return { h: (raw * 60 + 360) % 360, s, l };
}

/**
 * The family a swatch belongs to, for filtering the library. This is a screen grouping to help a
 * person find a kit, not a colour reference a factory can match. Null for anything that is not a swatch.
 */
export function colourFamilyOf(swatch: string): ColourFamily | null {
  const lower = swatch.toLowerCase();
  if (!SWATCH_PATTERN.test(lower)) return null;
  const { h, s, l } = hsl(lower);
  if (l < 0.1) return "black";
  if (l > 0.92) return "white";
  if (s < 0.12) return l < 0.2 ? "black" : l > 0.85 ? "white" : "grey";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 170) return "green";
  if (h < 260) return "blue";
  return "purple";
}
