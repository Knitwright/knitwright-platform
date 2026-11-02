import { z } from "zod";
import { correctionSchema } from "./corrections";
import { MAX_REVIEW_CHARS } from "./service";

/**
 * What the benchmark screens may send (plan v5 Z3, spec F-S2). The brand and the person always come from the session,
 * never from a body. A URL arrives as the person typed it and is normalised and checked on the server
 * (lib/benchmarks/fetch.ts); pasted review text arrives whole, is read once and is never stored.
 */

const title = z.string().trim().min(1).max(120);

export const newBenchmarkSchema = z.object({
  title,
  /** The design this comparison is for, when it is opened from one. */
  projectId: z.union([z.uuid(), z.literal("")]).optional(),
});

export const addUrlSchema = z.object({
  benchmarkId: z.uuid(),
  url: z.string().trim().min(8).max(2048),
});

export const addReviewTextSchema = z.object({
  benchmarkId: z.uuid(),
  text: z.string().trim().min(40).max(MAX_REVIEW_CHARS),
});

export const addPhotoSchema = z.object({
  benchmarkId: z.uuid(),
  /** A file already uploaded to the brand's own files, through the existing upload route. */
  fileId: z.uuid(),
});

export const confirmCardSchema = z
  .object({ benchmarkId: z.uuid(), cardId: z.uuid() })
  .and(correctionSchema);

export const removeCardSchema = z.object({ benchmarkId: z.uuid(), cardId: z.uuid() });

export type NewBenchmarkInput = z.output<typeof newBenchmarkSchema>;
export type AddUrlInput = z.output<typeof addUrlSchema>;
export type ConfirmCardInput = z.output<typeof confirmCardSchema>;
