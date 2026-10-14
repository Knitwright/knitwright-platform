import { z } from "zod";
import { rosterRowSchema } from "@/lib/production/contract";
import { ROSTER_ROWS_MAX } from "./import-csv";
import { cleanName } from "./text";

/** A name as typed. It is cleaned and limited to printable characters before it is kept. */
const nameField = z
  .string()
  .max(200)
  .transform((raw, ctx) => {
    const cleaned = cleanName(raw);
    if (cleaned.ok) return cleaned.name;
    ctx.addIssue({ code: "custom", message: cleaned.message });
    return z.NEVER;
  });

export const rosterRowInput = rosterRowSchema.extend({
  name: nameField,
  number: z.string().trim().regex(/^[0-9]{1,3}$/, "A number is 1 to 3 digits."),
  sizeLabel: z.string().trim().min(1, "Choose a size.").max(16),
});

export const orderBody = z.object({
  name: z.string().trim().min(1, "Name the team order.").max(120),
  rows: z.array(rosterRowInput).min(1, "Add at least one player.").max(ROSTER_ROWS_MAX),
});
export type OrderBody = z.output<typeof orderBody>;

export const importBody = z.object({
  csv: z.string().min(1).max(250_000),
  header: z.boolean().optional(),
  defaultCut: rosterRowSchema.shape.cut.optional(),
  mapping: z
    .object({
      name: z.number().int().min(0).max(50),
      number: z.number().int().min(0).max(50),
      sizeLabel: z.number().int().min(0).max(50),
      cut: z.number().int().min(0).max(50),
      quantity: z.number().int().min(0).max(50),
    })
    .partial()
    .optional(),
});

export type ImportBody = z.output<typeof importBody>;

export const manifestQuery = z.object({ format: z.enum(["csv", "pdf", "roster"]) });
