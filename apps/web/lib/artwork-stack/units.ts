import { z } from "zod";

/** A point on a view's flat-lay plane, in millimetres. The x axis runs right and the y axis runs down, as in a flat. */
export const pointMmSchema = z.object({ x: z.number().finite().min(-5000).max(5000), y: z.number().finite().min(-5000).max(5000) }).readonly();
export type PointMm = z.output<typeof pointMmSchema>;

/** The most a layer may be moved or sized, in millimetres. A sanity limit, not a garment size. */
export const MM_LIMIT = 5000;

export const lengthMmSchema = z.number().finite().gt(0).max(MM_LIMIT);

/** Millimetres rounded to 0.01 mm, so a drawing is the same on any machine. */
export const roundMm = (value: number): number => Math.round(value * 100) / 100 + 0;

/** A flat measures in tenths of a millimetre. */
export const mmFromTenths = (tenths: number): number => roundMm(tenths / 10);
export const tenthsFromMm = (mm: number): number => Math.round(mm * 10) + 0;

export interface BoundsMm {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
