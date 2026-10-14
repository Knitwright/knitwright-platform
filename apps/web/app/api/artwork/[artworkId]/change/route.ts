import { z } from "zod";
import { changeArtwork } from "@/lib/artwork-intake/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove-white-background") }),
  z.object({ action: z.literal("make-seamless"), method: z.enum(["blend", "mirror"]) }),
]);

/**
 * Shows what a change to a picture would do (the white box removed, or the tile made seamless), and with
 * `accept: true` stores the changed picture as a new artwork. The original is never changed.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkConvert,
  schema: {
    params: z.object({ artworkId: z.uuid() }),
    body: z.object({ change, accept: z.boolean().default(false) }),
  },
  handler: async ({ input, session }) =>
    changeArtwork(
      adminClient(),
      { brandId: session.brand.id, userId: session.userId },
      input.params.artworkId,
      input.body.change,
      input.body.accept,
    ),
});
