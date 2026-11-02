import { z } from "zod";
import { CREST_LIMITS } from "@/lib/crest-to-kit/settings";
import { checkIntake, intakeSchema } from "@/lib/crest-to-kit/intake";
import { kitsFor } from "@/lib/crest-to-kit/server";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** No handler may rely on more than 60 seconds (decision 0002). A run of this takes well under one. */
export const maxDuration = 60;

/** Room for the form's own text around the crest. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/**
 * The kits one crest yields (spec F-T2). The crest is read, its colours are counted from a decoded
 * copy, the kits are built from the base article's own options and each one is validated before it
 * is sent. NOTHING IS STORED: there is no table and no bucket behind this route, and the crest's
 * bytes are gone when the answer is sent.
 *
 * It is limited like an upload, because it reads a picture.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.upload,
  maxBodyBytes: CREST_LIMITS.maxFileBytes + FORM_OVERHEAD_BYTES,
  schema: { form: intakeSchema.extend({ file: z.instanceof(File).optional() }) },
  handler: async ({ input }) => {
    const { file, ...fields } = input.form;
    const read = checkIntake(fields, file !== undefined);
    if (!read.ok) throw new AppError("invalid_input", read.errors[0] ?? MESSAGES.invalid_input);
    const outcome = await kitsFor(await sessionClient(), {
      sportId: read.input.sportId,
      feel: read.input.feel,
      roles: read.input.roles,
      clubName: read.input.clubName,
      colours: read.input.colours,
      file: file === undefined ? null : { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
    });
    if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
    return outcome.view;
  },
});
