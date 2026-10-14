import { IDENTITY, multiply, parseTransform, type Matrix } from "./matrix";
import type { VectorGradient, VectorNode } from "./model";
import type { PathCmd } from "./path-data";
import { clamp01, declaredFor, parseLength, parseNumber, parseShare } from "./style";
import type { CssRule } from "./css";
import { parseColour } from "./colour";
import type { XmlElement } from "./xml";

export type Bbox = Readonly<{ x: number; y: number; width: number; height: number }>;

/** The box around a path's points. Control points are included, which can make it a little larger than the drawn shape. */
export function bboxOf(cmds: readonly PathCmd[]): Bbox | null {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const cmd of cmds) {
    for (let i = 1; i + 1 < cmd.length; i += 2) {
      const [x, y] = [cmd[i] as number, cmd[i + 1] as number];
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

type Stop = VectorGradient["stops"][number];

const MAX_CHAIN = 8;
const GRADIENTS = new Set(["lineargradient", "radialgradient"]);

/** The element, then the gradients it names through href, nearest first. */
function chainOf(start: XmlElement, ids: ReadonlyMap<string, XmlElement>): XmlElement[] {
  const chain = [start];
  while (chain.length < MAX_CHAIN) {
    const href = chain.at(-1)?.attrs.href;
    const next = href?.startsWith("#") ? ids.get(href.slice(1)) : undefined;
    if (!next || chain.includes(next) || !GRADIENTS.has(next.name.toLowerCase())) break;
    chain.push(next);
  }
  return chain;
}

function stopsOf(chain: readonly XmlElement[], rules: readonly CssRule[]): Stop[] {
  const owner = chain.find((el) => el.children.some((c) => c.name === "stop"));
  let previous = 0;
  return (owner?.children ?? [])
    .filter((c) => c.name === "stop")
    .map((stop): Stop => {
      const declared = declaredFor(stop, rules);
      const colour = parseColour(declared["stop-color"] ?? "black") ?? { hex: "#000000", alpha: 1 };
      previous = Math.max(previous, parseShare(stop.attrs.offset, 0));
      return { offset: previous, hex: colour.hex, opacity: clamp01(colour.alpha * parseShare(declared["stop-opacity"], 1)) };
    });
}

const attributeOf = (chain: readonly XmlElement[], name: string): string | undefined => chain.find((el) => el.attrs[name] !== undefined)?.attrs[name];

export type GradientRequest = Readonly<{
  element: XmlElement;
  ids: ReadonlyMap<string, XmlElement>;
  rules: readonly CssRule[];
  bbox: Bbox | null;
  /** The size a percentage in user space is a share of. */
  reference: Readonly<{ width: number; height: number }>;
  newId: string;
}>;

/** A gradient as the model holds it, or null when it cannot be drawn (no stops, or a bounding box of no size). */
export function gradientFor(request: GradientRequest): VectorGradient | null {
  const { element, ids, rules, bbox, reference, newId } = request;
  const chain = chainOf(element, ids);
  const stops = stopsOf(chain, rules);
  if (stops.length === 0) return null;
  const userSpace = attributeOf(chain, "gradientUnits") === "userSpaceOnUse";
  if (!userSpace && (!bbox || bbox.width <= 0 || bbox.height <= 0)) return null;
  const own = parseTransform(attributeOf(chain, "gradientTransform")) ?? IDENTITY;
  const mapping: Matrix = userSpace || !bbox ? IDENTITY : [bbox.width, 0, 0, bbox.height, bbox.x, bbox.y];
  const m = multiply(mapping, own);
  const value = (name: string, fallback: number, along: "width" | "height"): number => {
    const text = attributeOf(chain, name);
    if (userSpace) return parseLength(text, reference[along]) ?? fallback * reference[along];
    return parseShare(text, fallback);
  };
  const common = { id: newId, stops, ...(m === IDENTITY ? {} : { m }) };
  if (element.name.toLowerCase() === "lineargradient") {
    return { type: "linear", ...common, x1: value("x1", 0, "width"), y1: value("y1", 0, "height"), x2: value("x2", 1, "width"), y2: value("y2", 0, "height") };
  }
  const cx = value("cx", 0.5, "width");
  const cy = value("cy", 0.5, "height");
  const reach = Math.hypot(reference.width, reference.height) / Math.SQRT2;
  const r = userSpace ? (parseLength(attributeOf(chain, "r"), reach) ?? 0.5 * reach) : parseShare(attributeOf(chain, "r"), 0.5);
  const fxText = attributeOf(chain, "fx");
  const fyText = attributeOf(chain, "fy");
  return {
    type: "radial",
    ...common,
    cx,
    cy,
    r,
    fx: fxText === undefined ? cx : value("fx", 0.5, "width"),
    fy: fyText === undefined ? cy : value("fy", 0.5, "height"),
  };
}

export const opacityOf = (declared: Readonly<Record<string, string>>): number => clamp01(parseNumber(declared.opacity, 1));

/** A group with nothing in it draws nothing. */
export const isEmptyGroup = (node: VectorNode): boolean => node.t === "g" && node.children.length === 0;
