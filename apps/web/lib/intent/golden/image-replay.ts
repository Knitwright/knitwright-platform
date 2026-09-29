import { z } from "zod";
import { resolveImageReading, type ImageOutcome } from "../image-input";
import { startSchema, startSpec } from "./replay";

/**
 * The golden image set and its replay harness (plan step 13, task 5). A case is a picture
 * file in `images/`, the design it is read against, and what it should be read as. The set
 * is empty: the owner draws or photographs the images (A8) and approves the outcomes (A7).
 * Recorded replies are replayed through the same parser the product uses, so CI calls no model.
 */

const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpe?g|webp)$/;

const imageExpectedSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), typeId: z.string(), options: z.record(z.string(), z.string()).optional() }),
  z.strictObject({ kind: z.literal("rejection") }),
]);

const imageCaseSchema = z.strictObject({
  id: z.string(),
  /** A file in the images folder. No paths: a name only. */
  file: z.string().regex(FILE_NAME),
  kind: z.enum(["sketch", "photo"]),
  start: startSchema,
  expected: imageExpectedSchema,
  /** True only when the owner has approved this case (owner action A7). */
  approved: z.boolean(),
  note: z.string().optional(),
});
export type ImageCase = z.output<typeof imageCaseSchema>;

export const imageSetSchema = z.strictObject({
  family: z.string(),
  status: z.enum(["proposed", "approved"]),
  note: z.string(),
  cases: z.array(imageCaseSchema),
});

export const imageRecordingSchema = z.strictObject({
  synthetic: z.boolean(),
  source: z.string(),
  responses: z.record(z.string(), z.union([z.string(), z.json()])),
});

/** Runs one recorded reply through the image parser, exactly as a live reply would be. */
export function replayImageCase(entry: Pick<ImageCase, "start">, reply: unknown): ImageOutcome {
  const raw = typeof reply === "string" ? reply : (JSON.stringify(reply) ?? "");
  return resolveImageReading({ spec: startSpec(entry.start), raw });
}

export interface ImageScore {
  readonly id: string;
  readonly kindCorrect: boolean;
  /** Null when the case expects a rejection. */
  readonly typeCorrect: boolean | null;
  readonly optionsCorrect: boolean | null;
}

export function scoreImageCase(entry: Pick<ImageCase, "id" | "expected">, outcome: ImageOutcome): ImageScore {
  const { expected } = entry;
  if (expected.kind === "rejection") return { id: entry.id, kindCorrect: outcome.kind === "rejection", typeCorrect: null, optionsCorrect: null };
  const scoresOptions = expected.options !== undefined;
  if (outcome.kind !== "proposal") return { id: entry.id, kindCorrect: false, typeCorrect: false, optionsCorrect: scoresOptions ? false : null };
  const optionsRight = Object.entries(expected.options ?? {}).every(([option, choice]) => outcome.spec.options[option]?.choiceId === choice);
  return {
    id: entry.id,
    kindCorrect: true,
    typeCorrect: outcome.spec.typeId === expected.typeId,
    optionsCorrect: scoresOptions ? optionsRight : null,
  };
}

/** Totals for a run: garment type accuracy with option accuracy beside it (plan step 13 acceptance). */
export function summariseImages(scores: readonly ImageScore[]) {
  const count = (test: (score: ImageScore) => boolean): number => scores.filter(test).length;
  return {
    total: scores.length,
    kindCorrect: count((score) => score.kindCorrect),
    typeScored: count((score) => score.typeCorrect !== null),
    typeCorrect: count((score) => score.typeCorrect === true),
    optionsScored: count((score) => score.optionsCorrect !== null),
    optionsCorrect: count((score) => score.optionsCorrect === true),
  };
}
