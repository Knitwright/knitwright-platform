import type { Shape } from "../geometry/boolean";
import { shapeBounds } from "../geometry/boolean";
import { boxesOverlap, round2, type Box, type Pt } from "../geometry/vec";
import { num as n, pageMap, pathData, type PageMap } from "./svg-util";
import type { PieceScene, SceneLayer } from "../layout/scene";

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export const CUT_COLOUR = "#000000";
export const BLEED_COLOUR = "#00a0e0";
export const GUIDE_WIDTH_MM = 0.25;

export interface SvgOptions {
  /** The part of the page to draw, in the piece's millimetres. The whole page when missing. */
  readonly region?: Box;
  /** Writes the size in pixels instead of millimetres, for the rasteriser. */
  readonly pixels?: { readonly widthPx: number; readonly heightPx: number };
  readonly guides: boolean;
  readonly slug: readonly Shape[];
  /** A flat colour under everything (paper white for a TIFF). Nothing when null. */
  readonly background: string | null;
  /** Layers to leave out, by id. */
  readonly skipLayers?: ReadonlySet<string>;
  /** Description text, one note per line. */
  readonly description?: readonly string[];
}

const inRegion = (shape: Shape, region: Box): boolean => boxesOverlap(shapeBounds(shape), region);

function layerSvg(layer: SceneLayer, to: PageMap, page: Box, region: Box): string {
  const attrs = `${layer.opacity < 1 ? ` opacity="${n(layer.opacity)}"` : ""}${layer.blend === "normal" || layer.blend === "knock-out" ? "" : ` style="mix-blend-mode:${layer.blend}"`}`;
  if (layer.kind === "vector") {
    const body = layer.shapes
      .filter((s) => inRegion(s.shape, region))
      .map((s) => `<path fill="${s.fill}"${s.opacity === undefined ? "" : ` fill-opacity="${n(s.opacity)}"`} fill-rule="evenodd" d="${pathData(s.shape, to)}"/>`)
      .join("");
    return `<g id="layer-${escape(layer.layerId)}"${attrs}>${body}</g>`;
  }
  const body = layer.strips
    .filter((s) => boxesOverlap(s.box, region))
    .map((s) => {
      const [x, y] = to([s.box.minX, s.box.maxY]);
      const w = s.box.maxX - s.box.minX;
      const h = s.box.maxY - s.box.minY;
      return `<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" href="data:image/png;base64,${Buffer.from(s.png).toString("base64")}"/>`;
    })
    .join("");
  return `<g id="layer-${escape(layer.layerId)}"${attrs}>${body}</g>`;
}

function guidesSvg(scene: PieceScene, to: PageMap): string {
  const line = (ring: readonly Pt[], colour: string, dash: string): string =>
    `<path fill="none" stroke="${colour}" stroke-width="${GUIDE_WIDTH_MM}"${dash} d="M${ring.map((p) => to(p)).map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z"/>`;
  return `<g id="guides">${line(scene.bleedOutline, BLEED_COLOUR, ' stroke-dasharray="2 1"')}${line(scene.cutOutline, CUT_COLOUR, "")}</g>`;
}

/**
 * The scene as an SVG document. Built when a person downloads it and never stored: an SVG can hold script, so the
 * exports bucket does not accept one (tests/integration/isolation.test.ts). This document holds shapes and pictures only.
 */
export function buildSvg(scene: PieceScene, options: SvgOptions): string {
  const page = scene.box;
  const region = options.region ?? page;
  const to = pageMap(page);
  const [w, h] = [page.maxX - page.minX, page.maxY - page.minY];
  const view = options.region === undefined ? { x: 0, y: 0, w, h } : { x: region.minX - page.minX, y: page.maxY - region.maxY, w: region.maxX - region.minX, h: region.maxY - region.minY };
  const size = options.pixels === undefined ? `width="${n(view.w)}mm" height="${n(view.h)}mm"` : `width="${options.pixels.widthPx}" height="${options.pixels.heightPx}"`;
  const layers = scene.layers.filter((l) => options.skipLayers?.has(l.layerId) !== true).map((l) => layerSvg(l, to, page, region)).join("");
  const slug = options.slug.length === 0 ? "" : `<g id="notes" fill="#000000">${options.slug.filter((s) => inRegion(s, region)).map((s) => `<path fill-rule="evenodd" d="${pathData(s, to)}"/>`).join("")}</g>`;
  const background = options.background === null ? "" : `<rect x="${n(view.x)}" y="${n(view.y)}" width="${n(view.w)}" height="${n(view.h)}" fill="${options.background}"/>`;
  const desc = options.description === undefined ? "" : `<desc>${escape(options.description.join("\n"))}</desc>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}">` +
    `<title>${escape(`${scene.pieceName}, size ${scene.size}`)}</title>${desc}${background}${layers}${options.guides ? guidesSvg(scene, to) : ""}${slug}</svg>`
  );
}

export const pageSizeMm = (scene: Pick<PieceScene, "box">): { widthMm: number; heightMm: number } => ({
  widthMm: round2(scene.box.maxX - scene.box.minX),
  heightMm: round2(scene.box.maxY - scene.box.minY),
});
