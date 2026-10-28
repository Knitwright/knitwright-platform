import { z } from "zod";
import { cleanName } from "@/lib/orders/text";
import { KIT_FONTS, SPONSORS_MAX } from "./wording";

/**
 * The club kit: what a club wears and who pays for it. Nothing is guessed: a colour nobody chose is
 * null. Only the bundled font (Geist) can be chosen for names and numbers until more are bundled.
 */

const colour = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #0b3d91.")
  .nullable();

const sponsorName = z
  .string()
  .max(120)
  .transform((raw, ctx) => {
    const cleaned = cleanName(raw);
    if (!cleaned.ok || cleaned.name.length < 1 || cleaned.name.length > 40) {
      ctx.addIssue({ code: "custom", message: "A sponsor name is 1 to 40 letters, digits, spaces or ' - . &." });
      return z.NEVER;
    }
    return cleaned.name;
  });

const sponsorSchema = z.object({ name: sponsorName, logoFileId: z.uuid().nullable() }).readonly();
export type Sponsor = z.output<typeof sponsorSchema>;

export const kitSchema = z
  .object({
    primaryColour: colour,
    secondaryColour: colour,
    accentColour: colour,
    crestFileId: z.uuid().nullable(),
    sponsors: z.array(sponsorSchema).max(SPONSORS_MAX, `A kit holds up to ${SPONSORS_MAX} sponsors.`).readonly(),
    nameFont: z.enum(KIT_FONTS),
    numberFont: z.enum(KIT_FONTS),
  })
  .readonly();
export type Kit = z.output<typeof kitSchema>;

/** A club with no kit saved yet: nothing chosen. */
export const EMPTY_KIT: Kit = {
  primaryColour: null,
  secondaryColour: null,
  accentColour: null,
  crestFileId: null,
  sponsors: [],
  nameFont: "geist",
  numberFont: "geist",
};

const kitRow = z.object({
  primary_colour: z.string().nullable(),
  secondary_colour: z.string().nullable(),
  accent_colour: z.string().nullable(),
  crest_file_id: z.string().nullable(),
  sponsors: z.unknown(),
  name_font: z.string(),
  number_font: z.string(),
});

/** A kit as the database holds it. A row that no longer fits the rules reads as no kit rather than breaking the page. */
export function kitFromRow(row: unknown): Kit {
  const parsedRow = kitRow.safeParse(row);
  if (!parsedRow.success) return EMPTY_KIT;
  const r = parsedRow.data;
  const sponsors = z.array(z.object({ name: z.string(), logoFileId: z.string().nullable() })).safeParse(r.sponsors ?? []);
  const kit = kitSchema.safeParse({
    primaryColour: r.primary_colour,
    secondaryColour: r.secondary_colour,
    accentColour: r.accent_colour,
    crestFileId: r.crest_file_id,
    sponsors: sponsors.success ? sponsors.data : [],
    nameFont: r.name_font,
    numberFont: r.number_font,
  });
  return kit.success ? kit.data : EMPTY_KIT;
}

export const hasAnyKit = (kit: Kit): boolean =>
  kit.primaryColour !== null || kit.secondaryColour !== null || kit.accentColour !== null || kit.crestFileId !== null || kit.sponsors.length > 0;
