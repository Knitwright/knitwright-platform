import sharp from "sharp";
import type { ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { flatModels } from "@/lib/images/reference";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import type { StudioDesign } from "../studio";

export const CREST_ID = "0b4a5b1e-7c7e-4e57-9d6a-3f1a2b3c4d5e";

const crest = {
  id: "crest",
  name: "crest",
  source: { kind: "file", fileId: CREST_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 1600,
  height: 1600,
  rotationDegrees: 0,
  technique: "screen-print",
  provenance: "user-edited",
};

/** A crest with real detail (a chequer), so a missing or warped one can be told from a plain patch. */
export const chequer = async (): Promise<Uint8Array> => {
  const size = 64;
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dark = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      raw.set(dark ? [20, 20, 120] : [250, 210, 40], (y * size + x) * 3);
    }
  }
  return new Uint8Array(await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer());
};

export const spec = (): GarmentSpec =>
  ({
    ...start("crew-tee"),
    artwork: [crest],
    namesAndNumbers: { places: [{ place: "back-number", height: 2000 }], colour: "", sampleName: "SMITH", sampleNumber: "7", provenance: "user-edited" },
  }) as unknown as GarmentSpec;

export async function studioDesign(): Promise<StudioDesign> {
  const models = flatModels(spec(), DEFAULT_CHART_SET);
  if (!models) throw new Error("No drawing");
  const images: ImageMap = new Map([[CREST_ID, { bytes: await chequer(), contentType: "image/png" as const }]]);
  return { ...models, images };
}
