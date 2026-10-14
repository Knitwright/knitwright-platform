import type { Gradient, Paint, PathNode, VectorModel, VectorNode } from "./model";
import type { Segment } from "./path";

/**
 * Draws the model as SVG text, in memory. It is used to make the screen picture and to build a download
 * on request. It is never stored or served from storage: the file kinds hold JSON, not SVG. Every value
 * written is a number, a hex colour or an id the model made, so nothing from the original file can reach it.
 */

const num = (value: number): string => String(Math.round(value * 10_000) / 10_000);

const matrixAttr = (matrix: readonly number[] | undefined): string =>
  matrix ? ` transform="matrix(${matrix.map(num).join(" ")})"` : "";

const pathData = (segments: readonly Segment[]): string =>
  segments.map((segment) => `${segment[0]}${(segment.slice(1) as number[]).map(num).join(" ")}`).join("");

const paintAttr = (name: "fill" | "stroke", paint: Paint): string => {
  if (paint.type === "none") return ` ${name}="none"`;
  const value = paint.type === "colour" ? paint.hex : `url(#${paint.gradientId})`;
  return ` ${name}="${value}"${paint.opacity < 1 ? ` ${name}-opacity="${num(paint.opacity)}"` : ""}`;
};

const common = (node: { opacity: number; clipId?: string; transform?: readonly number[] }): string =>
  `${node.opacity < 1 ? ` opacity="${num(node.opacity)}"` : ""}${node.clipId ? ` clip-path="url(#${node.clipId})"` : ""}${matrixAttr(node.transform)}`;

const pathElement = (node: PathNode): string =>
  `<path d="${pathData(node.segments)}"${paintAttr("fill", node.fill)}${node.fillRule === "evenodd" ? ' fill-rule="evenodd"' : ""}` +
  (node.stroke.type === "none"
    ? ""
    : `${paintAttr("stroke", node.stroke)} stroke-width="${num(node.strokeWidth)}" stroke-linecap="${node.lineCap}" stroke-linejoin="${node.lineJoin}" stroke-miterlimit="${num(node.miterLimit)}"`) +
  `${common(node)}/>`;

const nodeElement = (node: VectorNode): string => {
  if (node.kind === "path") return pathElement(node);
  if (node.kind === "image") {
    return `<image x="${num(node.x)}" y="${num(node.y)}" width="${num(node.width)}" height="${num(node.height)}" href="data:image/png;base64,${node.png}"${common(node)}/>`;
  }
  return `<g${common(node)}>${node.children.map(nodeElement).join("")}</g>`;
};

const gradientElement = (gradient: Gradient): string => {
  const units = ` gradientUnits="${gradient.units}" spreadMethod="${gradient.spread}"${matrixAttr(gradient.transform).replace("transform", "gradientTransform")}`;
  const stops = gradient.stops
    .map((stop) => `<stop offset="${num(stop.offset)}" stop-color="${stop.hex}" stop-opacity="${num(stop.opacity)}"/>`)
    .join("");
  if (gradient.type === "linear") {
    return `<linearGradient id="${gradient.id}" x1="${num(gradient.x1)}" y1="${num(gradient.y1)}" x2="${num(gradient.x2)}" y2="${num(gradient.y2)}"${units}>${stops}</linearGradient>`;
  }
  return `<radialGradient id="${gradient.id}" cx="${num(gradient.cx)}" cy="${num(gradient.cy)}" r="${num(gradient.r)}" fx="${num(gradient.fx)}" fy="${num(gradient.fy)}"${units}>${stops}</radialGradient>`;
};

export type ToSvgOptions = Readonly<{ widthPx: number; heightPx: number }>;

/** The model as SVG text at the given pixel size. */
export const modelToSvg = (model: VectorModel, size: ToSvgOptions): string => {
  const { x, y, width, height } = model.viewBox;
  const defs =
    model.gradients.map(gradientElement).join("") +
    model.clips.map((clip) => `<clipPath id="${clip.id}">${clip.children.map(pathElement).join("")}</clipPath>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.widthPx}" height="${size.heightPx}" viewBox="${num(x)} ${num(y)} ${num(width)} ${num(height)}">` +
    `<defs>${defs}</defs>${model.nodes.map(nodeElement).join("")}</svg>`
  );
};
