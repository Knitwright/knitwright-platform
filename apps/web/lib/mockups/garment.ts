import sharp from "sharp";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel } from "@/lib/flat/model";
import { renderSvg, wellFormed } from "@/lib/flat/render-svg";
import type { GarmentSpec } from "@/lib/garment";
import { flatModels } from "@/lib/images/reference";
import type { ChartSet } from "@/lib/sizing";
import type { RosterEntry } from "./types";

/**
 * The garment a mockup is built from, and the one place it comes from (plan v5 wave 4 preamble:
 * "every image starts from the deterministic render or the golden-sample photo").
 *
 * It is the design's own flat drawing (`lib/flat`, the same drawing the editor shows and the same
 * one `lib/media/studio.ts` renders), painted on nothing so a scene can be put behind it. Nothing
 * here calls a model, nothing here is random and nothing here reads a clock, so one design and one
 * colourway give the same bytes every time.
 *
 * A roster entry changes what the drawing **shows**, not what the design **is**: the sample name and
 * number the flat draws are swapped for the ones the board asks for, and the design itself is never
 * written. F-L1 asks exactly this -- "one scene can render Home, Away and GK, or player SMITH 7" --
 * and a mockup that quietly edited a brand's design to do it would be a bug, not a feature.
 */

/** The two sides the server can draw straight from the flat. Both have a transparent background. */
export interface GarmentDrawings {
  readonly front: Uint8Array;
  readonly back: Uint8Array;
  /** The longest side each drawing was painted at. */
  readonly edge: number;
}

/** The design with the board's shirt name and number in place of its own sample. Never saved. */
export function withRoster(spec: GarmentSpec, roster: RosterEntry | null): GarmentSpec {
  const marks = spec.namesAndNumbers;
  if (roster === null || marks === undefined) return spec;
  return { ...spec, namesAndNumbers: { ...marks, sampleName: roster.name, sampleNumber: roster.number } } as GarmentSpec;
}

/** One flat model as a square PNG with nothing behind it, `edge` on its longer side. */
export async function drawingOf(model: FlatModel, images: ImageMap, edge: number): Promise<Uint8Array> {
  const svg = Buffer.from(wellFormed(renderSvg(model, images)));
  const out = await sharp(svg)
    .resize({ width: edge, height: edge, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(out);
}

export interface GarmentAsk {
  readonly spec: GarmentSpec;
  readonly charts: ChartSet;
  /** The colourway to draw, or left out for the design's own first. */
  readonly colourwayId?: string;
  readonly roster?: RosterEntry | null;
  readonly images?: ImageMap;
  readonly edge: number;
}

/**
 * The front and the back of a design, drawn on nothing. Null for a garment type the platform has no
 * drawing for, which a panel says plainly rather than showing an empty scene.
 */
export async function drawGarment(ask: GarmentAsk): Promise<GarmentDrawings | null> {
  const spec = withRoster(ask.spec, ask.roster ?? null);
  const models = flatModels(spec, ask.charts, ask.colourwayId);
  if (models === null) return null;
  const images = ask.images ?? new Map();
  const [front, back] = await Promise.all([drawingOf(models.front, images, ask.edge), drawingOf(models.back, images, ask.edge)]);
  return { front, back, edge: ask.edge };
}

/** What the screen says when the platform has no drawing of this garment type. */
export const NO_DRAWING_LINE = "There is no drawing of this garment type yet, so a mockup cannot be built from it.";
