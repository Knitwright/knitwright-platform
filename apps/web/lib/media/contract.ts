import { z } from "zod";

/**
 * The contract of a media set (plan v4, W3-A, decision 0054). Studio renders implement it now; lifestyle images, the
 * turntable and the clip (stage 2) add `MediaGenerator`s and change nothing here.
 */

export const MEDIA_KINDS = ["studio_render", "lifestyle", "turntable", "clip"] as const;
export const MEDIA_VIEWS = ["front", "back", "flat_lay", "three_quarter", "on_model", "scene"] as const;
/** What the generated-image checker (W3-C) said. A studio render is drawn from the design, so it is not checked. */
export const CHECKER_VERDICTS = ["pending", "passed", "rejected", "not_checked"] as const;
export const SET_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

export const mediaKindSchema = z.enum(MEDIA_KINDS);
export const mediaViewSchema = z.enum(MEDIA_VIEWS);
export const checkerVerdictSchema = z.enum(CHECKER_VERDICTS);
export const setStatusSchema = z.enum(SET_STATUSES);

export type MediaKind = z.infer<typeof mediaKindSchema>;
export type MediaView = z.infer<typeof mediaViewSchema>;
export type CheckerVerdict = z.infer<typeof checkerVerdictSchema>;
export type SetStatus = z.infer<typeof setStatusSchema>;

export const mediaItemSchema = z.strictObject({
  id: z.uuid(),
  kind: mediaKindSchema,
  view: mediaViewSchema,
  /** The watermarked picture, an ordinary file of the brand. */
  fileId: z.uuid().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  /** True while only the watermarked picture is served, that is until the set is unlocked. */
  watermarked: z.boolean(),
  checker: checkerVerdictSchema,
  provider: z.string().min(1).max(80),
  costMicrodollars: z.number().int().nonnegative(),
});

export type MediaItem = z.infer<typeof mediaItemSchema>;

export const mediaSetSchema = z.strictObject({
  id: z.uuid(),
  projectId: z.uuid(),
  version: z.number().int().positive(),
  versionHash: z.string().min(1),
  status: setStatusSchema,
  /** A sentence safe to show, when the set failed. */
  error: z.string().nullable(),
  items: z.array(mediaItemSchema),
});

export type MediaSet = z.infer<typeof mediaSetSchema>;

/** What a generator is asked to make: the design as it was saved, never free text from a person. */
export type GenerateRequest = Readonly<{
  /** Fetches whatever the generator needs from the design. Stage 2 generators add their own inputs here. */
  design: Readonly<{ projectId: string; version: number }>;
}>;

/** One picture a generator made. `png` is the clean file; the set watermarks it before anyone is shown it. */
export type GeneratedMedia = Readonly<{
  kind: MediaKind;
  view: MediaView;
  png: Uint8Array;
  width: number;
  height: number;
  checker: CheckerVerdict;
  provider: string;
  costMicrodollars: number;
}>;

/** What a generator gives back. A failed generator says so in a sentence safe to show. */
export type GeneratorResult =
  | Readonly<{ ok: true; media: readonly GeneratedMedia[] }>
  | Readonly<{ ok: false; message: string }>;

/** Stage 2 implements this: lifestyle (B), turntable and clip (D). The studio renderer implements it now. */
export interface MediaGenerator {
  readonly name: string;
  generate(request: GenerateRequest, signal: AbortSignal): Promise<GeneratorResult>;
}

/** A provider behind a generator: a paid model, or a stub. Never called from tests except as a stub. */
export interface MediaProvider {
  readonly name: string;
  /** Per call, in millionths of a dollar. Zero for a stub and for the studio renderer. */
  readonly costMicrodollars: number;
}
