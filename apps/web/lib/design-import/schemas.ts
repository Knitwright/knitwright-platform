import { z } from "zod";
import { viewIdSchema } from "@/lib/artwork-stack";
import { landmarkIdSchema } from "@/lib/production/contract";

/** What a person sends. The brand and the person always come from the session. */
export const startImportSchema = z.object({
  projectId: z.uuid(),
  /** A picture the person uploaded through /api/files. */
  fileId: z.uuid(),
  /** The pattern size the landmarks are placed in. */
  size: z.string().trim().min(1).max(16).default("M"),
});

export const refitSchema = z.object({
  view: viewIdSchema,
  /** Landmarks the person dragged, in pixels of the analysed picture. */
  edits: z
    .array(z.object({ id: landmarkIdSchema, side: z.enum(["left", "centre", "right"]), x: z.number().finite().min(0).max(4096), y: z.number().finite().min(0).max(4096) }))
    .min(1)
    .max(30),
});

/** Layer ids to accept. Left out, every layer is accepted. */
export const acceptSchema = z.object({ layerIds: z.array(z.string().min(1).max(80)).max(64).optional() });

export const importIdParams = z.object({ importId: z.uuid() });
