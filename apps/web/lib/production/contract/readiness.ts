import { z } from "zod";

export const READINESS_ACTORS = ["owner", "technician", "print-house", "factory", "club"] as const;

/** One line of the "Ready for the factory" list. */
export const readinessItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  met: z.boolean(),
  /** One plain sentence. */
  sentence: z.string().min(1).max(300),
  /** Who has to act while it is not met. */
  whoActs: z.enum(READINESS_ACTORS),
});
export type ReadinessItem = z.output<typeof readinessItemSchema>;
