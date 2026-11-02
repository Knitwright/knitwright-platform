import { createHash } from "node:crypto";
import { z } from "zod";
import { labelFrom } from "@/lib/artwork-intake/label";
import { uploadGate } from "@/lib/moderation/server";
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
    const bytes = new Uint8Array(await input.form.file.arrayBuffer());

    /**
     * On every upload (spec F-G1; security review v5 H3, decision 0116). A file stored here is what
     * a design's `artwork` entries name, so an unscreened one holds "Ready for the factory" shut
     * (`lib/validation/checks/moderation.ts`) -- and this is the route the editor's artwork picker
     * and the design import panel both post through.
     *
     * `screenUpload` refuses a blocked picture before anything is stored and hands back the call
     * that keeps the result against the new file's id.
     */
    const afterStore = await uploadGate("POST /api/files")({
      brandId: session.brand.id,
      userId: session.userId,
      label: labelFrom(input.form.file.name),
      image: bytes,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const stored = await storeImage({
      admin: adminClient(),
      brandId: session.brand.id,
      userId: session.userId,
      kind: input.form.kind,
      // A person chose this file and sent it. No model is reachable from this route.
      provenance: "uploaded",
      bytes,
      statedType: input.form.file.type,
      rights: check.rights,
    });
    await afterStore(stored.id);
    return stored;
  },
});
