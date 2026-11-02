import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { cleanComment } from "@/lib/comments/text";
import { isShareToken } from "../token";
import {
  COMMITTEE_SLOTS,
  EMAIL_MAX,
  EMAIL_RULE,
  NAME_MAX,
  NAME_RULE,
  PIN_MAX,
  PIN_MM_MAX,
  PIN_RULE,
  POINT_RULE,
} from "./fields";

/**
 * What a committee page's forms may send (spec F-T3, plan v5 Z7, decision 0087).
 *
 * The pin's words go through the design-comment cleaner (`lib/comments/text.ts`, decision 0063)
 * rather than a second one of their own, and its point is the panel and the two distances in
 * millimetres a design comment already uses. A visitor is asked for a name; an email address is
 * offered and may be left empty.
 */

export * from "./fields";

const token = z.string().refine(isShareToken, "That link does not work.");

const CONTROL = /\p{Cc}/u;

const name = z
  .string(NAME_RULE)
  .trim()
  .min(1, NAME_RULE)
  .max(NAME_MAX, NAME_RULE)
  .refine((text) => !CONTROL.test(text), "Remove line breaks and hidden characters.");

/** Offered, never asked for. An empty field is no address at all, not a wrong one. */
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, EMAIL_RULE)
  .optional()
  .transform((text) => text ?? "")
  .refine((text) => text === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text), EMAIL_RULE)
  .transform((text) => (text === "" ? null : text));

/**
 * The words of a pin, cleaned exactly as a design comment's are, which includes its length: a pin
 * IS a design comment (decision 0063), so `COMMENT_MAX_LENGTH` is the only limit and `PIN_MAX` is
 * the same number for the field's own `maxLength`. `schemas.test.ts` fails if the two ever drift.
 */
const pinWords = z
  .string(PIN_RULE)
  .max(PIN_MAX * 5)
  .transform((raw, ctx) => {
    const cleaned = cleanComment(raw);
    if (!cleaned.ok) {
      ctx.addIssue({ code: "custom", message: cleaned.message });
      return z.NEVER;
    }
    return cleaned.text;
  });

const version = z.coerce.number().int().min(1).max(2_147_483_647);
const panelId = z.string(POINT_RULE).trim().regex(/^[a-z][a-z0-9-]{0,63}$/, POINT_RULE);
/** One tenth of a millimetre is as fine as a pin needs to be, and as fine as the column keeps. */
const mm = z.coerce
  .number(POINT_RULE)
  .min(0, POINT_RULE)
  .max(PIN_MM_MAX, POINT_RULE)
  .transform((value) => Math.round(value * 10) / 10);

const captcha = z
  .string("Complete the check to show you are a person.")
  .min(1, "Complete the check to show you are a person.")
  .max(4096);

/** A comment pinned to a point on a panel. */
export const committeePinSchema = z.object({
  token,
  name,
  version,
  panelId,
  xMm: mm,
  yMm: mm,
  body: pinWords,
  [CAPTCHA_FIELD]: captcha,
});
export type CommitteePinInput = z.output<typeof committeePinSchema>;

/** A vote on one of the options the link shows. */
export const committeeVoteSchema = z.object({
  token,
  name,
  slot: z.enum(COMMITTEE_SLOTS, "Choose one of the options."),
  [CAPTCHA_FIELD]: captcha,
});
export type CommitteeVoteInput = z.output<typeof committeeVoteSchema>;

const CHOOSE_ONE = "Choose which one you are approving.";

/**
 * An approval, given under a name, against one version. The version has a message of its own,
 * because a page showing more than one option starts with none of them chosen and a visitor who
 * presses Approve first must be told which field to look at.
 */
export const committeeApproveSchema = z.object({
  token,
  name,
  email: optionalEmail,
  version: z.coerce.number(CHOOSE_ONE).int(CHOOSE_ONE).min(1, CHOOSE_ONE).max(2_147_483_647),
  [CAPTCHA_FIELD]: captcha,
});
export type CommitteeApproveInput = z.output<typeof committeeApproveSchema>;

const projectId = z.uuid("That is not a design.");

/**
 * The versions a link shows. A form sends one field per version, and a form with exactly one of
 * them arrives as a single value rather than a list (`lib/server/core/create-define-action.ts`
 * reads `getAll`), so both shapes are taken and nothing missing is read as nothing chosen.
 */
const versions = z.preprocess(
  (raw) => (raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]),
  z
    .array(version)
    .min(1, "Choose at least one version to share.")
    .max(COMMITTEE_SLOTS.length, `A committee link shows up to ${COMMITTEE_SLOTS.length} versions.`)
    .refine((all) => new Set(all).size === all.length, "Each version can be shown once."),
);

/** The club making a link. F-T3: up to three versions, read only. */
export const createCommitteeLinkSchema = z.object({ projectId, versions });

export const committeeLinkSchema = z.object({ projectId, linkId: z.uuid("That is not a link.") });

/** The kit manager locking the version the committee approved. */
export const lockCommitteeVersionSchema = committeeLinkSchema.extend({ version });
