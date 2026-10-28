import { z } from "zod";

const FABRIC_VALUE_SOURCES = ["fabric-test", "supplier-sheet", "suggested", "not-set"] as const;

/** One number about a fabric and where it came from. `value` is null exactly when it is not set. */
export const fabricValueSchema = z
  .object({
    value: z.number().finite().min(0).max(100_000).nullable(),
    source: z.enum(FABRIC_VALUE_SOURCES),
    /** The fabric test it came from, when the source is a test. */
    testId: z.string().min(1).max(64).optional(),
  })
  .refine((v) => (v.source === "not-set") === (v.value === null), {
    message: "A fabric value is empty exactly when it is not set.",
  })
  .refine((v) => v.testId === undefined || v.source === "fabric-test", {
    message: "Only a fabric test has a test id.",
  });
export type FabricValue = z.output<typeof fabricValueSchema>;

export const fabricProfileSchema = z.object({
  /** Percentages. */
  stretchLengthPct: fabricValueSchema,
  stretchWidthPct: fabricValueSchema,
  recoveryPct: fabricValueSchema,
  shrinkLengthPct: fabricValueSchema,
  shrinkWidthPct: fabricValueSchema,
  gsm: fabricValueSchema,
  /** Usable width between the edges, in millimetres. */
  usableWidthMm: fabricValueSchema,
});
export type FabricProfile = z.output<typeof fabricProfileSchema>;

export const NOT_SCALED_FOR_SHRINK = "Not scaled for shrink: this fabric has no shrink test.";

export type PrintScale = Readonly<{
  length: number;
  width: number;
  /** True when the scale is 1 because no tested shrink was given. */
  notScaled: boolean;
  /** The sentence for a file's margin when it is not scaled, else null. */
  note: string | null;
}>;

/**
 * Only a test or a supplier's sheet may scale artwork. A suggestion or an empty value may not.
 * A shrink of 100 % or more cannot be real and would divide by zero, so it does not scale either.
 */
const usable = (v: FabricValue): v is FabricValue & { value: number } =>
  v.value !== null && v.value < 100 && (v.source === "fabric-test" || v.source === "supplier-sheet");

const axisScale = (shrinkPct: number): number => 1 / (1 - shrinkPct / 100);

/**
 * How much larger artwork is printed so the fabric shrinks back to size: 1 / (1 - s) on each
 * axis. If either axis has no tested value, the artwork is not scaled on that axis and the
 * result says so.
 */
export function printScale(shrink: Pick<FabricProfile, "shrinkLengthPct" | "shrinkWidthPct">): PrintScale {
  const { shrinkLengthPct, shrinkWidthPct } = shrink;
  const length = usable(shrinkLengthPct) ? axisScale(shrinkLengthPct.value) : 1;
  const width = usable(shrinkWidthPct) ? axisScale(shrinkWidthPct.value) : 1;
  const notScaled = !usable(shrinkLengthPct) || !usable(shrinkWidthPct);
  return { length, width, notScaled, note: notScaled ? NOT_SCALED_FOR_SHRINK : null };
}
