import sharp from "sharp";
import { renderSvg, wellFormed } from "@/lib/flat/render-svg";
import { REFERENCE_EDGE, renderReference } from "@/lib/images/reference";
import type { ProtectedRegion } from "@/lib/media-check";
import { protectedRegions } from "../regions";
import type { StudioDesign } from "../studio";

/** What a lifestyle step is conditioned on, all drawn from the design: no model is called here. */
export type LifestyleReference = Readonly<{
  /** The design's own render on white, as sent to a provider. */
  opaque: Uint8Array;
  /** The garment alone on a transparent square. Its alpha channel is the mask the checker uses. */
  garment: Uint8Array;
  /** Crest, sponsors, names and numbers, in pixels of the square. */
  regions: readonly ProtectedRegion[];
}>;

/** The drawing has pictures (crest, sponsors) and lettering (names, numbers); the checker's kinds are the nearest. */
const kindOf = (label: string): ProtectedRegion["kind"] => (label === "logo" ? "sponsor" : "number");

export async function buildReference(design: StudioDesign): Promise<LifestyleReference> {
  const svg = Buffer.from(wellFormed(renderSvg(design.front, design.images)));
  const [opaque, garment] = await Promise.all([
    renderReference(design.front, design.images),
    sharp(svg).resize({ width: REFERENCE_EDGE, height: REFERENCE_EDGE, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  ]);
  const regions = protectedRegions(design.front, REFERENCE_EDGE).map((region, index) => ({
    id: `mark-${index + 1}`,
    kind: kindOf(region.label),
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  }));
  return { opaque, garment: new Uint8Array(garment), regions };
}
