import { payloadOf } from "@/lib/design-import/payload";
import { startImportSchema } from "@/lib/design-import/schemas";
import { startImport } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { importCost, startDeps } from "./deps";

/**
 * Reads a design from a picture the person uploaded through /api/files (plan W7d). Only a file and a project of the
 * brand in the session can be used. The answer is a proposal to look at side by side; nothing is saved as the
 * design until the person accepts it. Priced at the most a reading can use, reserved before it runs.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.designImport,
  maxBodyBytes: 4096,
  schema: { body: startImportSchema },
  cost: () => importCost(),
  handler: async ({ input, session, usage }) => {
    const result = await startImport(await startDeps(session.brand.id, usage), { brandId: session.brand.id, userId: session.userId }, input.body);
    return result.kind === "ready" ? { kind: "ready" as const, reading: payloadOf(result.record) } : result;
  },
});
