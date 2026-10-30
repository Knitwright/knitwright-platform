"use server";

import { amPlatformAdmin } from "@/lib/leads/service";
import { assistantModels } from "@/lib/projects/assistant";
import type { ModelEntry } from "@/lib/providers/catalog";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import type { RuleReader } from "../select";
import { loadEntries, logGap } from "../store";
import { askRulebook } from "./ask";
import { bestPracticeCard, partFor } from "./best-practice";
import { databaseRetrieval } from "./retrieve";
import { askCost } from "./cost";
import { askSchema, bestPracticeSchema } from "./input";
import type { AskResult, BestPracticeCard, RetrievedRule } from "./types";

/**
 * The Ask box and the best-practice card as the browser reaches them (decision 0083). Both are for any signed-in
 * member of a brand. Owner decision 11 is applied on the server: the caller's reader is worked out here and the
 * rules are read with the server's key, so a draft's words never leave the server for a member.
 *
 * Asking may reach a paid model, so the call is reserved against the person's allowance before it is made and
 * given back when it fails, and the rate limit is the assistant's.
 */

const ROUTE = "action rulebook.ask";

/** Reserves one question's cost for this payer, or refuses it when an allowance is used up. */
const reserver =
  (payer: Readonly<{ userId: string; brandId: string }>, entry: ModelEntry) =>
  async (rules: readonly RetrievedRule[], question: string) => {
    const held = await productionDeps.usage.reserve({ ...payer, cost: askCost(entry, rules, question), route: ROUTE });
    if (!held.ok) return null;
    return {
      refund: async () => {
        await productionDeps.usage.refund(held.eventId);
      },
    };
  };

const readerFor = async (): Promise<RuleReader> => ((await amPlatformAdmin(await sessionClient())) ? "ops" : "member");

export const askRulebookAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.assistant,
  schema: askSchema,
  handler: async ({ input, session }): Promise<AskResult> => {
    const { primary } = assistantModels();
    const payer = { userId: session.userId, brandId: session.brand.id };
    return askRulebook(
      {
        retrieval: databaseRetrieval(adminClient()),
        logGap: (gap) => logGap(adminClient(), gap),
        model: primary?.provider ?? null,
        reader: await readerFor(),
        reserve: primary ? reserver(payer, primary.entry) : undefined,
      },
      { question: input.question, scope: { articleCode: input.articleCode, method: input.method } },
    );
  },
});

export const bestPracticeAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: bestPracticeSchema,
  handler: async ({ input }): Promise<BestPracticeCard> => {
    const part = partFor(input.part);
    if (!part) throw new Error(`No such part: ${input.part}`);
    const entries = await loadEntries(adminClient());
    return bestPracticeCard(entries, part, { articleCode: input.articleCode, method: input.method }, await readerFor());
  },
});
