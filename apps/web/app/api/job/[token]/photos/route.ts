import { z } from "zod";
import { PACKET_NOT_FOUND } from "@/lib/job-packet/errors";
import { keepPhoto, photoStorage, PHOTO_MAX_BYTES } from "@/lib/job-packet/photo";
import { tokenFromPath, withPacketLimit } from "@/lib/job-packet/record";
import { photoFormSchema, tokenSchema } from "@/lib/job-packet/schemas";
import { openPacket, recordFactoryEvent } from "@/lib/job-packet/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { checkImage } from "@/lib/storage/image";

const FORM_OVERHEAD_BYTES = 64 * 1024;
const params = z.object({ token: tokenSchema });

/**
 * A photo from the factory (decision 0072). Before the body is read, the token must open a packet and the packet
 * must have room under its own limit. The image is then sniffed from its bytes, held to the size limit, and
 * rewritten so no camera or place details are kept, stored in the private uploads bucket and recorded.
 */
export const POST = defineRoute({
  auth: "public",
  rateLimit: LIMITS.jobPacketPhoto,
  maxBodyBytes: PHOTO_MAX_BYTES + FORM_OVERHEAD_BYTES,
  schema: { params, form: photoFormSchema },
  authorize: async ({ request }) => {
    const token = tokenFromPath(request.url);
    await withPacketLimit(productionDeps.hitRateLimit, LIMITS.jobPacketPhotoLink, token, async () => {
      if (!(await openPacket(adminClient(), token))) throw new AppError("not_found", PACKET_NOT_FOUND);
    });
  },
  handler: async ({ input }) => {
    const admin = adminClient();
    const { token } = input.params;
    const packet = await openPacket(admin, token);
    if (!packet) throw new AppError("not_found", PACKET_NOT_FOUND);
    const bytes = new Uint8Array(await input.form.photo.arrayBuffer());
    const recorded = await keepPhoto(
      { check: checkImage, ...photoStorage(admin), record: (event) => recordFactoryEvent(admin, event) },
      { token, packetId: packet.packetId, bytes, note: input.form.note },
    );
    return { at: recorded.at };
  },
});
