import { z } from "zod";
import { getArtworkRow } from "@/lib/artwork-intake/records";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createDownloadLink } from "@/lib/storage/links";

/**
 * A short-lived link to the small copy of an artwork, which is all a browser is given. The full
 * resolution print copy is read on the server only.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fileLink,
  schema: { params: z.object({ artworkId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const row = await getArtworkRow(client, session.brand.id, input.params.artworkId);
    return createDownloadLink(client, session.brand.id, row.screen_file_id);
  },
});
