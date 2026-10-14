import { z } from "zod";
import { printFileSpecSchema, printProfileSchema } from "@/lib/production/contract";

/** What the print, fabric and pattern parts say today. The design version and team list come from the server. */
const settings = {
  orderId: z.uuid().nullable().optional(),
  patternBlockId: z.string().trim().min(1).max(120),
  patternBlockVersion: z.number().int().min(1).max(100_000),
  fabricTestIds: z.array(z.string().trim().min(1).max(64)).max(50),
  printProfile: printProfileSchema,
};

export const releaseBody = z.object({
  label: z.string().trim().min(1, "Give the release a label.").max(120),
  ...settings,
  files: z.array(printFileSpecSchema).min(1, "A release needs at least one print file.").max(5000),
});
export type ReleaseBody = z.output<typeof releaseBody>;

export const reorderBody = z.object(settings);
export type ReorderBody = z.output<typeof reorderBody>;
