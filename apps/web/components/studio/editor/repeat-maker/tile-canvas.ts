import { REPEAT_STYLE_LABELS, tileDraws, tileText, type LayerDraw, type RepeatDraft } from "@/lib/repeat";

/**
 * Drawing one tile of a repeat (plan v5 Y8, decision 0081). The tile is drawn on a canvas and the
 * canvas is what is published: a PNG of the tile goes into the brand's own library through the
 * artwork upload, so it passes moderation on the way in (X8 `screenUpload`) like any other picture.
 *
 * The drawing takes the smallest context it needs rather than a real `CanvasRenderingContext2D`, so
 * what it draws and in what order has a test of its own and never needs a browser.
 */

/** The part of a 2D canvas context this module uses. */
export interface TileContext {
  fillStyle: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  beginPath(): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, start: number, end: number): void;
  fill(): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
}

/** A picture already loaded for a layer, by the artwork it draws. */
export type LoadedImages = ReadonlyMap<string, unknown>;

const RADIANS = Math.PI / 180;

/** A stripe is drawn as a band across the whole of its own width, which is what a hoop or a stripe is. */
const STRIPE_HEIGHT_SHARE = 0.4;

function drawOne(context: TileContext, draw: LayerDraw, scale: number, images: LoadedImages): void {
  const width = draw.widthTenths * scale;
  const height = draw.heightTenths * scale;
  context.save();
  context.translate((draw.leftTenths + draw.widthTenths / 2) * scale, (draw.topTenths + draw.heightTenths / 2) * scale);
  if (draw.rotationDeg !== 0) context.rotate(draw.rotationDeg * RADIANS);
  const picture = draw.artworkId === null ? undefined : images.get(draw.artworkId);
  if (picture !== undefined) {
    context.drawImage(picture, -width / 2, -height / 2, width, height);
  } else if (draw.shape === "circle") {
    context.fillStyle = draw.colour;
    context.beginPath();
    context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.fill();
  } else if (draw.shape === "stripe") {
    context.fillStyle = draw.colour;
    context.fillRect(-width / 2, (-height * STRIPE_HEIGHT_SHARE) / 2, width, height * STRIPE_HEIGHT_SHARE);
  } else {
    // A square, and a picture whose file has not loaded yet: its own box in its own colour, so the
    // layer is never silently missing from what is published.
    context.fillStyle = draw.colour;
    context.fillRect(-width / 2, -height / 2, width, height);
  }
  context.restore();
}

/**
 * Draws the whole tile: the background first, then every layer bottom to top, with the copies that
 * join the tile at its edges. `scale` is canvas pixels per tenth of a millimetre.
 */
export function drawTile(context: TileContext, draft: RepeatDraft, scale: number, images: LoadedImages = new Map()): void {
  context.fillStyle = draft.background;
  context.fillRect(0, 0, draft.tile.widthTenths * scale, draft.tile.heightTenths * scale);
  for (const draw of tileDraws(draft)) drawOne(context, draw, scale, images);
}

/** How many canvas pixels a tenth of a millimetre is, to publish the tile at this resolution. */
export const scaleForDpi = (dpi: number): number => dpi / 254;

/** The size of the canvas a tile is published on, in whole pixels. */
export function tilePixels(draft: RepeatDraft, dpi: number): Readonly<{ width: number; height: number }> {
  const scale = scaleForDpi(dpi);
  return { width: Math.max(1, Math.round(draft.tile.widthTenths * scale)), height: Math.max(1, Math.round(draft.tile.heightTenths * scale)) };
}

/**
 * The published file's name. It carries the repeat's own recipe — the style and the tile size — so
 * the library says what a tile is and the factory can read it off the file. The tile's layers are
 * not kept yet; the follow-up in decision 0081 adds a table that holds the recipe for re-editing.
 */
export function publishedFileName(draft: RepeatDraft): string {
  const size = `${tileText(draft.tile.widthTenths, draft.unit)}x${tileText(draft.tile.heightTenths, draft.unit)}${draft.unit}`;
  const safe = draft.name.trim().replace(/[^A-Za-z0-9 -]/g, "").replace(/\s+/g, " ").trim();
  return `${safe || "Pattern fill"} - ${REPEAT_STYLE_LABELS[draft.style]} ${size}.png`;
}
