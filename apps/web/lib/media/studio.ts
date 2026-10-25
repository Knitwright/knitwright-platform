import sharp, { type Sharp } from "sharp";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel } from "@/lib/flat/model";
import { renderSvg, wellFormed } from "@/lib/flat/render-svg";
import { REFERENCE_EDGE, renderReference } from "@/lib/images/reference";
import type { GeneratedMedia } from "./contract";

/**
 * Studio renders: front, back and a flat lay, drawn from the design's own flat drawing. No model is called, no
 * random number is used and nothing in the files depends on the date, so one version gives the same bytes every time.
 */

export const STUDIO_PROVIDER = "knitwright-flat";

/** The flat lay is a wider picture than the front: the garment sits on a neutral surface with room for its shadow. */
export const FLAT_LAY = { width: 1536, height: 1024, surface: "#e6e4e1", garmentEdge: 880, shadow: { dx: 14, dy: 22, blur: 18, opacity: 0.32 } } as const;

const png = (image: Sharp): Promise<Buffer> => image.png({ compressionLevel: 9 }).toBuffer();

/** The flat on a transparent square, so it can be laid on any surface. */
async function garmentOnTransparent(model: FlatModel, images: ImageMap, edge: number): Promise<Buffer> {
  const svg = Buffer.from(wellFormed(renderSvg(model, images)));
  return png(sharp(svg).resize({ width: edge, height: edge, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }));
}

/** The front flat on a neutral surface with a soft shadow. */
export async function renderFlatLay(model: FlatModel, images: ImageMap = new Map()): Promise<Uint8Array> {
  const { width, height, surface, garmentEdge, shadow } = FLAT_LAY;
  const garment = await garmentOnTransparent(model, images, garmentEdge);
  const left = Math.round((width - garmentEdge) / 2);
  const top = Math.round((height - garmentEdge) / 2);
  const alpha = await sharp(garment).ensureAlpha().extractChannel(3).toBuffer();
  const shade = await png(
    sharp({ create: { width: garmentEdge, height: garmentEdge, channels: 3, background: "#000000" } })
      .joinChannel(alpha)
      .blur(shadow.blur),
  );
  const faded = await png(sharp(shade).ensureAlpha().linear([1, 1, 1, shadow.opacity], [0, 0, 0, 0]));
  const out = await png(
    sharp({ create: { width, height, channels: 3, background: surface } }).composite([
      { input: faded, left: left + shadow.dx, top: top + shadow.dy },
      { input: garment, left, top },
    ]),
  );
  return new Uint8Array(out);
}

const media = (view: "front" | "back" | "flat_lay", bytes: Uint8Array, width: number, height: number): GeneratedMedia => ({
  kind: "studio_render",
  view,
  png: bytes,
  width,
  height,
  checker: "not_checked",
  provider: STUDIO_PROVIDER,
  costMicrodollars: 0,
});

export type StudioDesign = Readonly<{ front: FlatModel; back: FlatModel; images: ImageMap }>;

/** Front, back and flat lay of a design, in that order. */
export async function renderStudioSet(design: StudioDesign): Promise<readonly GeneratedMedia[]> {
  const [front, back, flatLay] = await Promise.all([
    renderReference(design.front, design.images),
    renderReference(design.back, design.images),
    renderFlatLay(design.front, design.images),
  ]);
  return [
    media("front", front, REFERENCE_EDGE, REFERENCE_EDGE),
    media("back", back, REFERENCE_EDGE, REFERENCE_EDGE),
    media("flat_lay", flatLay, FLAT_LAY.width, FLAT_LAY.height),
  ];
}

export { REFERENCE_EDGE };
