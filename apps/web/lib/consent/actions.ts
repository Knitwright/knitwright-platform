"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { marketingChoiceSchema, unsubscribeSchema } from "./schemas";
import { setMarketingChoice, unsubscribe } from "./service";
import { unsubscribeSigningKey } from "./signing";

/** The box in Settings. Writes a new record only when the answer changes. */
export const setMarketingConsentAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.changeConsent,
  schema: marketingChoiceSchema,
  handler: async ({ input, session }) => {
    await setMarketingChoice({ client: await sessionClient(), admin: adminClient(), userId: session.userId, granted: input.granted });
    revalidatePath("/settings");
    return { granted: input.granted };
  },
});

/**
 * The button on the unsubscribe page, opened from a link in an email. No sign-in: the signed
 * token names the person. Honoured at once. Rate limited per address; no bot check, because
 * a link only this server can sign is needed and all it can do is stop email.
 */
export const unsubscribeAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.unsubscribe,
  schema: unsubscribeSchema,
  handler: async ({ input }) => {
    await unsubscribe({ admin: adminClient(), token: input.token, key: unsubscribeSigningKey() });
    return { done: true };
  },
});
