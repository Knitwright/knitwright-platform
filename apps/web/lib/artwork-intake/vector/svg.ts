import { ARTWORK_LIMITS } from "../limits";
import type { Budget } from "./budget";
import { type CssRule, parseCss } from "./css";
import { IDENTITY, isIdentity, multiply, parseTransform, type Matrix } from "./matrix";
import { VECTOR_MODEL_VERSION, type VectorDoc, type VectorGradient, type VectorNode, vectorDocSchema } from "./model";
import { parsePathData, polyPath, shapePath, type PathCmd } from "./path-data";
import { refuse, REFUSALS } from "./refuse";
import { bboxOf, gradientFor, isEmptyGroup, opacityOf, type Bbox } from "./svg-paint";
import {
  clamp01, declaredFor, inheritFrom, parseDashes, parseLength, parseNumber, parsePaint, parseShare, ROOT_STYLE, type Declared, type Inherited,
} from "./style";
import { decodeUtf8, parseXml, type XmlElement } from "./xml";

const LIMITS = ARTWORK_LIMITS.vector;

export const TEXT_OMITTED = "Text in this file was left out. Convert text to outlines for an exact match.";
const EFFECTS_OMITTED = "Effects such as blurs and masks were left out.";
const PATTERN_OMITTED = "A pattern fill was left out.";
const OTHER_OMITTED = "Some parts of this file use features that cannot be printed and were left out.";
const BAD_TRANSFORM = "A transform in this file could not be read and was ignored.";

const SKIPPED = new Set([
  "defs", "title", "desc", "metadata", "style", "clippath", "lineargradient", "radialgradient", "mask", "pattern", "marker", "filter", "symbol",
  "stop", "view", "font", "font-face", "cursor", "color-profile", "switch",
]);
const CONTAINERS = new Set(["g", "a", "svg"]);
const TEXTS = new Set(["text", "tspan", "textpath", "tref", "altglyph"]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);

type State = {
  readonly gradients: VectorGradient[];
  readonly clips: { id: string; nodes: VectorNode[] }[];
  readonly clipIds: Map<string, string | null>;
  readonly gradientKeys: Map<string, string | null>;
  readonly warnings: Set<string>;
  textOmitted: boolean;
  images: number;
};

type Ctx = Readonly<{
  budget: Budget;
  ids: ReadonlyMap<string, XmlElement>;
  rules: readonly CssRule[];
  state: State;
  reference: Readonly<{ width: number; height: number }>;
}>;

function collect(root: XmlElement, ids: Map<string, XmlElement>, styles: string[], budget: Budget): void {
  budget.tick();
  const id = root.attrs.id;
  if (id !== undefined && !ids.has(id)) ids.set(id, root);
  if (root.name === "style" && (root.attrs.type === undefined || root.attrs.type === "text/css")) styles.push(root.text);
  for (const child of root.children) collect(child, ids, styles, budget);
}

const numberRound = (value: number): number => Math.round(value * 1000) / 1000 + 0;

function transformOf(el: XmlElement, declared: Declared, ctx: Ctx): Matrix {
  const text = el.attrs.transform ?? declared.transform;
  const parsed = parseTransform(text);
  if (parsed === null) ctx.state.warnings.add(BAD_TRANSFORM);
  return parsed ?? IDENTITY;
}

function clipFor(declared: Declared, ctx: Ctx, depth: number): string | undefined {
  const match = /^url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)$/.exec(declared["clip-path"] ?? "");
  if (!match) return undefined;
  const known = ctx.state.clipIds.get(match[1]);
  if (known !== undefined) return known ?? undefined;
  const el = ctx.ids.get(match[1]);
  if (!el || el.name !== "clipPath" || el.attrs.clipPathUnits === "objectBoundingBox") {
    ctx.state.clipIds.set(match[1], null);
    ctx.state.warnings.add(OTHER_OMITTED);
    return undefined;
  }
  const id = `c${ctx.state.clips.length + 1}`;
  ctx.state.clipIds.set(match[1], id);
  const entry = { id, nodes: [] as VectorNode[] };
  ctx.state.clips.push(entry);
  const m = parseTransform(el.attrs.transform) ?? IDENTITY;
  const children = el.children.flatMap((child) => nodesFor(child, ROOT_STYLE, ctx, depth + 1, []));
  entry.nodes.push(...(isIdentity(m) ? children : [{ t: "g" as const, opacity: 1, m, children }]));
  return id;
}

function paintFor(
  value: string,
  inherited: Inherited,
  bbox: Bbox | null,
  ctx: Ctx,
): { hex: string; alpha: number; gradient?: undefined } | { gradient: string; alpha: number; hex?: undefined } | null {
  let paint = parsePaint(value, inherited.color);
  if (paint.kind === "ref") {
    const target = ctx.ids.get(paint.id);
    const usable = target && ["lineargradient", "radialgradient"].includes(target.name.toLowerCase());
    if (!usable) {
      if (target?.name === "pattern") ctx.state.warnings.add(PATTERN_OMITTED);
      paint = paint.fallback;
    } else {
      const key = `${paint.id}|${bbox ? `${bbox.x},${bbox.y},${bbox.width},${bbox.height}` : ""}`;
      let id = ctx.state.gradientKeys.get(key);
      if (id === undefined) {
        if (ctx.state.gradients.length >= 1000) return refuse(REFUSALS.tooComplex);
        const gradient = gradientFor({ element: target, ids: ctx.ids, rules: ctx.rules, bbox, reference: ctx.reference, newId: `g${ctx.state.gradients.length + 1}` });
        id = gradient?.id ?? null;
        if (gradient) ctx.state.gradients.push(gradient);
        ctx.state.gradientKeys.set(key, id);
      }
      return id === null ? null : { gradient: id, alpha: 1 };
    }
  }
  return paint.kind === "colour" ? { hex: paint.hex, alpha: paint.alpha } : null;
}

function pathNode(cmds: readonly PathCmd[], el: XmlElement, declared: Declared, style: Inherited, ctx: Ctx, depth: number): VectorNode | null {
  if (cmds.length === 0 || style.visibility === "hidden" || style.visibility === "collapse") return null;
  const bbox = bboxOf(cmds);
  const fill = paintFor(style.fill, style, bbox, ctx);
  const strokePaint = paintFor(style.stroke, style, bbox, ctx);
  const width = parseLength(style.strokeWidth, ctx.reference.width) ?? 1;
  if (!fill && (!strokePaint || width <= 0)) return null;
  const m = transformOf(el, declared, ctx);
  const clip = clipFor(declared, ctx, depth);
  const stroke =
    strokePaint && width > 0
      ? {
          paint: strokePaint.hex ? { kind: "colour" as const, hex: strokePaint.hex } : { kind: "gradient" as const, id: strokePaint.gradient as string },
          width: numberRound(width),
          opacity: clamp01(strokePaint.alpha * parseShare(style.strokeOpacity, 1)),
          cap: (["butt", "round", "square"].includes(style.cap) ? style.cap : "butt") as "butt" | "round" | "square",
          join: (["miter", "round", "bevel"].includes(style.join) ? style.join : "miter") as "miter" | "round" | "bevel",
          miterLimit: Math.max(1, Math.min(100, parseNumber(style.miterLimit, 4))),
          ...(parseDashes(style.dash) ? { dash: parseDashes(style.dash) } : {}),
        }
      : null;
  return {
    t: "path",
    opacity: opacityOf(declared),
    ...(isIdentity(m) ? {} : { m }),
    ...(clip ? { clip } : {}),
    cmds,
    fill: fill ? (fill.hex ? { kind: "colour", hex: fill.hex } : { kind: "gradient", id: fill.gradient as string }) : null,
    fillOpacity: clamp01((fill?.alpha ?? 1) * parseShare(style.fillOpacity, 1)),
    fillRule: style.fillRule === "evenodd" ? "evenodd" : "nonzero",
    stroke,
  };
}

function shapeCommands(el: XmlElement, ctx: Ctx): PathCmd[] | null {
  const { width: rw, height: rh } = ctx.reference;
  const length = (name: string, of: number): number => parseLength(el.attrs[name], of) ?? 0;
  switch (el.name) {
    case "path":
      return parsePathData(el.attrs.d ?? "", ctx.budget);
    case "rect": {
      const [w, h] = [length("width", rw), length("height", rh)];
      if (w <= 0 || h <= 0) return [];
      const rxText = parseLength(el.attrs.rx, rw);
      const ryText = parseLength(el.attrs.ry, rh);
      const rx = rxText ?? ryText ?? 0;
      return shapePath.rectangle(length("x", rw), length("y", rh), w, h, rx, ryText ?? rx);
    }
    case "circle": {
      const r = length("r", Math.hypot(rw, rh) / Math.SQRT2);
      return r > 0 ? shapePath.circle(length("cx", rw), length("cy", rh), r, r) : [];
    }
    case "ellipse": {
      const [rx, ry] = [length("rx", rw), length("ry", rh)];
      return rx > 0 && ry > 0 ? shapePath.circle(length("cx", rw), length("cy", rh), rx, ry) : [];
    }
    case "line":
      return [["M", numberRound(length("x1", rw)), numberRound(length("y1", rh))], ["L", numberRound(length("x2", rw)), numberRound(length("y2", rh))]];
    default:
      return polyPath(el.attrs.points ?? "", el.name === "polygon");
  }
}

function imageNode(el: XmlElement, declared: Declared, ctx: Ctx, depth: number): VectorNode | null {
  const payload = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(el.attrs.href ?? "");
  if (!payload) return null;
  ctx.state.images += 1;
  if (ctx.state.images > LIMITS.maxEmbeddedImages) return refuse(REFUSALS.tooComplex);
  const m = transformOf(el, declared, ctx);
  const clip = clipFor(declared, ctx, depth);
  const { width: rw, height: rh } = ctx.reference;
  return {
    t: "image",
    opacity: opacityOf(declared),
    ...(isIdentity(m) ? {} : { m }),
    ...(clip ? { clip } : {}),
    x: parseLength(el.attrs.x, rw) ?? 0,
    y: parseLength(el.attrs.y, rh) ?? 0,
    // A size of 0 means "the picture's own size"; the picture is read later, when its size is known.
    width: parseLength(el.attrs.width, rw) ?? 0.001,
    height: parseLength(el.attrs.height, rh) ?? 0.001,
    png: payload[1].replace(/\s+/g, ""),
  };
}

function containerNode(children: VectorNode[], el: XmlElement, declared: Declared, ctx: Ctx, depth: number, extra: Matrix = IDENTITY): VectorNode | null {
  if (children.length === 0) return null;
  const m = multiply(transformOf(el, declared, ctx), extra);
  const clip = clipFor(declared, ctx, depth);
  const opacity = opacityOf(declared);
  if (isIdentity(m) && !clip && opacity === 1 && children.length === 1) return children[0];
  return { t: "g", opacity, ...(isIdentity(m) ? {} : { m }), ...(clip ? { clip } : {}), children };
}

function useNode(el: XmlElement, declared: Declared, style: Inherited, ctx: Ctx, depth: number, stack: readonly string[]): VectorNode | null {
  const id = el.attrs.href?.slice(1) ?? "";
  const target = ctx.ids.get(id);
  if (!target || stack.includes(id) || stack.length >= LIMITS.maxUseDepth) {
    ctx.state.warnings.add(OTHER_OMITTED);
    return null;
  }
  const move: Matrix = [1, 0, 0, 1, parseLength(el.attrs.x, ctx.reference.width) ?? 0, parseLength(el.attrs.y, ctx.reference.height) ?? 0];
  const asGroup = ["symbol", "svg", "g"].includes(target.name);
  const inner = asGroup
    ? target.children.flatMap((child) => nodesFor(child, style, ctx, depth + 1, [...stack, id]))
    : nodesFor(target, style, ctx, depth + 1, [...stack, id]);
  return containerNode(inner, el, declared, ctx, depth, move);
}

/** Converts one element, and what is inside it, to model nodes. Elements that draw nothing give an empty list. */
function nodesFor(el: XmlElement, parent: Inherited, ctx: Ctx, depth: number, stack: readonly string[]): VectorNode[] {
  ctx.budget.element(depth);
  const name = el.name.toLowerCase();
  if (el.prefix !== null && el.prefix !== "svg") return [];
  if (TEXTS.has(name)) {
    ctx.state.textOmitted = true;
    ctx.state.warnings.add(TEXT_OMITTED);
    return [];
  }
  if (SKIPPED.has(name)) return [];
  const known = CONTAINERS.has(name) || SHAPES.has(name) || name === "use" || name === "image";
  if (!known) {
    ctx.state.warnings.add(OTHER_OMITTED);
    return [];
  }
  const declared = declaredFor(el, ctx.rules);
  if (declared.display === "none") return [];
  if (el.attrs.filter !== undefined || el.attrs.mask !== undefined || /(?:^|;)\s*(?:filter|mask)\s*:/i.test(el.attrs.style ?? "")) ctx.state.warnings.add(EFFECTS_OMITTED);
  const style = inheritFrom(parent, declared);
  const node = (() => {
    if (CONTAINERS.has(name)) {
      const move: Matrix = name === "svg" ? [1, 0, 0, 1, parseLength(el.attrs.x, ctx.reference.width) ?? 0, parseLength(el.attrs.y, ctx.reference.height) ?? 0] : IDENTITY;
      return containerNode(el.children.flatMap((child) => nodesFor(child, style, ctx, depth + 1, stack)), el, declared, ctx, depth, move);
    }
    if (name === "use") return useNode(el, declared, style, ctx, depth, stack);
    if (name === "image") return imageNode(el, declared, ctx, depth);
    const cmds = shapeCommands(el, ctx);
    if (cmds === null) {
      ctx.state.warnings.add(OTHER_OMITTED);
      return null;
    }
    return pathNode(cmds, el, declared, style, ctx, depth);
  })();
  return node && !isEmptyGroup(node) ? [node] : [];
}

function viewBoxOf(root: XmlElement): { x: number; y: number; width: number; height: number } | null {
  const parts = (root.attrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  const [width, height] = [parseLength(root.attrs.width), parseLength(root.attrs.height)];
  return width && height && width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

const ABSOLUTE_WIDTH = /^\s*[-+]?[\d.]+\s*(?:px|pt|pc|mm|cm|in)?\s*$/;

/** Reads an SVG into the restricted vector model. Embedded pictures come back un-checked: `reencodeImages` follows. */
export function svgToVector(bytes: Uint8Array, budget: Budget): VectorDoc {
  const root = parseXml(decodeUtf8(bytes), budget);
  if (root.name !== "svg") return refuse(REFUSALS.notSvg);
  const viewBox = viewBoxOf(root) ?? refuse(REFUSALS.empty);
  const ids = new Map<string, XmlElement>();
  const styles: string[] = [];
  collect(root, ids, styles, budget);
  const parsed = styles.map(parseCss);
  const rules = parsed.flatMap((sheet) => sheet.rules);
  const state: State = { gradients: [], clips: [], clipIds: new Map(), gradientKeys: new Map(), warnings: new Set(), textOmitted: false, images: 0 };
  if (parsed.some((sheet) => sheet.skipped > 0)) state.warnings.add(OTHER_OMITTED);
  const ctx: Ctx = { budget, ids, rules, state, reference: { width: viewBox.width, height: viewBox.height } };

  const style = inheritFrom(ROOT_STYLE, declaredFor(root, rules));
  const nodes = root.children.flatMap((child) => nodesFor(child, style, ctx, 1, []));
  if (nodes.length === 0) refuse(state.textOmitted ? `${REFUSALS.empty} ${TEXT_OMITTED}` : REFUSALS.empty);

  const widthPx = ABSOLUTE_WIDTH.test(root.attrs.width ?? "x") ? parseLength(root.attrs.width) : null;
  const doc = vectorDocSchema.safeParse({
    schemaVersion: VECTOR_MODEL_VERSION,
    kind: "vector",
    source: "svg",
    viewBox,
    naturalWidthMm: widthPx ? numberRound((widthPx * 25.4) / 96) : null,
    gradients: state.gradients,
    clips: state.clips,
    nodes,
    textOmitted: state.textOmitted,
    warnings: [...state.warnings].slice(0, 20),
  });
  if (!doc.success) return refuse(REFUSALS.tooComplex);
  return doc.data;
}

