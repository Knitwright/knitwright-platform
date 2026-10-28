import { z } from "zod";
import { ROSTER_PLAYERS_MAX } from "../wording";

/** The earlier order to reorder, and where the roster comes from: a season's saved sizes, or the earlier order's own list. */
export const previewBody = z.object({
  releaseId: z.uuid(),
  seasonId: z.uuid().optional(),
});
export type PreviewBody = z.output<typeof previewBody>;

const resolutionSchema = z
  .object({
    index: z.number().int().min(0).max(ROSTER_PLAYERS_MAX * 2),
    action: z.enum(["keep", "leave-out"]).optional(),
    sizeLabel: z.string().trim().min(1).max(16).optional(),
    number: z.string().trim().regex(/^[0-9]{1,3}$/, "A number is 1 to 3 digits.").optional(),
  })
  .strict();

export const confirmBody = previewBody.extend({
  /** The plan the person looked at. If the roster changed since, the reorder asks them to start again. */
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  resolutions: z.array(resolutionSchema).max(ROSTER_PLAYERS_MAX * 2).default([]),
});
export type ConfirmBody = z.output<typeof confirmBody>;
