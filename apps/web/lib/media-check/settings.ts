import { z } from "zod";

/** Every threshold is a setting. None has been tuned on a real generated picture. */
export const THRESHOLDS_NOTE = "Knitwright default, not tested against real generations";

export const thresholdsSchema = z.object({
  /** Largest median CIEDE2000 between reference and generated inside a panel. */
  maxColourDeltaE: z.number().min(1).max(60),
  /** Smallest correlation of the edge maps inside a panel. */
  minStructureCorrelation: z.number().min(-1).max(1),
  /** Smallest normalised cross-correlation of a protected mark. */
  minProtectedCorrelation: z.number().min(-1).max(1),
  /** Largest median CIEDE2000 inside a protected mark. */
  maxProtectedDeltaE: z.number().min(1).max(60),
  /** Smallest overlap (intersection over union) of the two garment masks. */
  minMaskOverlap: z.number().min(0).max(1),
  /** Largest difference between the aspect ratios of the two canvases. */
  maxAspectDifference: z.number().min(0).max(0.5),
});

export type Thresholds = z.infer<typeof thresholdsSchema>;

export const DEFAULT_THRESHOLDS: Thresholds = Object.freeze({
  maxColourDeltaE: 10,
  minStructureCorrelation: 0.8,
  minProtectedCorrelation: 0.8,
  maxProtectedDeltaE: 15,
  minMaskOverlap: 0.85,
  maxAspectDifference: 0.02,
});

/** The defaults with the given overrides on top. Throws a ZodError for a value out of range. */
export function resolveThresholds(overrides: Partial<Thresholds> = {}): Thresholds {
  return thresholdsSchema.parse({ ...DEFAULT_THRESHOLDS, ...overrides });
}
