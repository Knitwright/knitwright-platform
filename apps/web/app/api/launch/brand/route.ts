import { brandView } from "@/lib/launch-panels/brand";
import { loadBrand } from "@/lib/brand-studio/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The brand's palettes, type styles and voice for the launch rail's Brand panel (decision 0108).
 *
 * It reads Y6's own Brand Studio rows through Y6's own `loadBrand`, and the rows it hands over are
 * built by Y6's `brandTabColours` and `brandTabFonts`, so the sublimation estimate and every
 * licence note are worked out in one place. The brand comes from the session.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    const { record, kitFonts } = await loadBrand(await sessionClient(), session.brand);
    return brandView(record, kitFonts);
  },
});
