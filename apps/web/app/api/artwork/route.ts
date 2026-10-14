import { z } from "zod";
import { ARTWORK_LIMITS } from "@/lib/artwork-intake/limits";
import { intakeArtwork } from "@/lib/artwork-intake/intake";
import { listArtworks } from "@/lib/artwork-intake/records";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { logoRightsFor } from "@/lib/storage/rights";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Reading a file and rewriting it can take a few seconds (decision 0002). */
export const maxDuration = 60;

/** The artwork the brand has uploaded, newest first. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ artworks: await listArtworks(await sessionClient(), session.brand.id) }),
});

/**
 * Takes a brand's own artwork: PNG, JPEG, TIFF, PDF, SVG, or an Illustrator file saved with PDF
 * compatibility. The type is read from the first bytes. A picture is rewritten as pixels; a vector is
 * reduced to restricted JSON. Nothing a browser could run is stored. The person must confirm they may
 * use it (decision 0025).
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkIntake,
  maxBodyBytes: ARTWORK_LIMITS.maxBytes + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.object({
      file: z.instanceof(File, { message: "Choose a file to upload." }),
      rights: z.literal("yes").optional(),
    }),
  },
  handler: async ({ input, session }) => {
    const check = logoRightsFor({ kind: "artwork", confirmed: input.form.rights === "yes", userId: session.userId, now: new Date() });
    if (!check.ok || !check.rights) {
      const message = check.ok ? "Confirm that you may use this artwork." : check.message;
      throw new AppError("invalid_input", message, { rights: [message] });
    }
    return {
      artwork: await intakeArtwork(
        { admin: adminClient(), brandId: session.brand.id, userId: session.userId, rights: check.rights },
        { bytes: new Uint8Array(await input.form.file.arrayBuffer()), filename: input.form.file.name },
      ),
    };
  },
});
