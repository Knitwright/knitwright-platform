import { z } from "zod";
import { pointMmSchema, roundMm, type PointMm } from "./units";

/**
 * Where every repeat on a view is anchored. One datum per view, in design space, not one per piece,
 * so rows meet at side seams and shoulder seams (plan W3). The chest line is the underarm height at
 * the centre front and centre back. A stack may move it with an offset.
 */
export const datumSchema = z.object({ anchor: z.literal("chest-line"), offsetMm: pointMmSchema }).readonly();
type Datum = z.output<typeof datumSchema>;

export const DEFAULT_DATUM: Datum = Object.freeze({ anchor: "chest-line", offsetMm: Object.freeze({ x: 0, y: 0 }) });

/** The datum as a point: centre line x = 0, y at the underarm when the view has one, plus the offset. */
export function resolveDatum(datum: Datum, underarm: PointMm | undefined): PointMm {
  return { x: roundMm(datum.offsetMm.x), y: roundMm((underarm?.y ?? 0) + datum.offsetMm.y) };
}
