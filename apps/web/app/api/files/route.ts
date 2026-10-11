import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { IMAGE_LIMITS } from "@/lib/storage/image";
import { logoRightsFor } from "@/lib/storage/rights";
import { IMAGE_KINDS, storeImage } from "@/lib/storage/store";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/**
 * Stores an image for the brand the user is working in. The image is checked and
 * rewritten before it is stored. See lib/storage/image.ts.
 *
 * Artwork goes on a garment, so it is refused unless the form says the person owns it or
 * may use it ("rights" = "yes"). The confirmation is kept with the file (decision 0025).
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.upload,
  maxBodyBytes: IMAGE_LIMITS.maxBytes + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.object({
      kind: z.enum(IMAGE_KINDS),
      file: z.instanceof(File, { message: "Choose an image to upload." }),
      rights: z.literal("yes").optional(),
    }),
  },
  handler: async ({ input, session }) => {
    const check = logoRightsFor({ kind: input.form.kind, confirmed: input.form.rights === "yes", userId: session.userId, now: new Date() });
    if (!check.ok) throw new AppError("invalid_input", check.message, { rights: [check.message] });
    return storeImage({
      admin: adminClient(),
      brandId: session.brand.id,
      userId: session.userId,
      kind: input.form.kind,
      bytes: new Uint8Array(await input.form.file.arrayBuffer()),
      statedType: input.form.file.type,
      rights: check.rights,
    });
  },
});
