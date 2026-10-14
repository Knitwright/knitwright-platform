import { z } from "zod";
import { VIEW_IDS } from "@/lib/artwork-stack";
import { LANDMARK_IDS } from "@/lib/production/contract";

/** What the routes accept. The brand and the user always come from the session, never from the request. */

export const RIGHTS_SENTENCE = "Say that you have the right to use this picture. It is sent to the reading and image providers.";

export const createImportSchema = z
  .object({
    /** A picture the person uploaded through /api/files. */
    fileId: z.uuid(),
    rights: z.literal(true, { error: RIGHTS_SENTENCE }),
  })
  .strict();
export type CreateImportInput = z.output<typeof createImportSchema>;

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();

/** Landmarks the person dragged, as fractions of the picture. */
export const landmarkEditsSchema = z
  .partialRecord(z.enum(VIEW_IDS), z.partialRecord(z.enum(LANDMARK_IDS), point))
  .refine((edits) => Object.values(edits).reduce((n, view) => n + Object.keys(view ?? {}).length, 0) <= 40, { message: "Too many landmarks were moved." });

export const refitSchema = z.object({ edits: landmarkEditsSchema }).strict();

export const acceptSchema = z
  .object({ layerIds: z.union([z.literal("all"), z.array(z.string().min(1).max(64)).min(1).max(64)]) })
  .strict();
export type AcceptInput = z.output<typeof acceptSchema>;

export const importIdParams = z.object({ importId: z.uuid() });
