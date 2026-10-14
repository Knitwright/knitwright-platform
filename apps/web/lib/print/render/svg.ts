import { compose, type Affine } from "@/lib/print/geometry/affine";
import { pageSizeMm, type FillItem, type ImageItem, type PieceScene, type SceneItem, type StrokeItem } from "@/lib/print/scene";
import { alpha, checkedColour, escapeText, fine, mm, pieceTitle, svgRing, svgRings, toPageMatrix } from "./format";
import { flatArtItem } from "./flat-item";
import type { FlatArt } from "./types";

/** The window of the page an SVG shows, in page millimetres, and the size it is given. */
export interface SvgView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The width and height attributes, written as they are. */
  readonly widthAttr: string;
  readonly heightAttr: string;
  /** More places in the window when a strip must line up to the pixel. */
  readonly places: number;
  readonly keepAspect: boolean;
}

export interface SvgParts {
  readonly items: readonly SceneItem[];
  readonly background: string | null;
  readonly art: boolean;
  readonly guides: boolean;
  readonly margin: boolean;
  readonly meta: boolean;
  /** Every item is drawn as a normal one, because the caller blends its layer. */
  readonly forceNormal: boolean;
}

const BLEND_CSS: Readonly<Record<string, string>> = { multiply: "multiply", screen: "screen", overlay: "overlay" };

const effectAttrs = (opacity: number, blend: string, forceNormal: boolean): string => {
  const parts = [opacity < 1 ? ` opacity="${alpha(opacity)}"` : ""];
  const css = forceNormal ? undefined : BLEND_CSS[blend];
  if (css) parts.push(` style="mix-blend-mode:${css}"`);
  return parts.join("");
};

const fillElement = (item: FillItem, scene: PieceScene, forceNormal: boolean): string =>
  `<path d="${svgRings(item.rings, scene)}" fill="${checkedColour(item.colour)}" fill-rule="evenodd"${effectAttrs(item.opacity, item.blend, forceNormal)}/>`;

function strokeElement(item: StrokeItem, scene: PieceScene, forceNormal: boolean): string {
  const path = svgRing(item.points, scene);
  const d = item.closed ? path : path.replace(/ Z$/, "");
  const attrs = `fill="none" stroke="${checkedColour(item.colour)}" stroke-width="${mm(item.widthMm)}" stroke-linejoin="round" stroke-linecap="round"`;
  return `<path d="${d}" ${attrs}${effectAttrs(item.opacity, item.blend, forceNormal)}/>`;
}

/** Picture index by first use, so no picture text reaches an attribute. */
const imageIndex = (images: readonly ImageItem[]): ReadonlyMap<string, number> => {
  const index = new Map<string, number>();
  for (const image of images) if (!index.has(image.imageId)) index.set(image.imageId, index.size);
  return index;
};

const dataUri = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

function imageDefinitions(images: readonly ImageItem[], index: ReadonlyMap<string, number>): string[] {
  const seen = new Set<string>();
  const defs: string[] = [];
  for (const image of images) {
    if (seen.has(image.imageId)) continue;
    seen.add(image.imageId);
    defs.push(`<image id="img${index.get(image.imageId)}" width="${image.widthPx}" height="${image.heightPx}" href="${dataUri(image.png)}"/>`);
  }
  return defs;
}

const pictureMatrix = (item: ImageItem, scene: PieceScene): Affine => compose(toPageMatrix(scene), item.matrix);

function imageElement(item: ImageItem, scene: PieceScene, index: ReadonlyMap<string, number>, clipId: string | null, forceNormal: boolean): string {
  const [a, b, c, d, e, f] = pictureMatrix(item, scene);
  const matrix = `matrix(${fine(a)} ${fine(b)} ${fine(c)} ${fine(d)} ${mm(e)} ${mm(f)})`;
  const use = `<use href="#img${index.get(item.imageId)}" transform="${matrix}"${effectAttrs(item.opacity, item.blend, forceNormal)}/>`;
  return clipId ? `<g clip-path="url(#${clipId})">${use}</g>` : use;
}

function artElements(items: readonly SceneItem[], scene: PieceScene, forceNormal: boolean): { defs: string[]; body: string[] } {
  const images = items.filter((item): item is ImageItem => item.kind === "image");
  const index = imageIndex(images);
  const defs = imageDefinitions(images, index);
  let clips = 0;
  const body = items.map((item) => {
    if (item.kind === "fill") return fillElement(item, scene, forceNormal);
    if (item.kind === "stroke") return strokeElement(item, scene, forceNormal);
    const clipId = item.clip.length > 0 ? `clip${clips++}` : null;
    if (clipId) defs.push(`<clipPath id="${clipId}"><path clip-rule="evenodd" d="${svgRings(item.clip, scene)}"/></clipPath>`);
    return imageElement(item, scene, index, clipId, forceNormal);
  });
  return { defs, body };
}

function guideElements(scene: PieceScene): string[] {
  return [
    `<path d="${svgRing(scene.cut, scene)}" fill="none" stroke="#ff00ff" stroke-width="0.25"/>`,
    `<path d="${svgRing(scene.bleed, scene)}" fill="none" stroke="#00ffff" stroke-width="0.25" stroke-dasharray="1.5 1"/>`,
  ];
}

const note = (scene: PieceScene): string => scene.noteLines.join("\n");

const openTag = (scene: PieceScene, view: SvgView): string => {
  const digits = view.places === 2 ? mm : (value: number): string => value.toFixed(view.places);
  const box = [view.x, view.y, view.width, view.height].map(digits).join(" ");
  const aspect = view.keepAspect ? "" : ' preserveAspectRatio="none"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${view.widthAttr}" height="${view.heightAttr}" viewBox="${box}"${aspect}>`;
};

/** The whole SVG text for a window of the page. It is only ever a string: nothing stores or serves it. */
export function buildSvg(scene: PieceScene, view: SvgView, parts: SvgParts): string {
  const art = parts.art ? artElements(parts.items, scene, parts.forceNormal) : { defs: [], body: [] };
  const size = pageSizeMm(scene);
  const defs = [`<clipPath id="bleed-clip"><path clip-rule="evenodd" d="${svgRing(scene.bleed, scene)}"/></clipPath>`, ...art.defs];
  const out = [openTag(scene, view)];
  if (parts.meta) out.push(`<title>${escapeText(pieceTitle(scene))}</title>`, `<desc>${escapeText(note(scene))}</desc>`);
  out.push(`<defs>${defs.join("")}</defs>`);
  if (parts.background) out.push(`<rect x="0" y="0" width="${mm(size.width)}" height="${mm(size.height)}" fill="${checkedColour(parts.background)}"/>`);
  if (parts.art) out.push(`<g id="art" clip-path="url(#bleed-clip)">${art.body.join("")}</g>`);
  if (parts.guides) out.push(`<g id="guides">${guideElements(scene).join("")}</g>`);
  if (parts.margin) out.push(`<g id="margin">${scene.margin.map((item) => fillElement(item, scene, parts.forceNormal)).join("")}</g>`);
  out.push("</svg>");
  return out.join("\n");
}

/** The art items to draw: the scene's own, or the one flattened picture when the scene is a raster one. */
export function artItems(scene: PieceScene, flat: FlatArt | undefined): readonly SceneItem[] {
  if (!scene.raster) return scene.items;
  if (!flat) throw new RangeError("A scene with a blending layer needs its flattened art.");
  return [flatArtItem(scene, flat)];
}

/** The SVG of a piece, in millimetres. A raster scene needs `flat` (see renderSvgAsync). */
export function renderSvg(scene: PieceScene, flat?: FlatArt): string {
  const size = pageSizeMm(scene);
  const view: SvgView = { x: 0, y: 0, width: size.width, height: size.height, widthAttr: `${mm(size.width)}mm`, heightAttr: `${mm(size.height)}mm`, places: 2, keepAspect: true };
  return buildSvg(scene, view, { items: artItems(scene, flat), background: null, art: true, guides: true, margin: true, meta: true, forceNormal: false });
}
