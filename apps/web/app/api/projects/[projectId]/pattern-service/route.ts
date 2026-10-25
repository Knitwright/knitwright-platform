import { z } from "zod";
import { listBlocks } from "@/lib/pattern-library/service";
import { eligibleForPatternService } from "@/lib/pattern-service/eligibility";
import { quoteFrom, quoteWords } from "@/lib/pattern-service/quote";
import { requestPatternForDesign } from "@/lib/pattern-service/server";
import { listForProject } from "@/lib/pattern-service/service";
import { WHAT_IS_SENT } from "@/lib/pattern-service/wording";
import { getProject } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { loadStored } from "@/lib/settings/store";

const params = z.object({ projectId: z.uuid() });

/** The design's pattern requests, whether one can be made, and what it would cost: the price and turnaround come from the settings. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const [project, blocks, requests, stored] = await Promise.all([
      getProject(client, session.brand.id, input.params.projectId),
      listBlocks(client, session.brand.id),
      listForProject(client, session.brand.id, input.params.projectId),
      loadStored(adminClient()).catch(() => ({})),
    ]);
    const quote = quoteFrom(stored);
    return { eligibility: eligibleForPatternService(project.garmentType, blocks), quote, words: quoteWords(quote), sent: WHAT_IS_SENT, requests };
  },
});

/** Sends the design's current version to the pattern service. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.requestQuote,
  schema: { params },
  handler: async ({ input, session }) => {
    const out = await requestPatternForDesign({ brandId: session.brand.id, userId: session.userId }, input.params.projectId);
    return { requestId: out.requestId, created: out.created, charged: out.charged };
  },
});
