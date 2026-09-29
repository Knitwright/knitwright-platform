import { z } from "zod";
import { signProposal } from "@/lib/intent/proposal-token";
import { MODEL_TIMEOUT_MS, assistantModels, nowSeconds, proposalSigningKey } from "@/lib/projects/assistant";
import { flatPreview } from "@/lib/projects/flat-preview";
import { imageCost, readImageRequest } from "@/lib/projects/image-request";
import { readImageSchema } from "@/lib/projects/schemas";
import { loadCurrentDesign } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";

/**
 * Reads a sketch or photo the person uploaded through /api/files (plan step 13). Only a file
 * of the brand in the session can be read. The answer is a proposal to review, signed, with
 * the proposed design drawn; nothing is saved until the person confirms it and it is applied
 * with applyProposalAction. Priced at the most a reading can use, reserved before it runs.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.readImage,
  maxBodyBytes: 4096,
  schema: { params: z.object({ projectId: z.uuid() }), body: readImageSchema },
  cost: () => {
    const primary = assistantModels().primary;
    return primary ? imageCost(primary.entry) : null;
  },
  handler: async ({ input, session, usage }) => {
    const { projectId } = input.params;
    const { fileId, expectedVersion } = input.body;
    const who = { projectId, brandId: session.brand.id, userId: session.userId };
    const client = await sessionClient();
    const spec = await loadCurrentDesign(client, { ...who, expectedVersion });
    const key = proposalSigningKey();
    const reader = createFileReader(client, session.brand.id);
    return readImageRequest({
      spec,
      fileId,
      readFile: (id, maxBytes) => reader.read(id, maxBytes),
      provider: assistantModels().primary?.provider ?? null,
      usage,
      sign: (actions, explanations) =>
        signProposal({ ...who, version: expectedVersion, actions, source: "picture", explanations }, key, nowSeconds()),
      preview: (proposed) => flatPreview(proposed, new Map()),
      log,
      timeoutMs: MODEL_TIMEOUT_MS,
    });
  },
});
