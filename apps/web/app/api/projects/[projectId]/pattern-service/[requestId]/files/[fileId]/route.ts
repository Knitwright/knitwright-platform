import { z } from "zod";
import { fileResponse } from "@/lib/ops/download";
import { getRequest } from "@/lib/pattern-service/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createFileReader, TOO_LARGE } from "@/lib/storage/read";

const params = z.object({ projectId: z.uuid(), requestId: z.uuid(), fileId: z.uuid() });
const MAX_BYTES = 10 * 1024 * 1024;
const NOT_FOUND = "That file does not exist.";

/**
 * A delivered pattern file, downloaded by a member of the brand. The file must be one the request lists, so a file id of the
 * brand's other files is not reachable through here. Sent as a download, never run by the browser.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fileLink,
  schema: { params },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const request = await getRequest(client, input.params.requestId);
    const { projectId, requestId, fileId } = input.params;
    if (!request || request.brandId !== session.brand.id || request.projectId !== projectId || request.id !== requestId || !request.fileIds.includes(fileId)) {
      throw new AppError("not_found", NOT_FOUND);
    }
    const file = await createFileReader(client, session.brand.id).read(fileId, MAX_BYTES);
    if (file === null || file === TOO_LARGE) throw new AppError("not_found", NOT_FOUND);
    const position = request.fileIds.indexOf(fileId) + 1;
    return fileResponse(file.bytes, "application/octet-stream", `pattern-v${request.designVersion}-${position}.dxf`);
  },
});
