import { z } from "zod";
import { deleteArtwork, getArtworkDetail } from "@/lib/artwork-intake/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ artworkId: z.uuid() });

/**
 * One artwork. With `widthMm` (the printed width) it also says how sharp the picture would print there and warns
 * when that is under the minimum dpi (`minDpi`, Knitwright's default 150 until a print house sets one).
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {
    params,
    query: z.object({
      widthMm: z.coerce.number().positive().max(5000).optional(),
      minDpi: z.coerce.number().min(1).max(1200).optional(),
    }),
  },
  handler: async ({ input, session }) =>
    getArtworkDetail(adminClient(), session.brand.id, input.params.artworkId, input.query),
});

/** Removes the artwork and every file kept for it. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkConvert,
  schema: { params },
  handler: async ({ input, session }) => {
    await deleteArtwork(adminClient(), session.brand.id, input.params.artworkId);
    return { deleted: true };
  },
});
