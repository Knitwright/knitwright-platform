import { z } from "zod";
import { checkArtworkTile } from "@/lib/artwork-intake/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Whether a picture repeats cleanly when laid side by side: a plain verdict and the mismatch where its edges meet. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkConvert,
  schema: { params: z.object({ artworkId: z.uuid() }) },
  handler: async ({ input, session }) =>
    checkArtworkTile(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.artworkId),
});
