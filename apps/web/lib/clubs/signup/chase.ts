import type { InviteMessage } from "@/lib/share/email";

/**
 * Chasing a player who has not answered (spec F-T4 step 4 "chase stragglers by WhatsApp link or
 * email", plan v5 Z7, decision 0086).
 *
 * WhatsApp needs no API and no account: a `wa.me` address with the words already written opens the
 * person's own WhatsApp, and the club presses send themselves. Email goes through the provider
 * interface the share invite already uses (`lib/share/email.ts`), which sends nothing at all until
 * a provider and its key are set; no test and no local run reaches a provider.
 *
 * The words are rows of `chase_templates`, not strings in this file, so the wording can change
 * without a deploy and so WhatsApp and email say the same thing.
 */

export interface ChaseTemplate {
  readonly id: string;
  readonly channel: "whatsapp" | "email";
  /** Empty for WhatsApp, which has no subject. */
  readonly subject: string;
  readonly body: string;
  readonly note: string;
}

export interface ChaseWords {
  readonly player: string;
  readonly club: string;
  readonly season: string;
  readonly link: string;
}

/** The only four things a template may name. Anything else in a row is left as it is written. */
export function fillTemplate(text: string, words: ChaseWords): string {
  return text
    .replaceAll("{player}", words.player)
    .replaceAll("{club}", words.club)
    .replaceAll("{season}", words.season)
    .replaceAll("{link}", words.link);
}

/** Only digits and a leading plus reach an address, so nothing a club pasted can change it. */
export const phoneDigits = (phone: string): string => phone.replace(/[^0-9]/g, "");

/**
 * The address that opens WhatsApp with the words ready to send. A number with no digits has no
 * address: the club is shown the words to copy instead, which the screen does.
 */
export function whatsAppAddress(template: ChaseTemplate, words: ChaseWords, phone: string): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(fillTemplate(template.body, words))}`;
}

/** The chase as an email, in the shape the provider interface takes. */
export function chaseEmail(template: ChaseTemplate, words: ChaseWords, to: string, replyTo: string | null): InviteMessage {
  return {
    to,
    subject: fillTemplate(template.subject, words),
    body: fillTemplate(template.body, words),
    replyTo,
  };
}

/** The template of one channel, or null when no row covers it. Nothing is guessed. */
export const templateFor = (templates: readonly ChaseTemplate[], channel: ChaseTemplate["channel"]): ChaseTemplate | null =>
  templates.find((template) => template.channel === channel) ?? null;

/** What the club is told when the person they pressed has no email address on the list. */
export const NO_EMAIL_FOR_THEM = "There is no email address on your list for them. Add one, or chase them on WhatsApp.";

/** What the screen shows beside a player the club has no way of reaching. */
export const NO_WAY_TO_REACH = "No phone number or email address on your list for them. Add one, or send them the link yourself.";
