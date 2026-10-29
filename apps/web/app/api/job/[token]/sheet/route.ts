import { z } from "zod";
import { PACKET_NOT_FOUND } from "@/lib/job-packet/errors";
import { tokenSchema } from "@/lib/job-packet/schemas";
import { packetSheet } from "@/lib/job-packet/server";
import { fileResponse, sheetFileName } from "@/lib/ops/download";
import { tokenFromPath, withPacketLimit } from "@/lib/job-packet/record";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ token: tokenSchema });

/**
 * The job sheet PDF of the batch a factory's link opens (decision 0072). No session: the token is the key. An
 * unknown, expired or revoked token is "not found", the same for all three.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.jobPacketFiles,
  schema: { params },
  // Held per link as well as per address, so one leaked link cannot build these files over and over.
  authorize: async ({ request }) =>
    withPacketLimit(productionDeps.hitRateLimit, LIMITS.jobPacketFilesLink, tokenFromPath(request.url), async () => undefined),
  handler: async ({ input }) => {
    const made = await packetSheet(input.params.token);
    if (!made) throw new AppError("not_found", PACKET_NOT_FOUND);
    return fileResponse(made.pdf, "application/pdf", sheetFileName(made.batch, "job-sheet.pdf"));
  },
});
