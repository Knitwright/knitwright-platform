"use server";

import { revalidatePath } from "next/cache";
import { amPlatformAdmin } from "@/lib/leads/service";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { confirmSchema, explainSchema, ruleInputSchema, signOffSchema } from "./input";
import type { RuleReader } from "./select";
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
    // Owner decision 11: the Knitwright team sees the draft it is writing, marked draft; everyone else sees only
    // the words the factory has confirmed. The rule is read with the server's key so a draft's words never leave
    // the server for a member, even though every signed-in person may read the table itself.
    const reader: RuleReader = (await amPlatformAdmin(await sessionClient())) ? "ops" : "member";
    const resolved = await resolveRule(adminClient(), input.ruleId, reader);
    // Only a well-formed rule id becomes a gap row. Anything else still shows the gap text, but a signed-in
    // person cannot fill the gap list with made-up codes through the one action they may call.
    if (!resolved.newest && RULE_ID.test(input.ruleId)) await logGap(adminClient(), { code: input.ruleId, context: input.context });
    return whyView(input.ruleId, resolved);
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

/**
 * A sign-off session: every rule one person reviewed, confirmed in their name in one press (owner question F3).
 * Each rule goes through the same `rulebook_entry_confirm` as the single-rule form, so the database's own guard
 * still applies to every one of them: a version already confirmed is left exactly as it is, which makes a second
 * press of the same session harmless, and a version that has moved on since the page was drawn confirms nothing.
 * They go one at a time so that the first refusal stops the session rather than scattering half of it.
 */
export const confirmRulesAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: signOffSchema,
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    const admin = adminClient();
    const { confirmedName, confirmedRole } = input;
    for (const rule of input.rules) await confirmEntry(admin, session.userId, { ...rule, confirmedName, confirmedRole });
    revalidatePath("/admin/rulebook");
    return { confirmed: input.rules.length };
  },
});

export const confirmRuleAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: confirmSchema,
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    await confirmEntry(adminClient(), session.userId, input);
    revalidatePath("/admin/rulebook");
    return { ruleId: input.ruleId, version: input.version };
  },
});
