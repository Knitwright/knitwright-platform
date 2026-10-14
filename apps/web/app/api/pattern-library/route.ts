import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { listBlocks } from "@/lib/pattern-library/service";
import { describeSlots } from "@/lib/pattern-library/slots";
import { uploadFieldsSchema, uploadSet } from "@/lib/pattern-library/upload";
import { MAX_DXF_BYTES } from "@/lib/pattern-library/dxf/parse";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const NOT_OPEN = "The pattern library is not open yet.";
const FORM_OVERHEAD_BYTES = 64 * 1024;
/** Room for a size run: up to eight files at the largest size each. */
const MAX_UPLOAD_BYTES = 8 * MAX_DXF_BYTES;

/** The library: a slot for every product, with the newest block of each wearer and cut filed in it. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    const open = patternLibraryOpenTo(getEnv(), session.email);
    if (!open) return { open, slots: [] };
    return { open, slots: describeSlots(await listBlocks(await sessionClient(), session.brand.id)) };
  },
});

const filesOf = z.union([z.instanceof(File), z.array(z.instanceof(File))]).transform((value) => (Array.isArray(value) ? value : [value]));

/**
 * Stores a size set from the DXF files of a technician or a brand as the next version of its
 * block. The files are read, completed, checked and measured first; a set whose front and
 * back would not sew together is refused with the seam named, and nothing is stored.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.patternLibrary,
  maxBodyBytes: MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.looseObject({ files: filesOf }),
  },
  handler: async ({ input, session }) => {
    if (!patternLibraryOpenTo(getEnv(), session.email)) throw new AppError("unavailable", NOT_OPEN);
    const { files, ...rest } = input.form;
    const parsed = uploadFieldsSchema.safeParse(rest);
    if (!parsed.success) throw new AppError("invalid_input", parsed.error.issues[0]?.message ?? "Some fields need another look.");
    const uploads = await Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    return uploadSet(adminClient(), { brandId: session.brand.id, userId: session.userId }, parsed.data, uploads);
  },
});
