import { z } from "zod";
import { printFileBuilder } from "@/lib/releases/builder";
import { releaseBody } from "@/lib/releases/schemas";
import { listReleases } from "@/lib/releases/service";
import { freezeRelease } from "@/lib/releases/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ projectId: z.uuid() });

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => ({ releases: await listReleases(await sessionClient(), session.brand.id, input.params.projectId) }),
});

/** Freezes a release: the design version, the settings and the SHA-256 of every file. Never changed afterwards. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.releaseCreate,
  maxBodyBytes: 2_000_000,
  schema: { params, body: releaseBody },
  handler: async ({ input, session }) =>
    freezeRelease({ client: await sessionClient(), admin: adminClient() }, { brandId: session.brand.id, userId: session.userId }, input.params.projectId, input.body, printFileBuilder),
});
