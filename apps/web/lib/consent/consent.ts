import { z } from "zod";
import { MARKETING_OPT_IN } from "./wording";

/**
 * Consent to marketing email is kept as a list of events that is only ever added to: each
 * one says yes or no, when, where it was given and the words shown. The person's choice
 * is the latest event. No event at all means no: nobody is emailed until they said yes.
 *
 * Nothing here sends email. `canSendMarketing` is the one check any later sender must use.
 */

export type ConsentSource = "sign-up" | "settings" | "unsubscribe";

export type ConsentEvent = Readonly<{
  purpose: string;
  granted: boolean;
  /** An ISO time from the database. */
  createdAt: string;
  source: string;
  wordingVersion: string;
}>;

const MARKETING = "marketing_email";

const timeOf = (event: ConsentEvent): number => Date.parse(event.createdAt);

/**
 * The latest marketing event, or null when the person was never asked. When two events share
 * a moment, a no wins: when in doubt, do not email.
 */
export const currentMarketingChoice = (events: readonly ConsentEvent[]): ConsentEvent | null => {
  let latest: ConsentEvent | null = null;
  for (const event of events) {
    if (event.purpose !== MARKETING || Number.isNaN(timeOf(event))) continue;
    if (!latest || timeOf(event) > timeOf(latest) || (timeOf(event) === timeOf(latest) && !event.granted)) {
      latest = event;
    }
  }
  return latest;
};

/** Whether this person may be sent marketing email now. */
export const canSendMarketing = (events: readonly ConsentEvent[]): boolean => currentMarketingChoice(events)?.granted === true;

/** A choice is written only when it changes the answer, or is the first ever given. */
export const needsNewEvent = (events: readonly ConsentEvent[], granted: boolean): boolean => {
  const current = currentMarketingChoice(events);
  return current === null || current.granted !== granted;
};

const rowSchema = z.object({
  purpose: z.string(),
  granted: z.boolean(),
  created_at: z.string(),
  source: z.string(),
  wording_version: z.string(),
});

/** Reads rows of public.consent_events. A row of another shape is left out. */
export const consentEventsFrom = (rows: unknown): ConsentEvent[] =>
  (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) return [];
    const { purpose, granted, created_at, source, wording_version } = parsed.data;
    return [{ purpose, granted, createdAt: created_at, source, wordingVersion: wording_version }];
  });

/**
 * What the email sign-up path sends with the new account, as profile data. The database
 * records it when the account is made (private.record_signup_consent); see decision 0025.
 */
export const signupConsentData = (granted: boolean) => ({
  marketing_email: { granted, version: MARKETING_OPT_IN.version },
});
