import { SWATCH_PATTERN, type Colourway, type GarmentSpec } from "@/lib/garment";

/** Panels with no swatch are drawn in this light grey. */
export const NEUTRAL_FILL = "#e5e7eb";
export const OUTLINE_COLOUR = "#1f2933";
export const SEAM_COLOUR = "#4b5563";
export const STITCH_COLOUR = "#6b7280";
export const DETAIL_COLOUR = "#374151";
export const TEXT_COLOUR = "#111827";
export const CALLOUT_COLOUR = "#b45309";

/** A colour only when it is written `#rrggbb`. Nothing else is ever drawn or written into a file. */
export const safeColour = (value: unknown): string | null =>
  typeof value === "string" && SWATCH_PATTERN.test(value) ? value : null;

/** The colourway asked for, or the first one when there is no such colourway. */
export const colourwayFor = (spec: Pick<GarmentSpec, "colourways">, colourwayId: string): Colourway =>
  spec.colourways.find((colourway) => colourway.id === colourwayId) ?? spec.colourways[0];

/** The colour to fill a panel with. */
export function panelFill(spec: Pick<GarmentSpec, "colourways">, colourwayId: string, panelId: string): string {
  const entry = colourwayFor(spec, colourwayId).colours.find((colour) => colour.panelId === panelId);
  return safeColour(entry?.swatch) ?? NEUTRAL_FILL;
}
