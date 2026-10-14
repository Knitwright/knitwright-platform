import { VECTOR_LIMITS } from "../settings";
import type { Clip, Gradient, ImageNode, PathNode, VectorNode } from "./model";
import { computeStyle, IdMap, readGradient, resolvePaint, ROOT_STYLE, urlId, type Style } from "./paint";
import { refuse } from "./refusal";
import { SHAPE_NAMES, shapeSegments, toNumber } from "./shapes";
import type { Rule } from "./style";
import { IDENTITY, isIdentity, multiply, parseTransform, type Matrix } from "./transform";
import type { XmlElement } from "./xml";

/** Everything the walk shares. The counters are the only things that change, and only by counting. */
export type Context = {
  readonly ids: ReadonlyMap<string, XmlElement>;
  readonly rules: readonly Rule[];
  readonly warnings: Set<string>;
  readonly gradientIds: IdMap;
  readonly clipIds: IdMap;
  readonly gradients: Gradient[];
  readonly clips: Clip[];
  /** Re-reads embedded picture bytes as pixels and gives a PNG in base64, or null when they cannot be read. */
  readonly embed: (bytes: Uint8Array) => Promise<string | null>;
  readonly counts: { nodes: number; uses: number; images: number; commands: { commands: number } };
};

export const WARNINGS = {
  text: "Text in the file was left out. Convert text to outlines for an exact match.",
  effects: "Effects in the file (filters, masks, patterns or markers) were left out.",
  brokenPath: "A path in the file had an error, so only the part before it was kept.",
  transform: "A transform in the file could not be read and was ignored.",
  sheet: "Some style rules in the file were not understood and were left out.",
} as const;

const QUIET = new Set(["defs", "title", "desc", "metadata", "style", "lineargradient", "radialgradient", "stop", "clippath"]);
const TEXT = new Set(["text", "tspan", "textpath"]);
const EFFECTS = new Set(["filter", "mask", "pattern", "marker", "symbol", "switch"]);
const CONTAINERS = new Set(["g", "a", "svg"]);

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

const transformOf = (element: XmlElement, context: Context): Matrix => {
  const text = element.attrs.get("transform");
  if (text === undefined) return IDENTITY;
  const matrix = parseTransform(text);
  if (!matrix) {
    context.warnings.add(WARNINGS.transform);
    return IDENTITY;
  }
  return matrix;
};

const asTransform = (matrix: Matrix): { transform?: [number, number, number, number, number, number] } =>
  isIdentity(matrix) ? {} : { transform: matrix.map(round6) as [number, number, number, number, number, number] };

const count = (context: Context): void => {
  context.counts.nodes += 1;
  if (context.counts.nodes > VECTOR_LIMITS.maxNodes) refuse("tooComplex");
};

const gradientRef = (context: Context) => (source: string): string | null => {
  const element = context.ids.get(source);
  if (!element || (element.name !== "lineargradient" && element.name !== "radialgradient")) return null;
  const { id, fresh } = context.gradientIds.get(source);
  if (!fresh) return context.gradients.some((gradient) => gradient.id === id) ? id : null;
  const gradient = readGradient(element, id, context.ids, context.rules);
  if (!gradient) return null;
  context.gradients.push(gradient);
  return id;
};

const clipRef = (style: Style, context: Context, depth: number): string | undefined => {
  const source = style.clipPath ? urlId(style.clipPath) : null;
  const element = source ? context.ids.get(source) : undefined;
  if (!source || !element || element.name !== "clippath") return undefined;
  const { id, fresh } = context.clipIds.get(source);
  if (fresh) {
    const children = element.children.flatMap((child) => {
      const node = pathOf(child, { ...ROOT_STYLE, fill: "#000000" }, context, transformOf(child, context));
      return node ? [node] : [];
    });
    if (children.length === 0) return undefined;
    context.clips.push({ id, children });
  }
  return depth >= 0 && context.clips.some((clip) => clip.id === id) ? id : undefined;
};

function pathOf(element: XmlElement, style: Style, context: Context, matrix: Matrix): PathNode | null {
  if (!SHAPE_NAMES.has(element.name)) return null;
  const shape = shapeSegments(element.name, element.attrs, context.counts.commands);
  if (!shape || shape.segments.length === 0) return null;
  if (!shape.clean) context.warnings.add(WARNINGS.brokenPath);
  const warn = (sentence: string) => context.warnings.add(sentence);
  const ref = gradientRef(context);
  const stroke = style.strokeWidth > 0 ? resolvePaint(style.stroke, style.strokeOpacity, ref, warn) : ({ type: "none" } as const);
  count(context);
  return {
    kind: "path",
    segments: shape.segments as PathNode["segments"],
    fill: resolvePaint(style.fill, style.fillOpacity, ref, warn),
    fillRule: style.fillRule,
    stroke,
    strokeWidth: style.strokeWidth,
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
    miterLimit: style.miterLimit,
    opacity: style.opacity,
    ...asTransform(matrix),
  };
}

const DATA_URL = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=\s]*)$/i;

async function imageOf(element: XmlElement, style: Style, context: Context, matrix: Matrix): Promise<ImageNode | null> {
  const href = (element.attrs.get("href") ?? element.attrs.get("xlink:href") ?? "").trim();
  const match = DATA_URL.exec(href);
  const width = toNumber(element.attrs.get("width"));
  const height = toNumber(element.attrs.get("height"));
  if (!match || width <= 0 || height <= 0) return null;
  context.counts.images += 1;
  if (context.counts.images > VECTOR_LIMITS.maxEmbeddedImages) return refuse("tooComplex");
  if (match[1].length > (VECTOR_LIMITS.maxEmbeddedImageBytes * 4) / 3) return refuse("tooComplex");
  const png = await context.embed(Buffer.from(match[1].replace(/\s+/g, ""), "base64"));
  if (!png) return null;
  count(context);
  return {
    kind: "image",
    x: toNumber(element.attrs.get("x")),
    y: toNumber(element.attrs.get("y")),
    width,
    height,
    png,
    opacity: style.opacity,
    ...asTransform(matrix),
  };
}

type Walk = { depth: number; uses: readonly string[] };

async function expandUse(element: XmlElement, style: Style, context: Context, walk: Walk): Promise<VectorNode[]> {
  const source = (element.attrs.get("href") ?? element.attrs.get("xlink:href") ?? "").trim().replace(/^#/, "");
  const target = context.ids.get(source);
  if (!target || walk.uses.includes(source)) return refuse("badUse");
  context.counts.uses += 1;
  if (context.counts.uses > VECTOR_LIMITS.maxUseExpansions) return refuse("tooComplex");
  const move: Matrix = [1, 0, 0, 1, toNumber(element.attrs.get("x")), toNumber(element.attrs.get("y"))];
  const matrix = multiply(transformOf(element, context), move);
  const children = await convertElement(target, style, context, { depth: walk.depth + 1, uses: [...walk.uses, source] });
  return wrap(children, style, matrix, context, walk.depth);
}

function wrap(children: VectorNode[], style: Style, matrix: Matrix, context: Context, depth: number): VectorNode[] {
  if (children.length === 0) return [];
  const clipId = clipRef(style, context, depth);
  if (style.opacity === 1 && isIdentity(matrix) && clipId === undefined) return children;
  count(context);
  return [{ kind: "group", opacity: style.opacity, children, ...(clipId ? { clipId } : {}), ...asTransform(matrix) }];
}

/** Converts one element (and what is inside it) to model nodes. */
export async function convertElement(element: XmlElement, parent: Style, context: Context, walk: Walk): Promise<VectorNode[]> {
  if (walk.depth > VECTOR_LIMITS.maxDepth) return refuse("tooComplex");
  if (element.prefix !== "" || QUIET.has(element.name)) return [];
  if (TEXT.has(element.name)) {
    context.warnings.add(WARNINGS.text);
    return [];
  }
  if (EFFECTS.has(element.name)) {
    context.warnings.add(WARNINGS.effects);
    return [];
  }
  const style = computeStyle(element, parent, context.rules);
  if (style.hidden) return [];
  const matrix = transformOf(element, context);
  if (CONTAINERS.has(element.name)) {
    const children: VectorNode[] = [];
    // The children take this element's style but not its opacity or clip, which the group carries.
    const inherited: Style = { ...style, opacity: 1, clipPath: null };
    for (const child of element.children) {
      children.push(...(await convertElement(child, inherited, context, { ...walk, depth: walk.depth + 1 })));
    }
    return wrap(children, style, matrix, context, walk.depth);
  }
  if (element.name === "use") return expandUse(element, style, context, walk);
  if (element.name === "image") {
    const node = await imageOf(element, style, context, matrix);
    return node ? wrap([node], { ...style, opacity: 1 }, IDENTITY, context, walk.depth) : [];
  }
  const node = pathOf(element, style, context, matrix);
  const clipId = node ? clipRef(style, context, walk.depth) : undefined;
  return node ? [clipId ? { ...node, clipId } : node] : [];
}
