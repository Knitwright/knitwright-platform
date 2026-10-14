import { z } from "zod";
import { fabricInputSchema } from "@/lib/fabrics/schemas";
import { updateFabric } from "@/lib/fabrics/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Changes a fabric's name, notes and what its supplier's sheet states. Tested numbers are not touched. */
export const PATCH = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: { params: z.object({ fabricId: z.uuid() }), body: fabricInputSchema },
  handler: async ({ input, session }) => {
    await updateFabric(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.fabricId, input.body);
    return { saved: true };
  },
});
