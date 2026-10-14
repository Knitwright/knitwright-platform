import sharp from "sharp";
import { ARTWORK_LIMITS } from "../limits";
import { IDENTITY, isIdentity, multiply, type Matrix } from "./matrix";
import type { VectorDoc, VectorGradient, VectorNode, VectorPaint, VectorStroke } from "./model";
import type { PathCmd } from "./path-data";

/**
 * Draws the vector model as SVG text, for the preview and for any SVG handed back on download. It is
 * built here from numbers, checked colours and ids, and base64 pictures, all validated by the model's
 * schema, so nothing a person wrote reaches the text as code. It is never stored.
 */

const n = (value: number): string => String(Math.round(value * 1000) / 1000 + 0);

const dataOf = (cmds: readonly PathCmd[]): string => cmds.map((c) => (c[0] === "Z" ? "Z" : `${c[0]}${c.slice(1).map((v) => n(v as number)).join(" ")}`)).join("");

const matrixText = (m: Matrix): string => `matrix(${m.map(n).join(" ")})`;

const paintText = (paint: VectorPaint | null): string => (paint === null ? "none" : paint.kind === "colour" ? paint.hex : `url(#${paint.id})`);

const transformAttr = (m: Matrix | undefined): string => (m && !isIdentity(m) ? ` transform="${matrixText(m)}"` : "");
const clipAttr = (clip: string | undefined): string => (clip ? ` clip-path="url(#${clip})"` : "");
const opacityAttr = (opacity: number): string => (opacity < 1 ? ` opacity="${n(opacity)}"` : "");

function strokeAttrs(stroke: VectorStroke | null): string {
  if (!stroke) return "";
  const dash = stroke.dash ? ` stroke-dasharray="${stroke.dash.map(n).join(" ")}"` : "";
  return (
    ` stroke="${paintText(stroke.paint)}" stroke-width="${n(stroke.width)}" stroke-opacity="${n(stroke.opacity)}"` +
    ` stroke-linecap="${stroke.cap}" stroke-linejoin="${stroke.join}" stroke-miterlimit="${n(stroke.miterLimit)}"${dash}`
  );
}

function nodeText(node: VectorNode): string {
  const common = `${transformAttr(node.m)}${clipAttr(node.clip)}${opacityAttr(node.opacity)}`;
  switch (node.t) {
    case "g":
      return `<g${common}>${node.children.map(nodeText).join("")}</g>`;
    case "path":
      return (
        `<path d="${dataOf(node.cmds)}" fill="${paintText(node.fill)}" fill-opacity="${n(node.fillOpacity)}" fill-rule="${node.fillRule}"` +
        `${strokeAttrs(node.stroke)}${common}/>`
      );
    case "image":
      return `<image x="${n(node.x)}" y="${n(node.y)}" width="${n(node.width)}" height="${n(node.height)}" preserveAspectRatio="none" href="data:image/png;base64,${node.png}"${common}/>`;
  }
}

type ClipShape = Readonly<{ cmds: readonly PathCmd[]; m: Matrix; fillRule: "nonzero" | "evenodd" }>;

/** A clip path may hold shapes only, so groups are folded into their shapes' transforms. */
function clipShapes(nodes: readonly VectorNode[], m: Matrix = IDENTITY): ClipShape[] {
  return nodes.flatMap((node): ClipShape[] => {
    const own = multiply(m, node.m ?? IDENTITY);
    if (node.t === "g") return clipShapes(node.children, own);
    return node.t === "path" ? [{ cmds: node.cmds, m: own, fillRule: node.fillRule }] : [];
  });
}

function gradientText(g: VectorGradient): string {
  const stops = g.stops.map((s) => `<stop offset="${n(s.offset)}" stop-color="${s.hex}" stop-opacity="${n(s.opacity)}"/>`).join("");
  const transform = g.m ? ` gradientTransform="${matrixText(g.m)}"` : "";
  return g.type === "linear"
    ? `<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(g.x2)}" y2="${n(g.y2)}"${transform}>${stops}</linearGradient>`
    : `<radialGradient id="${g.id}" gradientUnits="userSpaceOnUse" cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fx="${n(g.fx)}" fy="${n(g.fy)}"${transform}>${stops}</radialGradient>`;
}

/** The model as SVG text at the given pixel width (the height follows the view box). */
export function vectorToSvg(doc: VectorDoc, widthPx?: number): string {
  const { viewBox } = doc;
  const width = widthPx ?? viewBox.width;
  const height = (width * viewBox.height) / viewBox.width;
  const clips = doc.clips
    .map((c) => `<clipPath id="${c.id}">${clipShapes(c.nodes).map((s) => `<path d="${dataOf(s.cmds)}" clip-rule="${s.fillRule}"${transformAttr(s.m)}/>`).join("")}</clipPath>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="${n(viewBox.x)} ${n(viewBox.y)} ${n(viewBox.width)} ${n(viewBox.height)}">` +
    `<defs>${doc.gradients.map(gradientText).join("")}${clips}</defs>${doc.nodes.map(nodeText).join("")}</svg>`
  );
}

export const VECTOR_PREVIEW_EDGE = 1600;

/** A PNG of the vector, longest side `edge` pixels, on a see-through background. */
export async function renderVectorPreview(doc: VectorDoc, edge: number = VECTOR_PREVIEW_EDGE): Promise<Buffer> {
  const scale = edge / Math.max(doc.viewBox.width, doc.viewBox.height);
  const width = Math.max(1, Math.round(doc.viewBox.width * scale));
  const svg = vectorToSvg(doc, width);
  return sharp(Buffer.from(svg), { limitInputPixels: ARTWORK_LIMITS.maxPixels }).png({ compressionLevel: 9 }).toBuffer();
}
