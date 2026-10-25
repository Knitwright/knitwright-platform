import { z } from "zod";
import { STAGES } from "./stage";

export const productBody = z.object({
  projectId: z.uuid("Choose a design."),
  name: z.string().trim().min(1, "Name the product.").max(80),
});
export type ProductBody = z.output<typeof productBody>;

export const stageBody = z.object({
  productId: z.uuid(),
  to: z.enum(STAGES),
});

/** A quantity as typed: a number or text from a form field. Checked again by checkBreakdown. */
const quantity = z.union([z.number(), z.string().max(8)]);

export const runBody = z.object({
  productId: z.uuid(),
  kind: z.enum(["sample", "run"]),
  releaseId: z.uuid("Choose the frozen release to make."),
  fabricKey: z.string().trim().min(1, "Name the fabric.").max(120),
  quantities: z.record(z.string().min(1).max(16), quantity).refine((q) => Object.keys(q).length <= 40, "A breakdown can hold at most 40 sizes."),
  /** The brand read the flags and went ahead. Without it a flagged run is not sent. */
  acknowledgeFlags: z.boolean().default(false),
  /** Made once per form, so a double press is one order. */
  requestKey: z.string().min(8).max(64),
});
export type RunBody = z.output<typeof runBody>;
