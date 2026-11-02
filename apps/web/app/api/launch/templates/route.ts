import { z } from "zod";
import { loadPanelTemplates, templatesView } from "@/lib/launch-panels/templates";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The template library of the launch rail, searched and filtered with L8's own functions
 * (decision 0108). Platform data: the same rows for every brand, read through the member's own
 * client so the database's rules decide as well as this code.
 *
 * The search and the five filters run here rather than in the browser because `matchesTags`,
 * `matchesSearch` and `TAG_CHOICES` reach zod through `lib/garment`, and a client component may
 * not (`tests/architecture/client-weight.test.ts`). Writing a second filter for the browser was
 * the alternative, and two filters that can disagree is worse than one round trip.
 */

/** One value, whether the address named it once or twice. A value too long is simply refused. */
const choice = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((given) => (Array.isArray(given) ? given[0] : given))
  .pipe(z.string().trim().max(64).optional());

const query = z.object({
  q: choice,
  sport: choice,
  style: choice,
  era: choice,
  mood: choice,
  colour: choice,
});

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { query },
  handler: async ({ input }) => {
    const { q, ...groups } = input.query;
    // A group the address left out, or left blank, narrows nothing.
    const tags = Object.fromEntries(Object.entries(groups).filter(([, value]) => value !== undefined && value !== ""));
    return templatesView(await loadPanelTemplates(await sessionClient()), { text: q ?? "", tags });
  },
});
