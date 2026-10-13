import { z } from "zod";
import { brandChartSet } from "@/lib/charts/service";
import { signProposal } from "@/lib/intent/proposal-token";
import { answeredWithoutModel } from "@/lib/intent/text-flow";
import { MODEL_TIMEOUT_MS, assistantModels, nowSeconds, proposalSigningKey } from "@/lib/projects/assistant";
import { eventStream, textCost, textRequestEvents } from "@/lib/projects/assistant-request";
import { recordLines } from "@/lib/projects/chat-history";
import { assistantMessageSchema } from "@/lib/projects/schemas";
import { loadCurrentDesign, saveTrustedActions } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { withChartValues } from "@/lib/sizing";

/** Room for the message and the version around it. The message itself is limited by the schema. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * One message to the assistant about one design (plan step 12, task 4). The current design
 * is read here and sent with the request. A request the rules or the guard can answer costs
 * nothing; any other is priced at the most it can use and reserved before it runs. The
 * answer is a stream of JSON lines: progress, then one outcome. A change is saved here, as
 * one version marked as suggested by the assistant; a question's choices come back signed.
 * The words and the answer are kept with the design, so the conversation is there next time.
 * The design is read with the size chart's suggested values filled in where it has none.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.assistant,
  maxBodyBytes: MAX_BODY_BYTES,
  schema: { params: z.object({ projectId: z.uuid() }), body: assistantMessageSchema },
  cost: ({ body }) => {
    const primary = assistantModels().primary;
    return primary && !answeredWithoutModel(body.utterance) ? textCost(primary.entry) : null;
  },
  handler: async ({ input, session, usage }) => {
    const { projectId } = input.params;
    const { utterance, expectedVersion } = input.body;
    const who = { projectId, brandId: session.brand.id, userId: session.userId };
    const client = await sessionClient();
    const [stored, charts] = await Promise.all([
      loadCurrentDesign(client, { ...who, expectedVersion }),
      brandChartSet(client, session.brand.id),
    ]);
    // The assistant reads the values the person sees, chart suggestions included, so "2 cm
    // longer" starts from them. Only the assistant's own changes are saved.
    const spec = withChartValues(stored, charts);
    const key = proposalSigningKey();
    const issued = nowSeconds();
    return eventStream((emit) =>
      textRequestEvents(
        utterance,
        {
          spec,
          models: assistantModels(),
          usage,
          save: (actions, explanations) =>
            saveTrustedActions(adminClient(), client, { ...who, expectedVersion, actions, source: "assistant", explanations }),
          sign: (actions, explanations, at) =>
            signProposal({ ...who, version: at.version ?? expectedVersion, actions, source: "assistant", explanations, label: at.label }, key, issued),
          record: (lines) => recordLines(adminClient(), who, lines),
          log,
          timeoutMs: MODEL_TIMEOUT_MS,
        },
        emit,
      ),
    );
  },
});
