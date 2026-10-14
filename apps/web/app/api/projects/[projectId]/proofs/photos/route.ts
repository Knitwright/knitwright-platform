import { z } from "zod";
import { defineRoute } from "@/lib/server/define-route";
import { assertProjectOfBrand } from "@/lib/proofs/project-check";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { IMAGE_LIMITS } from "@/lib/storage/image";
import { storeProductionFile } from "@/lib/storage/store";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Stores a photo of a strike-off of a design of the session's brand. The picture is checked and rewritten like any upload. Attach it when recording the arrival. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.upload,
  maxBodyBytes: IMAGE_LIMITS.maxBytes + FORM_OVERHEAD_BYTES,
  schema: {
    params: z.object({ projectId: z.uuid() }),
    form: z.object({ file: z.instanceof(File, { message: "Choose a photo to upload." }) }),
  },
  handler: async ({ input, session }) => {
    await assertProjectOfBrand(await sessionClient(), session.brand.id, input.params.projectId);
    const stored = await storeProductionFile("proof", {
      admin: adminClient(),
      brandId: session.brand.id,
      userId: session.userId,
      bytes: new Uint8Array(await input.form.file.arrayBuffer()),
    });
    return { id: stored.id };
  },
});
