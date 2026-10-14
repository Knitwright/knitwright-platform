import { z } from "zod";
import { dpiCheck } from "@/lib/artwork-intake/effective-dpi";
import { removeArtwork } from "@/lib/artwork-intake/intake";
import { getArtworkRow, summaryOf } from "@/lib/artwork-intake/records";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * One artwork. With `widthMm`, also how sharp it would print at that width: the dpi to the nearest
 * whole number, the widest it can print and still meet the minimum, and the plain warning when it cannot.
 * A vector has no resolution and never warns.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {
    params: z.object({ artworkId: z.uuid() }),
    query: z.object({ widthMm: z.coerce.number().positive().max(5000).optional() }),
  },
  handler: async ({ input, session }) => {
    const row = await getArtworkRow(await sessionClient(), session.brand.id, input.params.artworkId);
    const widthMm = input.query.widthMm;
    return {
      artwork: summaryOf(row),
      resolution: widthMm === undefined ? null : dpiCheck({ kind: row.kind, widthPx: row.width_px, dpiMeta: row.dpi_meta }, widthMm),
    };
  },
});

/** Removes the artwork and its stored files. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkConvert,
  schema: { params: z.object({ artworkId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const row = await getArtworkRow(adminClient(), session.brand.id, input.params.artworkId);
    await removeArtwork(adminClient(), session.brand.id, row);
    return { removed: true };
  },
});
