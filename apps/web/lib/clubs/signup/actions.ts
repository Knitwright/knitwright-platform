"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { screenText } from "@/lib/moderation/hooks";
import { moderationDeps } from "@/lib/moderation/server";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { inviteSender } from "@/lib/share/email-server";
import { newShareToken } from "@/lib/share/token";
import { verifyBotCheck } from "@/lib/share/turnstile";
import { requireAbility, whoOf } from "../guards";
import { getRoster, replaceRoster } from "../service";
import { NO_EMAIL_FOR_THEM, chaseEmail, templateFor } from "./chase";
import { mergeIntoRoster, mergeSummary } from "./merge";
import { readPastedList } from "./paste";
import {
  applyAnswersSchema,
  chaseByEmailSchema,
  createSignupLinkSchema,
  pasteListSchema,
  rosterSignupSchema,
  signupLinkSchema,
} from "./schemas";
import {
  createSignupLink,
  readChaseTemplates,
  readSeasonSignup,
  readZoneLimits,
  openSignup,
  revokeSignupLink,
  setRequests,
  submitSignup,
} from "./service";
import { takeAnswer } from "./submit";
import { SIGNUP_VISITOR_COOKIE, newVisitorKey, signupAddress, signupCookieOptions } from "./token";
import { isVisitorKey } from "@/lib/share/token";

/**
 * Roster sign-up (spec F-T4, plan v5 Z7, decision 0087). A club's actions take the club and the
 * person from the session and never from the form; the database checks the person's role itself. A
 * player's action needs no session: it is limited per address and per link, guarded by the bot
 * check, and screened by moderation before anything is kept.
 */

const refresh = (): void => revalidatePath("/team");

/** The player's visitor key from their cookie, or a new one set in it. Scoped to /join. */
const visitorKey = async (): Promise<string> => {
  const store = await cookies();
  const known = store.get(SIGNUP_VISITOR_COOKIE)?.value;
  if (isVisitorKey(known)) return known;
  const fresh = newVisitorKey();
  store.set(SIGNUP_VISITOR_COOKIE, fresh, signupCookieOptions(getEnv().NEXT_PUBLIC_SITE_URL));
  return fresh;
};

/** Makes the season's sign-up link, which withdraws the one before it. */
export const createSignupLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageRosterSignup,
  schema: createSignupLinkSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const link = await createSignupLink(adminClient(), whoOf(session), {
      seasonId: input.seasonId,
      token: newShareToken(),
      sport: input.sport,
    });
    refresh();
    return { address: signupAddress(getEnv().NEXT_PUBLIC_SITE_URL, link.token), expiresAt: link.expiresAt };
  },
});

export const revokeSignupLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageRosterSignup,
  schema: signupLinkSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await revokeSignupLink(adminClient(), whoOf(session), input.linkId);
    refresh();
    return { revoked: true };
  },
});

/** The pasted list: who the club is waiting on. The duplicates it folded are named back. */
export const pasteSquadListAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageRosterSignup,
  schema: pasteListSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const read = readPastedList(input.list);
    const kept = await setRequests(adminClient(), whoOf(session), input.seasonId, read.people);
    refresh();
    return { kept, problems: read.problems, duplicates: read.duplicates };
  },
});

/** Folds the answers into the season's roster, through the club's own roster writer. */
export const applyAnswersAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageRosterSignup,
  schema: applyAnswersSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const who = whoOf(session);
    const client = await sessionClient();
    const [collected, roster] = await Promise.all([
      readSeasonSignup(client, who.brandId, input.seasonId),
      getRoster(client, who.brandId, input.seasonId),
    ]);
    const merged = mergeIntoRoster(roster, collected.entries);
    const players = await replaceRoster(adminClient(), who, input.seasonId, merged.players);
    refresh();
    return { players, summary: mergeSummary(merged), skipped: merged.skipped };
  },
});

/**
 * Chases one person by email, through the provider interface the share invite uses. Without a
 * provider and its key nothing is sent, the answer says so, and the club copies the words instead.
 */
export const chaseByEmailAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageRosterSignup,
  schema: chaseByEmailSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const who = whoOf(session);
    const client = await sessionClient();
    const [collected, templates] = await Promise.all([readSeasonSignup(client, who.brandId, input.seasonId), readChaseTemplates(adminClient())]);
    const person = collected.requests.find((request) => request.id === input.requestId);
    const template = templateFor(templates, "email");
    if (!person || person.email === "") return { sent: false, note: NO_EMAIL_FOR_THEM };
    if (!template) return { sent: false, note: "No chase wording is set up. Tell us and we will put it in." };
    const message = chaseEmail(
      template,
      { player: person.name, club: session.brand.name, season: collected.seasonName, link: input.link },
      person.email,
      session.email,
    );
    const outcome = await inviteSender().send(message);
    return { sent: outcome.sent, note: outcome.sent ? null : outcome.reason, words: message.body };
  },
});

/** One player's shirt name, number and size, from someone with no account. */
export const rosterSignupAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.rosterSignupWrite,
  schema: rosterSignupSchema,
  handler: async ({ input }) => {
    const admin = adminClient();
    const taken = await takeAnswer(
      {
        hitLinkLimit: productionDeps.hitRateLimit,
        botCheck: (request) => verifyBotCheck({ ...request, send: fetch }),
        secret: turnstileSecret(getEnv()),
        address: await productionDeps.getClientAddress(),
        rule: LIMITS.rosterSignupWriteLink,
        open: (token) => openSignup(admin, token),
        zones: () => readZoneLimits(admin),
        screen: ({ brandId, text }) =>
          screenText(moderationDeps(null, "roster-signup"), { brandId, userId: null, text, context: "name" }),
        save: (answer) => submitSignup(admin, answer),
        visitorKey: await visitorKey(),
      },
      input,
    );
    return { name: taken.name, number: taken.number };
  },
});
