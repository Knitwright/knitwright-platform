import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { isShareToken } from "./token";

/** Limits on what a visitor writes. The database enforces the same ones. */
export const NAME_MAX = 60;
export const COMMENT_MAX = 1000;

/** How long a link may last, in days. The database accepts only these. */
export const LINK_DAYS = ["7", "30", "90"] as const;
export const DEFAULT_LINK_DAYS = "30";

const projectId = z.uuid("That is not a design.");

export const createShareLinkSchema = z.object({
  projectId,
  days: z.enum(LINK_DAYS, "Choose 7, 30 or 90 days.").default(DEFAULT_LINK_DAYS).transform(Number),
});

/** Revoking a link, or moving it to the newest version. The design is named so its page can be refreshed. */
export const shareLinkSchema = z.object({
  projectId,
  linkId: z.uuid("That is not a link."),
});

const CONTROL = /\p{Cc}/u;
/** Hidden characters other than a line break or a tab. */
const CONTROL_BUT_LINES = /(?![\n\r\t])\p{Cc}/u;

const NAME_RULE = `Enter your name, up to ${NAME_MAX} characters.`;
const NEITHER = "Choose a vote, write a comment, or both.";

const name = z
  .string(NAME_RULE)
  .trim()
  .min(1, NAME_RULE)
  .max(NAME_MAX, NAME_RULE)
  .refine((text) => !CONTROL.test(text), "Remove line breaks and hidden characters.");

const vote = z
  .enum(["yes", "not_yet", ""], "Choose Yes or Not yet.")
  .optional()
  .transform((value) => (value === "yes" || value === "not_yet" ? value : null));

const comment = z
  .string()
  .trim()
  .max(COMMENT_MAX, `Keep a comment to ${COMMENT_MAX} characters.`)
  .refine((text) => !CONTROL_BUT_LINES.test(text), "Remove hidden characters.")
  .optional()
  .transform((text) => (text ? text : null));

const captcha = z
  .string("Complete the check to show you are a person.")
  .min(1, "Complete the check to show you are a person.")
  .max(4096);

/** What a visitor sends from a share page. No email address is asked. */
export const shareResponseSchema = z
  .object({
    token: z.string().refine(isShareToken, "That link does not work."),
    name,
    vote,
    comment,
    [CAPTCHA_FIELD]: captcha,
  })
  .refine((answer) => answer.vote !== null || answer.comment !== null, { message: NEITHER, path: ["vote"] });

export type ShareResponseInput = z.output<typeof shareResponseSchema>;
export type ShareVote = "yes" | "not_yet";
