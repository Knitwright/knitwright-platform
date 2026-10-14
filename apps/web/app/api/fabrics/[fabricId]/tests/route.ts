import { z } from "zod";
import { fabricTestInputSchema } from "@/lib/fabrics/schemas";
import { addFabricTest } from "@/lib/fabrics/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Records a fabric test: who ran it, when, how, and what it found. A test is never changed afterwards. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: { params: z.object({ fabricId: z.uuid() }), body: fabricTestInputSchema },
  handler: async ({ input, session }) => ({
    id: await addFabricTest(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.fabricId, input.body),
  }),
});
