import { z } from "zod";
import { manifestQuery } from "@/lib/orders/schemas";
import { manifestFile } from "@/lib/orders/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Building a PDF costs a second or two of a small function (decision 0002). */
export const maxDuration = 60;

/**
 * The team order's manifest, as a CSV or PDF, or the plain list that the import reads back. Built
 * when asked for and sent once; nothing is stored. Names are made safe for each kind of file.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.export,
  schema: { params: z.object({ projectId: z.uuid(), orderId: z.uuid() }), query: manifestQuery },
  handler: async ({ input, session }) => {
    const file = await manifestFile(await sessionClient(), session.brand.id, input.params.projectId, input.params.orderId, input.query.format);
    const bytes = typeof file.body === "string" ? new TextEncoder().encode(file.body) : file.body;
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${file.fileName}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-length": String(bytes.byteLength),
      },
    });
  },
});
