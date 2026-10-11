import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { consentEventsFrom, needsNewEvent, type ConsentEvent, type ConsentSource } from "./consent";
import { verifyUnsubscribe } from "./unsubscribe-token";
import { MARKETING_OPT_IN, MARKETING_UNSUBSCRIBE, type Wording } from "./wording";

/**
 * Reading and writing consent records. Writes go through public.record_consent with the
 * server's own key, after the caller has identified the person: from their session, or from
 * a signed unsubscribe link. The database takes the words from its own table by version.
 */

type Recorded = Readonly<{ admin: SupabaseClient; userId: string; granted: boolean; wording: Wording; source: ConsentSource }>;

/** Writes one choice. Answers whether a row was written (a repeat sign-up choice is not). */
export const recordConsent = async ({ admin, userId, granted, wording, source }: Recorded): Promise<boolean> => {
  const { data, error } = await admin.rpc("record_consent", {
    p_user_id: userId,
    p_purpose: wording.purpose,
    p_granted: granted,
    p_wording_version: wording.version,
    p_source: source,
  });
  if (error) throw new Error("The email choice could not be saved.", { cause: error });
  return data === true;
};

/** The signed-in person's own marketing choices. Row level security limits it to theirs. */
export const loadMarketingEvents = async (client: SupabaseClient): Promise<ConsentEvent[]> => {
  const { data, error } = await client
    .from("consent_events")
    .select("purpose, granted, created_at, source, wording_version")
    .eq("purpose", MARKETING_OPT_IN.purpose)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("The email choice could not be read.", { cause: error });
  return consentEventsFrom(data);
};

/** The choice from Settings. Writes a row only when it changes the answer. */
export const setMarketingChoice = async (
  input: Readonly<{ client: SupabaseClient; admin: SupabaseClient; userId: string; granted: boolean }>,
): Promise<boolean> => {
  if (!needsNewEvent(await loadMarketingEvents(input.client), input.granted)) return false;
  return recordConsent({ admin: input.admin, userId: input.userId, granted: input.granted, wording: MARKETING_OPT_IN, source: "settings" });
};

/**
 * Stops marketing email for the person a signed link names, at once. Every request is
 * recorded, so the record shows each time someone asked. A link for an account that has since
 * been deleted succeeds too: there is no one left to email.
 */
export const unsubscribe = async (input: Readonly<{ admin: SupabaseClient; token: string; key: Buffer }>): Promise<void> => {
  const verified = verifyUnsubscribe(input.token, input.key);
  if (!verified.ok) throw new AppError("invalid_input", verified.reason);
  await recordConsent({ admin: input.admin, userId: verified.userId, granted: false, wording: MARKETING_UNSUBSCRIBE, source: "unsubscribe" });
};
