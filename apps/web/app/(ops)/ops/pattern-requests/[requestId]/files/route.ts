import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { attachParams } from "@/lib/pattern-service/schemas";
import { attachDelivered } from "@/lib/pattern-service/deliver";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FORM_OVERHEAD_BYTES = 64 * 1024;
const filesOf = z.union([z.instanceof(File), z.array(z.instanceof(File))]).transform((value) => (Array.isArray(value) ? value : [value]));

/**
 * Ops attaches the DXF files the Sialkot team returned. Platform admins only; everyone else gets "not found". The files are stored as
 * pattern-source files of the request's brand, then listed on the request, which must be in progress.
 */
export const POST = defineRoute({
  auth: "user",
  rateLimit: LIMITS.upload,
  maxBodyBytes: 5 * MAX_FILE_BYTES + FORM_OVERHEAD_BYTES,
  schema: { params: attachParams, form: z.looseObject({ files: filesOf }) },
  authorize: async () => assertPlatformAdmin(await sessionClient()),
  handler: async ({ input, session }) => {
    const { files } = input.form;
    if (files.length < 1 || files.length > 5) throw new AppError("invalid_input", "Attach 1 to 5 DXF files at a time.");
    const uploads = await Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    return attachDelivered(adminClient(), await sessionClient(), session.userId, input.params.requestId, uploads);
  },
});
