import { z } from "zod";

/** What the garment inspector's read takes (plan v6 E3, decision 0147). Ids and codes only; the brand is the session's. */

const code = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const readGarmentInspectorSchema = z.object({
  designId: z.uuid(),
  colourwayId: code.optional(),
  options: z
    .record(code, code)
    .refine((options) => Object.keys(options).length <= 32, { message: "Too many options." })
    .optional(),
});

export const NO_DESIGN = "This design could not be opened. It may have been removed.";
