import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { cleanName } from "@/lib/orders/text";
import { isShareToken } from "@/lib/share/token";
import { WEARER_GROUPS } from "../wording";
import { PASTE_MAX, RAW_NAME_MAX } from "./fields";

/**
 * What the sign-up forms may send (spec F-T4, plan v5 Z7, decision 0087).
 *
 * The shirt name goes through the same cleaner a roster and a team order use (decision 0027), so a
 * name that reaches a shirt is cleaned once in one place. The length against the zone and the
 * number against the sport are NOT checked here: both are rows, read on the server, and the checks
 * live in `zones.ts` and `numbers.ts` so neither can be a literal in a schema.
 */

export * from "./fields";

const token = z.string().refine(isShareToken, "That link does not work.");

const captcha = z
  .string("Complete the check to show you are a person.")
  .min(1, "Complete the check to show you are a person.")
  .max(4096);

const shirtName = z
  .string("Enter the name you want on your shirt.")
  .max(RAW_NAME_MAX)
  .transform((raw, ctx) => {
    const cleaned = cleanName(raw);
    if (!cleaned.ok) {
      ctx.addIssue({ code: "custom", message: cleaned.message });
      return z.NEVER;
    }
    if (cleaned.name === "") {
      ctx.addIssue({ code: "custom", message: "Enter the name you want on your shirt." });
      return z.NEVER;
    }
    return cleaned.name;
  });

/** What a player sends. The digits are kept as typed, so "07" stays "07". */
export const rosterSignupSchema = z.object({
  token,
  name: shirtName,
  number: z.string("Enter your number.").trim().min(1, "Enter your number."),
  sizeLabel: z.string("Choose a size.").trim().min(1, "Choose a size.").max(16, "Choose a size."),
  wearerGroup: z.enum(WEARER_GROUPS, "Choose which cut you want."),
  [CAPTCHA_FIELD]: captcha,
});
export type RosterSignupInput = z.output<typeof rosterSignupSchema>;

const seasonId = z.uuid("That is not a season.");

/** The kit manager making the season's link. The sport decides the number range. */
export const createSignupLinkSchema = z.object({
  seasonId,
  sport: z.string("Choose a sport.").trim().regex(/^[a-z][a-z0-9-]{1,30}$/, "Choose a sport."),
});

export const signupLinkSchema = z.object({ seasonId, linkId: z.uuid("That is not a link.") });

/** The pasted list. The lines are read by `paste.ts`; this only caps what may arrive. */
export const pasteListSchema = z.object({
  seasonId,
  list: z.string("Paste your squad, one name per line.").max(PASTE_MAX, "That list is too long to read."),
});

/** Folding the answers into the season's roster. */
export const applyAnswersSchema = z.object({ seasonId });

/**
 * Chasing one person on the list by email. WhatsApp needs no action at all: it is a `wa.me`
 * address the screen builds from the same words.
 *
 * The link is carried in the form because a token is shown to the club once and never stored
 * (decision 0026): the server cannot look it up again. Only an address of this site, of the shape
 * this server makes, is accepted, so a club cannot be made to send a player somewhere else.
 */
export const chaseByEmailSchema = z.object({
  seasonId,
  requestId: z.uuid("That is not someone on your list."),
  link: z
    .string("Make the sign-up link first, then chase.")
    .trim()
    .max(2048)
    .regex(/\/join\/[A-Za-z0-9_-]{43}$/, "That is not a sign-up link from this page."),
});
