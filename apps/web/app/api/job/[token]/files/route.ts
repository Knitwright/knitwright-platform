import { z } from "zod";
import { PACKET_NOT_FOUND } from "@/lib/job-packet/errors";
import { tokenSchema } from "@/lib/job-packet/schemas";
import { packetZip } from "@/lib/job-packet/server";
import { fileResponse, sheetFileName } from "@/lib/ops/download";
import { tokenFromPath, withPacketLimit } from "@/lib/job-packet/record";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ token: tokenSchema });

/**
 * One ZIP for the factory: the job sheet, the batch's print files (built as the ops console builds them, with the
 * manifest) and the patterns (decision 0072). No session: the token is the key.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.jobPacketFiles,
  schema: { params },
  // Held per link as well as per address, so one leaked link cannot build these files over and over.
  authorize: async ({ request }) =>
    withPacketLimit(productionDeps.hitRateLimit, LIMITS.jobPacketFilesLink, tokenFromPath(request.url), async () => undefined),
  handler: async ({ input }) => {
    const made = await packetZip(input.params.token);
    if (!made) throw new AppError("not_found", PACKET_NOT_FOUND);
    return fileResponse(made.zip, "application/zip", sheetFileName(made.batch, "job-packet.zip"));
  },
});
