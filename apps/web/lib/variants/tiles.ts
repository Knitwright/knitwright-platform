import { buildFlat } from "@/lib/flat/build";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import type { GarmentSpec } from "@/lib/garment";
import { tableSize } from "@/lib/projects/measurement-table";
import { resolveMeasurements, type ChartSet } from "@/lib/sizing";
import type { Variant, VariantFinding, VariantKind } from "./types";

/** What the panel needs for one tile. The picture is a data address for an image tag, so nothing in it can run. */
export interface VariantTile {
  readonly id: string;
  readonly kind: VariantKind;
  readonly label: string;
  readonly summary: string;
  readonly src: string | null;
  readonly alt: string;
  readonly warnings: readonly VariantFinding[];
}

/** The front of a design as the editor's own flat renderer draws it, or null when it cannot be drawn. */
export function frontPicture(spec: GarmentSpec, charts?: ChartSet): Readonly<{ src: string; alt: string }> | null {
  const measurements = resolveMeasurements(spec, tableSize(spec, charts), charts);
  const model = buildFlat({ spec, measurements, view: "front", colourwayId: spec.colourways[0].id });
  return model ? { src: svgDataUri(renderSvg(model)), alt: model.description } : null;
}

export function variantTiles(variants: readonly Variant[], charts?: ChartSet): readonly VariantTile[] {
  return variants.map((variant) => {
    const picture = frontPicture(variant.spec, charts);
    return {
      id: variant.id,
      kind: variant.kind,
      label: variant.label,
      summary: variant.summary,
      src: picture?.src ?? null,
      alt: picture ? `${variant.label}: ${picture.alt}` : `${variant.label}: no drawing for this garment yet`,
      warnings: variant.warnings,
    };
  });
}
