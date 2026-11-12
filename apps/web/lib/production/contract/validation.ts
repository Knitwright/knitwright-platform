import { z } from "zod";
import { READINESS_ACTORS } from "./readiness";

/**
 * The states of a design version (spec F-0: draft -> validated -> approved -> ordered). "validated" only means: no
 * blockers against one factory profile on one date; "approved" means the brand accepted that version for ordering.
 * The same four, in the same order, as `VERSION_STATUSES` in `lib/validation/status.ts` and the database's
 * `design_statuses_status_check` (migration 20261101030000); `validation.test.ts` holds all three together.
 */
export const DESIGN_STATUSES = ["draft", "validated", "approved", "ordered"] as const;
export const designStatusSchema = z.enum(DESIGN_STATUSES);
export type DesignStatus = z.output<typeof designStatusSchema>;

const FINDING_SEVERITIES = ["blocker", "warning"] as const;

/** One thing a person should look at before a design is ordered. */
export const findingSchema = z.object({
  /** A stable kebab-case code, such as "article-not-made". */
  code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  severity: z.enum(FINDING_SEVERITIES),
  /** The garment type the finding is about, or null for the whole design. */
  article: z.string().max(64).nullable(),
  /** The panel the finding is about, or null. */
  panel: z.string().max(64).nullable(),
  /** Plain words. */
  message: z.string().min(1).max(300),
  /** What to do, and who does it. */
  fix: z.object({ action: z.string().min(1).max(300), whoActs: z.enum(READINESS_ACTORS) }),
});
export type Finding = z.output<typeof findingSchema>;
