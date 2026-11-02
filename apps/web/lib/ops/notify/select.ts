import type { EmailSender, SendOutcome } from "@/lib/share/email";
import { resendSender } from "@/lib/share/email-server";

/**
 * Which provider sends a customer status email (decision 0100).
 *
 * The interface and the Resend adapter are the share invites' (`lib/share/email.ts` and `email-server.ts`), so
 * the platform has one email seam and one adapter. Only the words and the record are ops's own.
 *
 * **Without all three of OPS_EMAIL_PROVIDER, OPS_EMAIL_KEY and OPS_EMAIL_FROM nothing is sent**: the sender
 * answers "not sent" with a reason, the record keeps that reason, and ops is shown the words to send by hand.
 * No test and no local run reaches a provider: the adapter exists only behind the key, and the keys are never
 * set where tests run.
 */

export const OPS_NO_EMAIL_PROVIDER =
  "No email provider is set up, so nothing was emailed. Copy the words below and send them to the customer yourself.";

/** What the platform does today: nothing is sent, and ops is told plainly. */
export const noOpsEmailSender: EmailSender = {
  provider: "none",
  send: async (): Promise<SendOutcome> => ({ sent: false, reason: OPS_NO_EMAIL_PROVIDER }),
};

export type EmailEnv = Readonly<Record<string, string | undefined>>;

type Send = typeof fetch;

export function selectOpsSender(env: EmailEnv = process.env, send: Send = fetch): EmailSender {
  const provider = env.OPS_EMAIL_PROVIDER?.trim();
  const key = env.OPS_EMAIL_KEY?.trim();
  const from = env.OPS_EMAIL_FROM?.trim();
  if (provider !== "resend" || !key || !from) return noOpsEmailSender;
  return resendSender(key, from, send);
}

/** False while nothing can be sent at all, so a screen can say so before anyone presses anything. */
export const emailIsSetUp = (env: EmailEnv = process.env): boolean => selectOpsSender(env) !== noOpsEmailSender;
