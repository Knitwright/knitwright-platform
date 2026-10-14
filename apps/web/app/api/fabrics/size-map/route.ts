import { z } from "zod";
import { effectiveSizeMaps } from "@/lib/fabrics/size-maps";
import { sizeMapEntrySchema } from "@/lib/fabrics/schemas";
import { listSavedSizeMaps, resetSizeMap, saveSizeMap } from "@/lib/fabrics/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Which pattern size each size label is cut from. Labels the brand has not chosen show the suggestion. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ sizeMaps: effectiveSizeMaps(await listSavedSizeMaps(await sessionClient(), session.brand.id)) }),
});

/** Sets the pattern size one label is cut from. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: { body: sizeMapEntrySchema },
  handler: async ({ input, session }) => {
    await saveSizeMap(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body);
    return { saved: true };
  },
});

/** Goes back to the suggested pattern size for one label. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: { body: z.object({ label: z.string().min(1).max(16), wearer: sizeMapEntrySchema.shape.wearer, cut: sizeMapEntrySchema.shape.cut }) },
  handler: async ({ input, session }) => {
    await resetSizeMap(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body);
    return { saved: true };
  },
});
