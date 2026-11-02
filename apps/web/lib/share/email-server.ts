import "server-only";
import { getEnv } from "@/lib/config/env";
import { noEmailSender, type EmailSender, type InviteMessage, type SendOutcome } from "./email";

/**
 * Which email provider sends an invite, read from the settings (plan v5 Y8, decision 0081).
 *
 * **Without `SHARE_EMAIL_PROVIDER` and its key, nothing is sent**: the member is shown the invite's
 * link and sends it themselves, as decision 0026 has them send a share link today. No test and no
 * local run reaches a provider: the only adapter here is Resend's HTTP API, which is called only
 * when both settings are set, and the settings are refused where tests run.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type Send = typeof fetch;

/** Resend's HTTP API. One request, no SDK, so nothing new is added to the dependency list. */
export function resendSender(key: string, from: string, send: Send): EmailSender {
  return {
    provider: "resend",
    send: async (message: InviteMessage): Promise<SendOutcome> => {
      try {
        const response = await send(RESEND_ENDPOINT, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.body,
            ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
          }),
        });
        if (!response.ok) return { sent: false, reason: "The email provider would not take the message. Copy the invite link and send it yourself." };
        return { sent: true, provider: "resend" };
      } catch {
        return { sent: false, reason: "We could not reach the email provider. Copy the invite link and send it yourself." };
      }
    },
  };
}

/** The sender the invite action uses: the configured provider, or none at all. */
export function inviteSender(): EmailSender {
  const env = getEnv();
  if (env.SHARE_EMAIL_PROVIDER !== "resend" || !env.SHARE_EMAIL_KEY || !env.SHARE_EMAIL_FROM) return noEmailSender;
  return resendSender(env.SHARE_EMAIL_KEY, env.SHARE_EMAIL_FROM, fetch);
}
