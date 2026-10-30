import { z } from "zod";
import { DEFAULT_LINK_DAYS, LINK_DAYS } from "./fields";
import { EMAIL_MAX, LINK_AUDIENCES, MESSAGE_MAX, SHARE_ACCESS } from "./invite-fields";

/**
 * What a share invite's forms may send (spec F-S4 Share, plan v5 Y8, decision 0081).
 *
 * An invite is an email address, what that person may do, and the member's own words. Its token is
 * made and stored exactly as a share link's is: 256 random bits, hashed in the database, shown to
 * the member once. Nothing here sends an email; `lib/share/email.ts` does that, and without a
 * provider key nothing is sent at all.
 *
 * The words, limits and lists the popover shows are in `lib/share/invite-fields.ts`, which this
 * module re-exports for the server. A client component imports them from there, never from here,
 * so zod stays out of the browser (`tests/architecture/client-weight.test.ts`).
 */

export * from "./invite-fields";

const projectId = z.uuid("That is not a design.");

const EMAIL_RULE = "Enter an email address.";

/**
 * The address is kept lower case and trimmed, as the database keeps it, so one person cannot be
 * invited twice under two spellings.
 */
const email = z
  .string(EMAIL_RULE)
  .trim()
  .toLowerCase()
  .min(3, EMAIL_RULE)
  .max(EMAIL_MAX, EMAIL_RULE)
  .refine((text) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text), EMAIL_RULE);

/** Hidden characters other than a line break or a tab, as the share response schema refuses them. */
const CONTROL_BUT_LINES = /(?![\n\r\t])\p{Cc}/u;

const message = z
  .string()
  .trim()
  .max(MESSAGE_MAX, `Keep the message to ${MESSAGE_MAX} characters.`)
  .refine((text) => !CONTROL_BUT_LINES.test(text), "Remove hidden characters.")
  .optional()
  .transform((text) => text ?? "");

export const createShareInviteSchema = z.object({
  projectId,
  email,
  access: z.enum(SHARE_ACCESS, "Choose Can view, Can comment or Can edit."),
  message,
  days: z.enum(LINK_DAYS, "Choose 7, 30 or 90 days.").default(DEFAULT_LINK_DAYS).transform(Number),
});

export const revokeShareInviteSchema = z.object({ projectId, inviteId: z.uuid("That is not an invite.") });

export const linkAudienceSchema = z.object({
  projectId,
  linkId: z.uuid("That is not a link."),
  audience: z.enum(LINK_AUDIENCES, "Choose who may open the link."),
});
