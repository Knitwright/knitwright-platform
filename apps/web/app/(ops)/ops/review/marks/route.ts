import { z } from "zod";
import { hasEnoughDetail, imageHash } from "@/lib/moderation/image-hash";
import { addMark, markSchema } from "@/lib/moderation/review";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FORM_OVERHEAD_BYTES = 64 * 1024;

/**
 * Ops registers a mark's picture (decision 0073). Platform admins only, checked before the body is read; everyone else gets
 * "not found". Only the picture's perceptual hash is kept, never the picture.
 */
export const POST = defineRoute({
  auth: "user",
  rateLimit: LIMITS.upload,
  maxBodyBytes: MAX_IMAGE_BYTES + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.looseObject({
      image: z.instanceof(File, { message: "Choose the mark's picture." }),
      holder: z.string(),
      markText: z.string().optional(),
      contact: z.string().optional(),
      source: z.string().optional(),
    }),
  },
  authorize: async () => assertPlatformAdmin(await sessionClient()),
  handler: async ({ input, session }) => {
    const { image, ...rest } = input.form;
    if (image.size > MAX_IMAGE_BYTES) throw new AppError("too_large", "The picture is larger than 5 MB.");
    let hash: string;
    try {
      hash = await imageHash(new Uint8Array(await image.arrayBuffer()));
    } catch {
      throw new AppError("invalid_input", "That file is not a picture we can read. Use PNG, JPEG or WebP.");
    }
    // A nearly flat picture is never compared (lib/moderation/image-hash.ts), so registering one would do nothing at all.
    if (!hasEnoughDetail(hash)) {
      throw new AppError("invalid_input", "There is too little in that picture to compare it with. Crop it to the mark itself.");
    }
    const mark = markSchema.safeParse({ ...rest, imageHash: hash });
    if (!mark.success) throw new AppError("invalid_input", mark.error.issues[0]?.message ?? "Check the fields.");
    return { id: await addMark(adminClient(), session.userId, mark.data), imageHash: hash };
  },
});
