import { z } from "zod";
import { RATING_MAX, RATING_MIN, SAMPLE_MAX_SIZES } from "./vocabulary";

/**
 * What the make pages may send (plan v5 Y7, decision 0080). The brand and the person are never in a body: they
 * come from the session. Nothing here carries a price, a currency as money, or a payment of any kind: the
 * platform takes none (owner decision 1).
 */

const sizeLabel = z.string().trim().min(1).max(16);
const requestKey = z.string().min(8).max(64);
const ruleId = z.string().regex(/^R-[A-Z]{2,5}-\d{3}$/, "Use a rule id such as R-GAP-000.");
const mm = z.number().int().min(0).max(100_000);
const tolerance = z.number().int().min(0).max(1000).nullable();
const lab = z.tuple([z.number(), z.number(), z.number()]).nullable();
const words = (max: number) => z.string().trim().max(max);

export const PHOTO_ANGLES = ["front", "back", "left", "right", "detail", "label"] as const;

export const sampleBody = z.object({
  projectId: z.uuid(),
  productId: z.uuid(),
  releaseId: z.uuid(),
  fabricKey: z.string().trim().min(1).max(120),
  sizes: z.array(sizeLabel).min(1).max(SAMPLE_MAX_SIZES),
  requestKey,
});
export type SampleBody = z.output<typeof sampleBody>;

export const runBody = z.object({
  projectId: z.uuid(),
  productId: z.uuid(),
  releaseId: z.uuid(),
  fabricKey: z.string().trim().min(1).max(120),
  /** Pieces per size, as typed. The rules in `run.ts` read them. */
  quantities: z.record(sizeLabel, z.string().max(8)),
  requestKey,
});
export type RunBody = z.output<typeof runBody>;

/** The order modal: one line per product and size, handed over product by product. */
export const selectSizesBody = z.object({
  lines: z
    .array(z.object({ productId: z.uuid(), size: sizeLabel, pieces: z.number().int().min(1).max(99_999) }))
    .min(1)
    .max(200),
  requestKey,
});
export type SelectSizesBody = z.output<typeof selectSizesBody>;

export const startGoldenSampleBody = z.object({ projectId: z.uuid(), productId: z.uuid(), runId: z.uuid() });

export const goldenSamplePhotoBody = z.object({
  projectId: z.uuid(),
  goldenSampleId: z.uuid(),
  fileId: z.uuid(),
  angle: z.enum(PHOTO_ANGLES),
  caption: words(200).default(""),
});

export const goldenSamplePomBody = z.object({
  projectId: z.uuid(),
  goldenSampleId: z.uuid(),
  sizeLabel,
  letter: z.string().trim().regex(/^[A-Za-z]{1,2}$/, "A point of measure is lettered A to Z."),
  code: z.string().trim().min(1).max(64),
  description: words(200).default(""),
  measuredMm: mm,
  targetMm: mm.nullable().default(null),
  tolMinusMm: tolerance.default(null),
  tolPlusMm: tolerance.default(null),
  ruleId: ruleId.default("R-GAP-000"),
});

export const goldenSampleReadingBody = z.object({
  projectId: z.uuid(),
  goldenSampleId: z.uuid(),
  colourName: z.string().trim().min(1).max(60),
  /** A Delta-E reading, as the person measuring it stated it. Not money: an exact decimal in the database. */
  deltaE: z.number().min(0).max(200),
  targetHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  targetLab: lab.default(null),
  measuredLab: lab.default(null),
  instrument: words(120).nullable().default(null),
  whitePoint: words(40).nullable().default(null),
  observer: words(40).nullable().default(null),
  ruleId: ruleId.default("R-GAP-000"),
});

export const signOffBody = z.object({
  projectId: z.uuid(),
  goldenSampleId: z.uuid(),
  fitRating: z.number().int().min(RATING_MIN).max(RATING_MAX),
  colourRating: z.number().int().min(RATING_MIN).max(RATING_MAX),
  notes: words(2000).default(""),
});

export const changesBody = z.object({
  projectId: z.uuid(),
  goldenSampleId: z.uuid(),
  notes: z.string().trim().min(1, "Say what has to change.").max(2000),
});
