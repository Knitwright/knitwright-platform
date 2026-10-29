import { z } from "zod";
import { INTAKE_LIMITS } from "@/lib/artwork-intake/settings";
import { listArtworks, uploadArtwork } from "@/lib/artwork-intake/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { uploadGate } from "@/lib/moderation/server";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** The brand's own artwork, newest first. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ artworks: await listArtworks(await sessionClient(), session.brand.id) }),
});

/**
 * Takes in artwork: PNG, JPEG, TIFF, PDF, SVG, or AI saved with PDF compatibility. The type comes from the file's
 * first bytes. A raster is kept as a full size sRGB copy and a screen copy; a vector becomes plain vector data and is
 * never stored as SVG. The person must confirm they may use it on garments (decision 0025). See lib/artwork-intake.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkIntake,
  maxBodyBytes: INTAKE_LIMITS.maxFileBytes + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.object({
      file: z.instanceof(File, { message: "Choose a file to upload." }),
      rights: z.literal("yes").optional(),
    }),
  },
  handler: async ({ input, session }) =>
    uploadArtwork(
      adminClient(),
      { brandId: session.brand.id, userId: session.userId },
      {
        bytes: new Uint8Array(await input.form.file.arrayBuffer()),
        fileName: input.form.file.name,
        rightsConfirmed: input.form.rights === "yes",
        now: new Date(),
      },
      uploadGate("POST /api/artwork"),
    ),
});
