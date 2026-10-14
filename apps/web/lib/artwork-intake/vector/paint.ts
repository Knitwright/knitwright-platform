import { VECTOR_LIMITS } from "../settings";
import { parseColour } from "./colour";
import type { Gradient, Paint } from "./model";
import { parseDeclarations, selectorMatches, type Declarations, type Rule } from "./style";
import { parseTransform } from "./transform";
import { toNumber } from "./shapes";
import type { XmlElement } from "./xml";

/** The style an element ends up with, after the attributes, the style sheet and its own style are applied. */
export type Style = Readonly<{
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  fillRule: "nonzero" | "evenodd";
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
  miterLimit: number;
  color: string;
  hidden: boolean;
  opacity: number;
  clipPath: string | null;
}>;

export const ROOT_STYLE: Style = {
  fill: "#000000", stroke: "none", strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1, fillRule: "nonzero",
  lineCap: "butt", lineJoin: "miter", miterLimit: 4, color: "#000000", hidden: false, opacity: 1, clipPath: null,
};

const PRESENTATION = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "display", "visibility", "color", "clip-path"] as const;

const unit = (value: string | undefined, fallback: number): number => {
  const number = toNumber(value, Number.NaN);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};

const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Attributes, then the sheet's rules in order, then the element's own `style`: the later one wins. */
export const declarationsOf = (element: XmlElement, rules: readonly Rule[]): Declarations => {
  const merged = new Map<string, string>();
  for (const key of PRESENTATION) {
    const value = element.attrs.get(key);
    if (value !== undefined) merged.set(key, value.trim());
  }
  const classes = (element.attrs.get("class") ?? "").split(/\s+/).filter((part) => part !== "");
  for (const rule of rules) {
    if (rule.selectors.some((selector) => selectorMatches(selector, element.name, classes))) {
      for (const [key, value] of rule.declarations) merged.set(key, value);
    }
  }
  const own = element.attrs.get("style");
  if (own !== undefined) for (const [key, value] of parseDeclarations(own)) merged.set(key, value);
  return merged;
};

export const computeStyle = (element: XmlElement, parent: Style, rules: readonly Rule[]): Style => {
  const d = declarationsOf(element, rules);
  const inherit = (key: string, fallback: string): string => {
    const value = d.get(key);
    return value === undefined || value === "inherit" ? fallback : value;
  };
  const color = inherit("color", parent.color);
  return {
    fill: inherit("fill", parent.fill).replace(/currentcolor/i, color),
    stroke: inherit("stroke", parent.stroke).replace(/currentcolor/i, color),
    strokeWidth: Math.max(0, toNumber(d.get("stroke-width"), parent.strokeWidth)),
    fillOpacity: unit(d.get("fill-opacity"), parent.fillOpacity),
    strokeOpacity: unit(d.get("stroke-opacity"), parent.strokeOpacity),
    fillRule: pick(d.get("fill-rule"), ["nonzero", "evenodd"], parent.fillRule),
    lineCap: pick(d.get("stroke-linecap"), ["butt", "round", "square"], parent.lineCap),
    lineJoin: pick(d.get("stroke-linejoin"), ["miter", "round", "bevel"], parent.lineJoin),
    miterLimit: Math.max(1, toNumber(d.get("stroke-miterlimit"), parent.miterLimit)),
    color,
    hidden: d.get("display") === "none" || d.get("visibility") === "hidden",
    opacity: unit(d.get("opacity"), 1),
    clipPath: d.get("clip-path") ?? null,
  };
};

/** The local id inside `url(#id)`, or null. */
export const urlId = (value: string): string | null => /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/.exec(value.trim())?.[1] ?? null;

export type Warn = (sentence: string) => void;

/** The id a model object gets for an id from the file: first come, first named. Deterministic. */
export class IdMap {
  private readonly names = new Map<string, string>();
  constructor(private readonly prefix: string) {}
  get(source: string): { id: string; fresh: boolean } {
    const known = this.names.get(source);
    if (known) return { id: known, fresh: false };
    const id = `${this.prefix}${this.names.size + 1}`;
    this.names.set(source, id);
    return { id, fresh: true };
  }
}

export const resolvePaint = (
  value: string,
  opacity: number,
  gradientId: (sourceId: string) => string | null,
  warn: Warn,
): Paint => {
  const text = value.trim();
  if (text === "none") return { type: "none" };
  const reference = urlId(text);
  if (reference !== null) {
    const id = gradientId(reference);
    return id ? { type: "gradient", gradientId: id, opacity } : { type: "none" };
  }
  const colour = parseColour(text);
  if (!colour) {
    warn("A colour in the file was not recognised and was left out.");
    return { type: "none" };
  }
  return { type: "colour", hex: colour.hex, opacity: Math.round(colour.opacity * opacity * 1000) / 1000 };
};

const offsetOf = (value: string | undefined): number => {
  if (value === undefined) return 0;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, value.trim().endsWith("%") ? number / 100 : number));
};

const stopsOf = (element: XmlElement, ids: ReadonlyMap<string, XmlElement>, rules: readonly Rule[], depth = 0): Gradient["stops"] => {
  const own = element.children.filter((child) => child.name === "stop");
  if (own.length > 0) {
    let last = 0;
    return own.slice(0, VECTOR_LIMITS.maxGradientStops).map((stop) => {
      const d = declarationsOf(stop, rules);
      const attr = (key: string) => stop.attrs.get(key);
      const colour = parseColour(d.get("stop-color") ?? attr("stop-color") ?? "#000000") ?? { hex: "#000000", opacity: 1 };
      last = Math.max(last, offsetOf(attr("offset")));
      return { offset: last, hex: colour.hex, opacity: Math.round(colour.opacity * unit(d.get("stop-opacity") ?? attr("stop-opacity"), 1) * 1000) / 1000 };
    });
  }
  const href = (element.attrs.get("href") ?? element.attrs.get("xlink:href") ?? "").replace(/^#/, "");
  const next = ids.get(href);
  return next && depth < 4 ? stopsOf(next, ids, rules, depth + 1) : [];
};

const length = (value: string | undefined, bbox: boolean, fallback: number): number => {
  if (value === undefined) return fallback;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return fallback;
  return value.trim().endsWith("%") && bbox ? number / 100 : number;
};

/** A gradient element as the model holds it, or null when it has no stops to draw. */
export const readGradient = (
  element: XmlElement,
  id: string,
  ids: ReadonlyMap<string, XmlElement>,
  rules: readonly Rule[],
): Gradient | null => {
  const stops = stopsOf(element, ids, rules);
  if (stops.length === 0) return null;
  const bbox = element.attrs.get("gradientUnits") !== "userSpaceOnUse";
  const rawTransform = element.attrs.get("gradientTransform");
  const matrix = rawTransform ? parseTransform(rawTransform) : null;
  const common = {
    id,
    units: bbox ? ("objectBoundingBox" as const) : ("userSpaceOnUse" as const),
    spread: pick(element.attrs.get("spreadMethod"), ["pad", "reflect", "repeat"], "pad"),
    stops,
    ...(matrix ? { transform: [...matrix] as [number, number, number, number, number, number] } : {}),
  };
  const attr = (key: string, fallback: number) => length(element.attrs.get(key), bbox, fallback);
  if (element.name === "lineargradient") {
    return { ...common, type: "linear", x1: attr("x1", 0), y1: attr("y1", 0), x2: attr("x2", bbox ? 1 : 100), y2: attr("y2", 0) };
  }
  const cx = attr("cx", bbox ? 0.5 : 50);
  const cy = attr("cy", bbox ? 0.5 : 50);
  return { ...common, type: "radial", cx, cy, r: attr("r", bbox ? 0.5 : 50), fx: attr("fx", cx), fy: attr("fy", cy) };
};
