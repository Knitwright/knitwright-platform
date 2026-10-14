import { z } from "zod";
import { importBody } from "@/lib/orders/schemas";
import { previewImport } from "@/lib/orders/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * Reads a team list from CSV text and checks it against the design. Nothing is saved: the person
 * looks at the rows and the problems first, then saves the order.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.rosterImport,
  maxBodyBytes: 300_000,
  schema: { params: z.object({ projectId: z.uuid() }), body: importBody },
  handler: async ({ input, session }) => previewImport(await sessionClient(), session.brand.id, input.params.projectId, input.body),
});
