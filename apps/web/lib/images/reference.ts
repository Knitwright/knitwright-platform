import sharp from "sharp";
import { buildFlat } from "@/lib/flat/build";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel, View } from "@/lib/flat/model";
import { renderSvg, wellFormed } from "@/lib/flat/render-svg";
import type { GarmentSpec } from "@/lib/garment";
import { activeColourwayId } from "@/lib/projects/colour-controls";
import { tableSize } from "@/lib/projects/measurement-table";
import { resolveMeasurements, type ChartSet } from "@/lib/sizing";

/**
 * The picture sent to the image model with the prompt: the flat, drawn as the design is,
 * with the uploaded logo's own pixels composited in. Plan step 14, tasks 2 and 4.
 */

/** Longest side of the reference, in pixels. Image models work at about this size. */
export const REFERENCE_EDGE = 1024;

export const VIEWS = ["front", "back"] as const satisfies readonly View[];

type ViewModels = Readonly<Record<(typeof VIEWS)[number], FlatModel>>;

/**
 * Front and back of the design, without measurement callouts. Null for a type with no drawing.
 * The measurements come from the brand's charts, as the editor draws the design.
 */
export function flatModels(spec: GarmentSpec, charts: ChartSet, colourwayId?: string): ViewModels | null {
  const measurements = resolveMeasurements(spec, tableSize(spec, charts), charts);
  const colourway = activeColourwayId(spec, colourwayId);
  const front = buildFlat({ spec, measurements, view: "front", colourwayId: colourway });
  const back = buildFlat({ spec, measurements, view: "back", colourwayId: colourway });
  return front && back ? { front, back } : null;
}

/**
 * The flat as a square PNG on white. The logo is drawn from the bytes in `images`, which
 * are the uploaded file's, so the model sees the real logo rather than a description.
 */
export async function renderReference(model: FlatModel, images: ImageMap = new Map()): Promise<Uint8Array> {
  const svg = Buffer.from(wellFormed(renderSvg(model, images)));
  const png = await sharp(svg)
    .resize({ width: REFERENCE_EDGE, height: REFERENCE_EDGE, fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}
