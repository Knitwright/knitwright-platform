import { z } from "zod";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { applyVariant, listVariants } from "@/lib/variants/service";

export const maxDuration = 60;

const params = z.object({ projectId: z.uuid() });
const body = z.object({ variantId: z.string().regex(/^v-[0-9a-f]{8}$/), expectedVersion: z.number().int().min(1).max(2147483647) }).strict();

/** The 8 to 12 alternatives for the current version of a design, drawn by the flat renderer. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => listVariants(await sessionClient(), { brandId: session.brand.id, brandName: session.brand.name }, input.params.projectId),
});

/** Applies one alternative as a new version. The server works out the changes from the id; the browser sends no changes. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: { params, body },
  handler: async ({ input, session }) =>
    applyVariant(
      { client: await sessionClient(), admin: adminClient() },
      { brandId: session.brand.id, brandName: session.brand.name, userId: session.userId },
      { projectId: input.params.projectId, ...input.body },
    ),
});
