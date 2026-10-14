import { type CssRule, matchRules, parseDeclarations } from "./css";
import { parseColour } from "./colour";

/** The properties that are read from an element. Any other (fonts, filters, masks) is not part of the model. */
const PROPERTIES = [
  "fill", "stroke", "stroke-width", "fill-opacity", "stroke-opacity", "opacity", "fill-rule", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "clip-path", "display", "visibility", "stop-color", "stop-opacity", "color", "transform",
] as const;

/** Properties a child takes from its parent. */
export type Inherited = Readonly<{
  fill: string;
  stroke: string;
  strokeWidth: string;
  fillOpacity: string;
  strokeOpacity: string;
  fillRule: string;
  cap: string;
  join: string;
  miterLimit: string;
  dash: string;
  visibility: string;
  color: string;
}>;

export const ROOT_STYLE: Inherited = {
  fill: "black",
  stroke: "none",
  strokeWidth: "1",
  fillOpacity: "1",
  strokeOpacity: "1",
  fillRule: "nonzero",
  cap: "butt",
  join: "miter",
  miterLimit: "4",
  dash: "none",
  visibility: "visible",
  color: "black",
};

export type Declared = Readonly<Record<string, string>>;

/** Presentation attributes, then style sheet rules, then the style attribute: later ones win. */
export function declaredFor(
  element: Readonly<{ name: string; attrs: Readonly<Record<string, string>> }>,
  rules: readonly CssRule[],
): Declared {
  const fromAttributes: Record<string, string> = {};
  for (const name of PROPERTIES) if (element.attrs[name] !== undefined) fromAttributes[name] = element.attrs[name].trim();
  const inline = element.attrs.style ? parseDeclarations(element.attrs.style) : {};
  return { ...fromAttributes, ...matchRules(rules, element), ...inline };
}

const pick = (declared: Declared, name: string, inherited: string): string => {
  const value = declared[name];
  return value === undefined || value === "inherit" ? inherited : value;
};

export function inheritFrom(parent: Inherited, declared: Declared): Inherited {
  return {
    fill: pick(declared, "fill", parent.fill),
    stroke: pick(declared, "stroke", parent.stroke),
    strokeWidth: pick(declared, "stroke-width", parent.strokeWidth),
    fillOpacity: pick(declared, "fill-opacity", parent.fillOpacity),
    strokeOpacity: pick(declared, "stroke-opacity", parent.strokeOpacity),
    fillRule: pick(declared, "fill-rule", parent.fillRule),
    cap: pick(declared, "stroke-linecap", parent.cap),
    join: pick(declared, "stroke-linejoin", parent.join),
    miterLimit: pick(declared, "stroke-miterlimit", parent.miterLimit),
    dash: pick(declared, "stroke-dasharray", parent.dash),
    visibility: pick(declared, "visibility", parent.visibility),
    color: pick(declared, "color", parent.color),
  };
}

const UNITS_TO_PX: Readonly<Record<string, number>> = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, em: 16, ex: 8, "": 1 };

/** A length in CSS pixels. Percentages need the size they are a share of. */
export function parseLength(text: string | undefined, percentOf = 0): number | null {
  if (text === undefined) return null;
  const match = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex|%)?\s*$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (match[2] === "%") return (value / 100) * percentOf;
  return value * UNITS_TO_PX[match[2] ?? ""];
}

export const parseNumber = (text: string | undefined, fallback: number): number => {
  const value = text === undefined ? Number.NaN : Number(text.trim());
  return Number.isFinite(value) ? value : fallback;
};

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A number, or a percentage, as a share from 0 to 1. */
export const parseShare = (text: string | undefined, fallback: number): number => {
  if (text === undefined) return fallback;
  const value = Number(text.trim().replace("%", ""));
  if (!Number.isFinite(value)) return fallback;
  return clamp01(text.includes("%") ? value / 100 : value);
};

export type PaintRef =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "colour"; hex: string; alpha: number }>
  | Readonly<{ kind: "ref"; id: string; fallback: PaintRef }>;

/** Reads a fill or stroke value. `currentColor` takes the element's own colour. */
export function parsePaint(value: string, color: string): PaintRef {
  const text = value.trim();
  if (text === "none" || text === "") return { kind: "none" };
  const ref = /^url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)\s*(.*)$/.exec(text);
  if (ref) return { kind: "ref", id: ref[1], fallback: ref[2] ? parsePaint(ref[2], color) : { kind: "none" } };
  const resolved = text.toLowerCase() === "currentcolor" ? color : text;
  const parsed = parseColour(resolved);
  return parsed ? { kind: "colour", hex: parsed.hex, alpha: parsed.alpha } : { kind: "none" };
}

export function parseDashes(value: string): number[] | undefined {
  if (value === "none" || value.trim() === "") return undefined;
  const parts = value.split(/[\s,]+/).filter(Boolean).map((v) => parseLength(v));
  if (parts.some((v) => v === null || v < 0) || parts.length === 0 || parts.length > 16) return undefined;
  const list = parts as number[];
  return list.every((v) => v === 0) ? undefined : list;
}
