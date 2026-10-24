import { z } from "zod";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { readinessFor } from "@/lib/validation/design-input";
import { moveStatus, reportFor } from "@/lib/validation/use-cases";

const params = z.object({ projectId: z.uuid() });
const body = z.object({ to: z.enum(["validated", "draft"]) }).strict();

/** The "Factory file" readiness list: every finding against the factory profile, and the design's status. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const { design, version } = await readinessFor(client, session.brand, input.params.projectId);
    return reportFor(client, session.brand.id, input.params.projectId, version, design);
  },
});

/** Records "validated" (no blockers against the profile today) or returns the design to draft. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params, body },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const { design, version } = await readinessFor(client, session.brand, input.params.projectId);
    return moveStatus({ client, admin: adminClient() }, { brandId: session.brand.id, userId: session.userId }, input.params.projectId, version, input.body.to, design, new Date());
  },
});
