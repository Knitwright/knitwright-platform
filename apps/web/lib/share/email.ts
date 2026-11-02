import { ACCESS_LABELS, type ShareAccess } from "./invite-fields";

/**
 * Sending an invite (spec F-S4 Share, plan v5 Y8, decision 0081).
 *
 * Email is an interface with a deterministic stub, like every other provider in the platform.
 * **Without a provider and its key nothing is sent at all**: `noEmailSender` answers "not sent",
 * the invite is still made and the member is shown its link to send themselves, exactly as
 * decision 0026 has them send a share link today. Nothing claims an email went out unless a
 * provider took it, which is why the invite's `email_sent_at` is written only afterwards.
 *
 * No test and no local run reaches a real provider: the adapter exists only behind the key.
 */

export type InviteMessage = Readonly<{
  to: string;
  subject: string;
  /** Plain text. No pictures, no tracking, and the design's own link is the only link in it. */
  body: string;
  /** Where a reply goes: the member who invited them, when their address is known. */
  replyTo: string | null;
}>;

export type SendOutcome = Readonly<{ sent: true; provider: string }> | Readonly<{ sent: false; reason: string }>;

export interface EmailSender {
  /** The provider's own name, for the log and the panel. "none" where there is no provider. */
  readonly provider: string;
  send(message: InviteMessage): Promise<SendOutcome>;
}

export const NO_EMAIL_PROVIDER = "No email provider is set up, so we have not emailed anyone. Copy the invite link and send it yourself.";

/** What the platform does today: nothing is sent, and the member is told plainly. */
export const noEmailSender: EmailSender = {
  provider: "none",
  send: async () => ({ sent: false, reason: NO_EMAIL_PROVIDER }),
};

/** The stub the tests and the browser tests use. It keeps what it was given and reaches no network. */
export function recordingSender(provider = "stub"): EmailSender & { readonly sent: InviteMessage[] } {
  const sent: InviteMessage[] = [];
  return {
    provider,
    sent,
    send: async (message) => {
      sent.push(message);
      return { sent: true, provider };
    },
  };
}

export type InviteWords = Readonly<{
  to: string;
  /** The person who invited them, as they are known: a name, or their email address. */
  fromName: string;
  replyTo: string | null;
  brandName: string;
  designName: string;
  access: ShareAccess;
  /** The member's own words. May be empty. */
  message: string;
  /** The one-time address of the invite. */
  address: string;
}>;

/** What each access level lets the invited person do, in the words the email uses. */
const CAN_DO: Readonly<Record<ShareAccess, string>> = {
  view: "You can look at the design.",
  comment: "You can look at the design and leave a comment.",
  edit: "You can look at the design and change it. You need a Knitwright account for that.",
};

/**
 * The invite's words. They say who shared what and what the reader may do, and claim nothing about
 * the design itself: a shared design is work in progress, not a decided one.
 */
export function inviteMessage(words: InviteWords): InviteMessage {
  const lines = [
    `${words.fromName} shared a design with you on Knitwright.`,
    "",
    `Design: ${words.designName}`,
    `Shared by: ${words.brandName}`,
    `You are invited as: ${ACCESS_LABELS[words.access]}. ${CAN_DO[words.access]}`,
  ];
  if (words.message.trim().length > 0) lines.push("", `${words.fromName} wrote:`, words.message.trim());
  lines.push(
    "",
    "Open it here:",
    words.address,
    "",
    "The link works for you alone. It stops working when it runs out or when it is withdrawn.",
    "You were sent this because someone shared a design with you. We will not email you about anything else.",
  );
  return {
    to: words.to,
    subject: `${words.fromName} shared "${words.designName}" with you`,
    body: lines.join("\n"),
    replyTo: words.replyTo,
  };
}
