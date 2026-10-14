import { z } from "zod";

export const rosterRowSchema = z.object({
  /** Empty when the design has no name place. */
  name: z.string().max(40),
  /** Digits as printed, so "07" and "7" stay different. */
  number: z.string().regex(/^[0-9]{1,3}$/),
  sizeLabel: z.string().min(1).max(16),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  quantity: z.number().int().min(1).max(999),
});
export type RosterRow = z.output<typeof rosterRowSchema>;

export const teamOrderSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string().min(1).max(120),
  rows: z.array(rosterRowSchema).min(1).max(1000),
});
export type TeamOrder = z.output<typeof teamOrderSchema>;
