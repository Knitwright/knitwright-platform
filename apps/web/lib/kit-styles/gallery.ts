import { z } from "zod";
import { buildFlat } from "@/lib/flat/build";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { KIT_PATTERN_STYLES, SWATCH_PATTERN, type GarmentSpec } from "@/lib/garment";
import { tableSize } from "@/lib/projects/measurement-table";
import { resolveMeasurements, type ChartSet } from "@/lib/sizing";
import { kitStylesFor, withKitStyle, type ClubColours, type KitStyleId } from "./presets";

import { GALLERY_FROM } from "./address";

export { GALLERY_FROM, galleryAddress, type GalleryFrom } from "./address";

export interface KitStyleTile {
  readonly id: KitStyleId;
  readonly label: string;
  readonly hint: string;
  /** The front of the design in this style, as a data address for an image tag, so nothing in it can run. */
  readonly src: string;
  readonly alt: string;
  /** True for the style the design has now. */
  readonly current: boolean;
}

/**
 * One tile for each kit style the garment offers: the front of this very design, in that style
 * and the club's colours, drawn the same way as the editor's drawing. None for a garment with no
 * kit styles.
 */
export function kitStyleTiles(spec: GarmentSpec, colours: ClubColours, charts?: ChartSet): readonly KitStyleTile[] {
  const measurements = resolveMeasurements(spec, tableSize(spec, charts), charts);
  const now = spec.kitPattern?.style ?? "plain";
  return kitStylesFor(spec.typeId).flatMap((style): KitStyleTile[] => {
    const styled = withKitStyle(spec, style.id, colours);
    if (!styled.ok) return [];
    const model = buildFlat({ spec: styled.spec, measurements, view: "front", colourwayId: styled.spec.colourways[0].id });
    if (!model) return [];
    return [
      {
        id: style.id,
        label: style.label,
        hint: style.hint,
        src: svgDataUri(renderSvg(model)),
        alt: `${style.label}: ${model.description}`,
        current: style.id === now,
      },
    ];
  });
}

const swatch = z.string().regex(SWATCH_PATTERN, "Pick a colour from the list.");

/** What the gallery's form sends. Colours are checked again when the style is applied. */
export const applyKitStyleSchema = z.object({
  projectId: z.uuid("That is not a design."),
  expectedVersion: z.coerce.number().int().min(1).max(2147483647),
  styleId: z.enum(["plain", ...KIT_PATTERN_STYLES] as const, "Choose a kit style."),
  main: swatch,
  second: swatch,
  third: z.union([z.literal("").transform(() => null), swatch]),
  from: z.enum(GALLERY_FROM),
});
