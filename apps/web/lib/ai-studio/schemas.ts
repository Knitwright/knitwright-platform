import { z } from "zod";
import { ERAS } from "./remix";

/** The bodies of the AI Studio actions (decision 0141). Answers are checked again against the form. */

const slug = z.string().regex(/^[a-z0-9-]{1,64}$/);
const swatch = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Pick a colour.");

export const startWorkflowBody = z.object({
  workflowId: slug,
  projectId: z.uuid("Choose a product."),
  answers: z.record(z.string().min(1).max(32), z.string().max(400)).default({}),
  count: z.number().int().min(1).max(4).default(1),
});

export const remixBody = z.object({ projectId: z.uuid("Choose a product."), era: z.enum(ERAS, "Pick an era."), family: slug });

export const recolourBody = z.object({ projectId: z.uuid("Choose a product."), main: swatch, second: swatch.nullable().default(null) });

export const applyVariantBody = z.discriminatedUnion("kind", [
  remixBody.extend({ kind: z.literal("remix"), expectedVersion: z.number().int().min(1), variantId: z.string().regex(/^v-[0-9a-f]{8}$/) }),
  recolourBody.extend({ kind: z.literal("recolour"), expectedVersion: z.number().int().min(1), variantId: z.string().regex(/^v-[0-9a-f]{8}$/) }),
]);
export type ApplyVariantBody = z.output<typeof applyVariantBody>;
