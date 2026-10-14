/** A colour as the model holds it: a hex string and an opacity. Nothing else is stored. */
export type Rgba = Readonly<{ hex: string; opacity: number }>;

const NAMED: Readonly<Record<string, string>> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", lime: "#00ff00", blue: "#0000ff", yellow: "#ffff00",
  cyan: "#00ffff", aqua: "#00ffff", magenta: "#ff00ff", fuchsia: "#ff00ff", silver: "#c0c0c0", gray: "#808080",
  grey: "#808080", maroon: "#800000", olive: "#808000", green: "#008000", purple: "#800080", teal: "#008080",
  navy: "#000080", orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700", crimson: "#dc143c",
  darkgray: "#a9a9a9", darkgrey: "#a9a9a9", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkblue: "#00008b",
  darkgreen: "#006400", darkred: "#8b0000", royalblue: "#4169e1", skyblue: "#87ceeb", violet: "#ee82ee",
  indigo: "#4b0082", tan: "#d2b48c", coral: "#ff7f50", salmon: "#fa8072", khaki: "#f0e68c", beige: "#f5f5dc",
  ivory: "#fffff0", transparent: "#000000",
};

const byte = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));
const hex2 = (value: number): string => byte(value).toString(16).padStart(2, "0");
const toHex = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const channel = (token: string): number =>
  token.endsWith("%") ? (Number.parseFloat(token) / 100) * 255 : Number.parseFloat(token);

const alphaOf = (token: string | undefined): number => {
  if (token === undefined) return 1;
  const value = token.endsWith("%") ? Number.parseFloat(token) / 100 : Number.parseFloat(token);
  return Number.isFinite(value) ? clamp01(value) : 1;
};

const fromHsl = (h: number, s: number, l: number): string => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r, g, b] = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][sector];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

const fromHexText = (digits: string): Rgba | null => {
  if (!/^[0-9a-f]+$/.test(digits) || ![3, 4, 6, 8].includes(digits.length)) return null;
  const full = digits.length <= 4 ? [...digits].map((d) => d + d).join("") : digits;
  const opacity = full.length === 8 ? Number.parseInt(full.slice(6), 16) / 255 : 1;
  return { hex: `#${full.slice(0, 6)}`, opacity: Math.round(opacity * 1000) / 1000 };
};

const fromFunction = (text: string): Rgba | null => {
  const match = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(text);
  if (!match) return null;
  const parts = match[2].split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length < 3 || parts.length > 4) return null;
  const numbers = parts.slice(0, 3).map((part) => (match[1].startsWith("rgb") ? channel(part) : Number.parseFloat(part)));
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  const opacity = Math.round(alphaOf(parts[3]) * 1000) / 1000;
  if (match[1].startsWith("rgb")) return { hex: toHex(numbers[0], numbers[1], numbers[2]), opacity };
  return { hex: fromHsl(numbers[0], clamp01(numbers[1] / 100), clamp01(numbers[2] / 100)), opacity };
};

/** Reads a colour. Null when it is not one we know (the caller says so). */
export const parseColour = (value: string): Rgba | null => {
  const text = value.trim().toLowerCase();
  if (text.startsWith("#")) return fromHexText(text.slice(1));
  if (text === "transparent") return { hex: "#000000", opacity: 0 };
  if (NAMED[text]) return { hex: NAMED[text], opacity: 1 };
  return fromFunction(text);
};
