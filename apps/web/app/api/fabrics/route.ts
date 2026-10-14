import { loadFabricLibrary } from "@/lib/fabrics/library";
import { fabricInputSchema } from "@/lib/fabrics/schemas";
import { createFabric } from "@/lib/fabrics/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's fabric library: fabrics with their tested numbers, and the size label map. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) =>
    loadFabricLibrary(await sessionClient(), adminClient(), { brandId: session.brand.id, userId: session.userId }),
});

/** Adds a fabric to the brand's library. Tested numbers are added later, as fabric tests. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: { body: fabricInputSchema },
  handler: async ({ input, session }) => ({
    id: await createFabric(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body),
  }),
});
