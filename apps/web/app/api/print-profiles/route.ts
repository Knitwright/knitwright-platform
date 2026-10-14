import { DEFAULT_PRINT_RULES, listLeagueRules, loadPrintProfile, printProfileInputSchema, profileNotes, savePrintProfile } from "@/lib/print/profiles";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's print profile (the defaults if it has none), its league rule sets, and what they rest on. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    const client = await sessionClient();
    const [profile, ruleSets] = await Promise.all([loadPrintProfile(client, session.brand.id), listLeagueRules(client, session.brand.id)]);
    return { profile, ruleSets, defaultRules: DEFAULT_PRINT_RULES, notes: profileNotes(profile, ruleSets.map((r) => r.rules)) };
  },
});

/** Saves the brand's print house settings. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { body: printProfileInputSchema },
  handler: async ({ input, session }) => {
    await savePrintProfile(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body);
    return { saved: true };
  },
});
