import { z } from "zod";
import { DOWNLOAD_LIMIT } from "@/lib/mockups/gallery/cards";
import { downloadMockups } from "@/lib/mockups/gallery/server";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The Mockups page's Download and Download selected (decision 0140): one of the brand's designs on
 * the free scenes asked for, as one PNG or a zip of several. Drawn now by the mockup renderer, free
 * and deterministic; the design is read through the member's own client, so another brand's design
 * is a design that does not exist.
 */

const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);

const query = z.object({
  design: z.uuid(),
  colourway: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  scene: z
    .union([slug, z.array(slug)])
    .transform((given) => (Array.isArray(given) ? given : [given]))
    .pipe(z.array(slug).min(1).max(DOWNLOAD_LIMIT)),
});

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.export,
  schema: { query },
  handler: async ({ input, session }) => {
    const file = await downloadMockups(await sessionClient(), session.brand.id, {
      designId: input.query.design,
      colourwayId: input.query.colourway ?? null,
      slugs: input.query.scene,
    });
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.type,
        "content-disposition": `attachment; filename="${file.name}"`,
        "cache-control": "no-store",
      },
    });
  },
});
