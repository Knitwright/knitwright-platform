"use server";

import { revalidatePath } from "next/cache";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { confirmSchema, explainSchema, ruleInputSchema } from "./input";
import { confirmEntry, logGap, resolveRule, saveEntry } from "./store";
import { RULE_ID } from "./types";
import { whyView, type WhyView } from "./view";

/**
 * The rulebook's actions (decision 0067). Anyone signed in may ask "Why?"; an id with no entry is logged as a gap
 * for the team. Editing and confirming are for platform admins only; anyone else gets "not found".
 */

export const explainRuleAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.read,
  schema: explainSchema,
  handler: async ({ input }): Promise<WhyView> => {
    const entry = await resolveRule(await sessionClient(), input.ruleId);
    // Only a well-formed rule id becomes a gap row. Anything else still shows the gap text, but a signed-in
    // person cannot fill the gap list with made-up codes through the one action they may call.
    if (!entry && RULE_ID.test(input.ruleId)) await logGap(adminClient(), { code: input.ruleId, context: input.context });
    return whyView(input.ruleId, entry);
  },
});

export const saveRuleAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: ruleInputSchema,
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    const version = await saveEntry(adminClient(), session.userId, input);
    revalidatePath("/admin/rulebook");
    return { ruleId: input.ruleId, version };
  },
});

export const confirmRuleAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: confirmSchema,
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    await confirmEntry(adminClient(), session.userId, input.ruleId, input.version);
    revalidatePath("/admin/rulebook");
    return { ruleId: input.ruleId, version: input.version };
  },
});
