import type { ModelChoice } from "@/lib/providers/select";
import type { UsageMeter } from "@/lib/usage/meter";
import { meteredWriter, writerFor, type MeteredWriter } from "./metered";
import { writeForMe } from "./write";

/**
 * THE ONE PIECE THE WIRING STEP NEEDS (plan v5 L4, decision 0094).
 *
 * "Write for me" is a model, a meter and who is asking. The model comes from the platform's own
 * choice of models (`lib/providers/select.ts`), the meter from the server's own deps, and this
 * function is the five lines that put them together -- so the route or action that wires the panel
 * holds no rules of its own and cannot forget to pay.
 *
 * **It answers null when no key is set**, which is what makes the panel honest: the assistant then
 * says it is not connected rather than failing on a press. Nothing here reads the environment; the
 * choice is handed in, so this is testable without one.
 */

export type Who = Readonly<{ brandId: string; userId: string }>;

/** The route the spend is recorded against, as every other metered call records one. */
export const WRITE_ROUTE = "POST /api/marketing/write";

/**
 * The writer, or null when the configured model has no key. The primary model is used; there is no
 * retry on a stronger one, because a marketing line is not worth a second paid call -- the panel
 * offers "Write for me" again instead.
 */
export function writerFrom(choice: ModelChoice, meter: UsageMeter, who: Who, route: string = WRITE_ROUTE): MeteredWriter | null {
  if (choice.primary === null) return null;
  return meteredWriter(writerFor(choice.primary.provider, writeForMe), meter, who, choice.primary.entry, route);
}
