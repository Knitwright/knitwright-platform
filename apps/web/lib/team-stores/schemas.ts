import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { cleanName } from "@/lib/orders/text";
import { MARGIN_BPS, MAX_PIECES_PER_ORDER } from "./constants";

/**
 * What the team store forms may send (plan v6 C2, decision 0153). The club's forms send the store's choices; a
 * buyer's form sends only who they are and, per piece, a size and a shirt name and number. No form sends a price:
 * the server and the database work every amount out from the store's own row.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const openStoreSchema = z
  .object({
    projectId: z.uuid(),
    title: z.string().trim().min(1, "Give the store a name.").max(80, "A store's name is up to 80 characters.").regex(/^[^\p{C}]*$/u, "Use letters, digits and punctuation only."),
    marginBps: z.coerce.number().int().refine((bps) => (MARGIN_BPS as readonly number[]).includes(bps), "Choose 0, 5, 10, 15 or 20%."),
    minPieces: z.coerce.number().int("A minimum is a whole number of pieces.").min(1, "A minimum is at least 1 piece.").max(10_000),
    sizes: z.array(z.string().trim().min(1).max(16)).min(1, "Choose at least one size.").max(30),
    namesNumbers: z.boolean(),
    seasonId: z.uuid().nullable(),
    opensOn: day,
    closesOn: day,
  })
  .refine((input) => input.closesOn >= input.opensOn, { path: ["closesOn"], message: "A store closes on or after the day it opens." });
export type OpenStoreInput = z.output<typeof openStoreSchema>;

/** The store opens at the start of its first day (or now, when that is today) and closes at the end of its last. */
export function windowOf(input: Pick<OpenStoreInput, "opensOn" | "closesOn">, now: Date): Readonly<{ opensAt: string; closesAt: string }> {
  const opens = new Date(`${input.opensOn}T00:00:00.000Z`);
  return {
    opensAt: (opens.getTime() < now.getTime() ? now : opens).toISOString(),
    closesAt: new Date(`${input.closesOn}T23:59:59.000Z`).toISOString(),
  };
}

export const endStoreSchema = z.object({ storeId: z.uuid(), how: z.enum(["close", "cancel"]) });

export const projectStoresSchema = z.object({ projectId: z.uuid() });

export const clubPageSchema = z.object({
  slug: z.string().trim().toLowerCase().min(3, "An address is 3 to 40 characters.").max(40, "An address is 3 to 40 characters."),
  contact: z.string().trim().max(300, "Up to 300 characters.").regex(/^[^\p{C}]*$/u, "Use one line of text."),
  published: z.preprocess((value) => value === true || value === "on" || value === "true", z.boolean()),
});

const shirtName = z
  .string()
  .max(60)
  .transform((raw, ctx) => {
    const cleaned = cleanName(raw);
    if (!cleaned.ok) {
      ctx.addIssue({ code: "custom", message: cleaned.message });
      return z.NEVER;
    }
    return cleaned.name.toUpperCase();
  });

const line = z.object({
  size: z.string().trim().min(1, "Choose a size.").max(16),
  name: shirtName.default(""),
  number: z.string().trim().max(3, "A number is up to 3 digits.").default(""),
});

/** The pieces, sent as one JSON field by the buyer's form. */
const linesField = z
  .string("Add a piece first.")
  .max(4000)
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Add a piece first." });
      return z.NEVER;
    }
  })
  .pipe(z.array(line).min(1, "Add a piece first.").max(MAX_PIECES_PER_ORDER, `One order is up to ${MAX_PIECES_PER_ORDER} pieces.`));

export const buySchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{10}$/, "That store does not exist."),
  requestKey: z.uuid(),
  buyerName: z.string("Enter your name.").trim().min(1, "Enter your name.").max(80, "Up to 80 characters.").regex(/^[^\p{C}]*$/u, "Use letters, spaces and punctuation only."),
  buyerEmail: z.email("Enter an email address for your receipt.").trim().toLowerCase().max(254),
  lines: linesField,
  [CAPTCHA_FIELD]: z.string("Complete the check to show you are a person.").min(1, "Complete the check to show you are a person.").max(4096),
});
export type BuyFormInput = z.output<typeof buySchema>;

export const testPaySchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{10}$/),
  sessionId: z.string().max(80),
  outcome: z.enum(["paid", "expired"]),
});
