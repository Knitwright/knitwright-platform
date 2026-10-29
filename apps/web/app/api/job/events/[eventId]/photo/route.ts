import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { photoStorage } from "@/lib/job-packet/photo";
import { loadFactoryEvent } from "@/lib/job-packet/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ eventId: z.uuid() });

/**
 * A photo a factory sent through its job packet, for ops (decision 0072). Platform admins only; everyone else
 * gets "not found". The event is read with the admin's own client, so the database's rules decide.
 */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.manageJobPackets,
  schema: { params },
  authorize: async () => assertPlatformAdmin(await sessionClient()),
  handler: async ({ input }) => {
    // Read as the admin themselves, so the table's own rule decides what they may see.
    const event = await loadFactoryEvent(await sessionClient(), input.params.eventId);
    if (!event?.photoKey) throw new AppError("not_found", "That photo does not exist.");
    const bytes = await photoStorage(adminClient()).read(event.photoKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": event.photoKey.endsWith(".png") ? "image/png" : "image/jpeg",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-length": String(bytes.byteLength),
      },
    });
  },
});
