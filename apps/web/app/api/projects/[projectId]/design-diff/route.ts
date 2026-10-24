import { z } from "zod";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { diffRequest, standInDiffProvider } from "@/lib/design-diff";
import { signProposal } from "@/lib/intent/proposal-token";
import { MODEL_TIMEOUT_MS, assistantModels, nowSeconds, proposalSigningKey } from "@/lib/projects/assistant";
import { textCost } from "@/lib/projects/assistant-request";
import { flatPreview } from "@/lib/projects/flat-preview";
import { assistantMessageSchema } from "@/lib/projects/schemas";
import { loadCurrentDesign } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { defaultFactoryProfile } from "@/lib/validation";

const MAX_BODY_BYTES = 8 * 1024;

/** The model for diffs: the browser tests' own stand-in when AI_PROVIDER_STUB is on, else the configured one. */
const diffModel = () => {
  const primary = assistantModels().primary;
  if (!primary) return null;
  return { ...primary, provider: getEnv().AI_PROVIDER_STUB === "on" ? standInDiffProvider() : primary.provider };
};

/**
 * Turns words into a design change and previews it (plan v4 W2-B). Nothing is saved: the answer
 * is the change in plain words, a drawing before and after, and a signed token. Confirm applies
 * the token with applyProposalAction, which makes one new version; Discard sends nothing.
 * Priced at the most a call can use and reserved before it runs (lib/usage).
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.assistant,
  maxBodyBytes: MAX_BODY_BYTES,
  schema: { params: z.object({ projectId: z.uuid() }), body: assistantMessageSchema },
  cost: () => {
    const model = diffModel();
    return model ? textCost(model.entry) : null;
  },
  handler: async ({ input, session, usage }) => {
    const { projectId } = input.params;
    const { utterance, expectedVersion } = input.body;
    const who = { projectId, brandId: session.brand.id, userId: session.userId };
    const client = await sessionClient();
    const [spec, charts] = await Promise.all([loadCurrentDesign(client, { ...who, expectedVersion }), brandChartSet(client, session.brand.id)]);
    const key = proposalSigningKey();
    const answer = await diffRequest(utterance, {
      spec,
      provider: diffModel()?.provider ?? null,
      // The seeded profile, labelled as not agreed with a factory; a brand's own profile joins when V1 stores one.
      profile: defaultFactoryProfile(),
      sign: (actions, explanations) => signProposal({ ...who, version: expectedVersion, actions, source: "assistant", explanations, label: "Apply this change" }, key, nowSeconds()),
      draw: (design) => flatPreview(design, new Map(), charts)?.views[0]?.src ?? null,
      refund: async () => usage?.refund(),
      signal: () => AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    return Response.json(answer, { headers: { "cache-control": "no-store" } });
  },
});
