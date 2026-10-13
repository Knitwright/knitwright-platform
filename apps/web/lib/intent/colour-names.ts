import { SWATCH_PATTERN } from "@/lib/garment";

/**
 * The drawn colour for the colour names people use for sports kit. When the assistant sets
 * a colour by name, the flat needs a colour to draw too, or it stays grey and anything
 * printed on it in white cannot be read. The name stays what the factory reads; this colour
 * is only how the drawing shows it. A name not listed here gets no drawn colour.
 */
export const COLOUR_NAMES: Readonly<Record<string, string>> = {
  black: "#111111",
  white: "#ffffff",
  "off white": "#f4f1e8",
  cream: "#f3ead3",
  grey: "#8c8f94",
  "light grey": "#c4c7cc",
  "dark grey": "#4a4d52",
  charcoal: "#36393d",
  silver: "#c0c4c8",
  red: "#c8102e",
  scarlet: "#d2122e",
  maroon: "#6d1a2c",
  claret: "#7a1f3d",
  burgundy: "#6b1d2e",
  pink: "#f19cbb",
  "hot pink": "#e0218a",
  orange: "#f2711c",
  amber: "#ffb000",
  gold: "#f2b705",
  "old gold": "#c9a227",
  yellow: "#ffd400",
  green: "#1e8c3a",
  "bottle green": "#0b4a2e",
  "forest green": "#1f4d2b",
  "kelly green": "#2a9d3c",
  lime: "#9bd13a",
  teal: "#00807f",
  turquoise: "#2ec4c6",
  "sky blue": "#7ec8e3",
  "light blue": "#9cc9ea",
  "royal blue": "#1d4fb8",
  blue: "#1f5fbf",
  cobalt: "#0047ab",
  navy: "#1b2a49",
  purple: "#5b2a86",
  violet: "#7f3fbf",
  lilac: "#c3a6d8",
  brown: "#6b4226",
  tan: "#c8a27a",
  beige: "#e1d3b8",
  khaki: "#a99a6b",
};

/** Other ways of writing a listed name. */
const ALIASES: Readonly<Record<string, string>> = {
  gray: "grey",
  "light gray": "light grey",
  "dark gray": "dark grey",
  royal: "royal blue",
  "navy blue": "navy",
  "dark blue": "navy",
  sky: "sky blue",
  "baby blue": "light blue",
  bottle: "bottle green",
  "dark green": "bottle green",
  "racing green": "bottle green",
  wine: "claret",
};

const plain = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The drawn colour for a colour name, or undefined when the name is not listed. */
export function swatchForName(name: string): string | undefined {
  const key = plain(name);
  if (key === "") return undefined;
  const listed = Object.hasOwn(ALIASES, key) ? ALIASES[key] : key;
  return Object.hasOwn(COLOUR_NAMES, listed) ? COLOUR_NAMES[listed] : undefined;
}

/** A colour written as a code, `#rrggbb` or `rrggbb`, in lower case, or null when it is not one. */
export function readSwatch(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return SWATCH_PATTERN.test(candidate) ? candidate : null;
}
