"use server";

import { revalidatePath } from "next/cache";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { verifyBotCheck } from "@/lib/share/turnstile";
import { accessRequestSchema, keepAccessRequest, loggingAccessNotifier, saveAccessRequest } from "./access";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { leadFormSchema, quoteStatusFormSchema } from "./admin";
import { loggingQuoteNotifier } from "./notify";
import { organisationDetailsSchema } from "./organisation";
import { quoteRequestSchema } from "./quote";
import { requestQuote, setBrandDetails, setLead, setQuoteStatus } from "./service";

/**
 * The lead engine's actions (decision 0024). A member's actions take the brand from the session
 * or from the design, never from the form. The admin actions run as the signed-in person, and
 * the database refuses anyone who is not a platform admin, with the same answer as a missing page.
 */

// No mail sender exists yet (owner action A4). See lib/leads/notify.ts.
const notifyTeam = loggingQuoteNotifier(log);
const notifyAccess = loggingAccessNotifier(log);

/**
 * Someone with no account asks for access while sign-up is by invitation. Limited per address,
 * guarded by the bot check, and kept by the database. The answer is the same for a new address
 * and one that has asked before.
 */
export const requestAccessAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.requestAccess,
  schema: accessRequestSchema,
  handler: async ({ input }) => {
    await keepAccessRequest(
      {
        botCheck: (request) => verifyBotCheck({ ...request, send: fetch }),
        secret: turnstileSecret(getEnv()),
        address: await productionDeps.getClientAddress(),
        save: (request) => saveAccessRequest(adminClient(), request),
        notify: notifyAccess,
      },
      input,
    );
    return { email: input.email };
  },
});

/** Sets the organisation type, country and state or region of the brand the user is working in. */
export const saveBrandDetailsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeBrand,
  schema: organisationDetailsSchema,
  handler: async ({ input, session }) => {
    // Pages that show the details read them on every request. Nothing is refreshed here, so a
    // form shown beside a design keeps its "saved" message instead of vanishing.
    await setBrandDetails(await sessionClient(), session.brand.id, input);
    return input;
  },
});

/** Asks the Knitwright team for a quote on one version of a design. */
export const requestQuoteAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.requestQuote,
  schema: quoteRequestSchema,
  handler: async ({ input, session }) => {
    const id = await requestQuote(adminClient(), { ...input, userId: session.userId });
    await notifyTeam({
      quoteId: id,
      brandId: session.brand.id,
      projectId: input.projectId,
      version: input.version,
      quantity: input.quantity,
      neededBy: input.neededBy,
    });
    revalidatePath(`/studio/${input.projectId}`);
    revalidatePath(`/studio/${input.projectId}/tech-pack`);
    return { id };
  },
});

/** Sets who owns a lead and its next step. Platform admins only. */
export const setLeadAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: leadFormSchema,
  handler: async ({ input }) => {
    await setLead(await sessionClient(), input);
    revalidatePath("/admin/leads");
    return { brandId: input.brandId };
  },
});

/** Changes a quote request's status. Platform admins only. */
export const setQuoteStatusAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: quoteStatusFormSchema,
  handler: async ({ input }) => {
    await setQuoteStatus(await sessionClient(), input);
    revalidatePath("/admin/leads");
    return { status: input.status };
  },
});
