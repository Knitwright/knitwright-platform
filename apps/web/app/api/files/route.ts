import { z } from "zod";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { IMAGE_LIMITS } from "@/lib/storage/image";
import { IMAGE_KINDS, storeImage } from "@/lib/storage/store";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/**
 * Stores an image for the brand the user is working in. The image is checked and
 * rewritten before it is stored. See lib/storage/image.ts.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.upload,
  maxBodyBytes: IMAGE_LIMITS.maxBytes + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.object({
      kind: z.enum(IMAGE_KINDS),
      file: z.instanceof(File, { message: "Choose an image to upload." }),
    }),
  },
  handler: async ({ input, session }) =>
    storeImage({
      admin: adminClient(),
      brandId: session.brand.id,
      userId: session.userId,
      kind: input.form.kind,
      bytes: new Uint8Array(await input.form.file.arrayBuffer()),
      statedType: input.form.file.type,
    }),
});
