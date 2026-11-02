import { z } from "zod";
import { SWATCH_PATTERN } from "@/lib/garment";
import { SPORTS } from "@/lib/teamwear/vocabulary";
import { CREST_LIMITS, FEELS, ROLE_CHOICES } from "./settings";

/**
 * What the crest-to-kit screen asks for (spec F-T2 steps 1 to 4), and what the server may be sent.
 *
 * The sport is one of Z5's own list, never a garment type: the server reads the registry type and
 * the base article from it, so a hand-written form cannot ask for a garment the configurator does
 * not offer. The colours are checked against the platform's own swatch pattern. Nothing structural
 * arrives from the browser at all: the fills, the finishes and the parameters are chosen by the
 * engine from the base article's own rows.
 */

const swatch = z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.");

/** A repeated form field, which arrives as one string or as several. Z5's own reading of one. */
const repeated = z
  .union([z.string(), z.array(z.string()).max(CREST_LIMITS.maxPickedColours)])
  .optional()
  .transform((value) => (value === undefined ? [] : typeof value === "string" ? [value] : value));

export const intakeSchema = z.object({
  sportId: z.enum(SPORTS.map((sport) => sport.id) as [string, ...string[]]),
  roles: z.enum(ROLE_CHOICES),
  feel: z.enum(FEELS),
  /** Optional: "Optionally enter the club name" (spec F-T2 step 2). */
  clubName: z
    .string()
    .trim()
    .max(CREST_LIMITS.maxClubNameLength)
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  /** Up to three colours the club picked, when it picked colours instead of uploading a crest. */
  colour: repeated,
});

export type IntakeInput = Readonly<{
  sportId: string;
  roles: (typeof ROLE_CHOICES)[number];
  feel: (typeof FEELS)[number];
  clubName: string | null;
  colours: readonly string[];
}>;

export type IntakeOutcome = Readonly<{ ok: true; input: IntakeInput }> | Readonly<{ ok: false; errors: readonly string[] }>;

/** Said where neither a crest nor a colour was given: the one thing that fills this screen. */
export const NOTHING_GIVEN = "Upload your crest, or pick up to three of your colours. Knitwright needs one or the other to build kits.";

/** Said where a picked colour is not a colour. */
export const BAD_COLOUR = "One of those colours could not be read. Pick it again from the swatches.";

/**
 * The intake as the engine needs it, or what is wrong with the form. A crest and picked colours can
 * both be given: the crest wins, and the picked colours are not used, because the crest's own
 * colours are the ones the kits are matched against.
 */
export function readIntake(form: unknown, hasCrest: boolean): IntakeOutcome {
  const parsed = intakeSchema.safeParse(form);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  const colours = parsed.data.colour.map((value) => value.toLowerCase());
  const bad = colours.filter((value) => !swatch.safeParse(value).success);
  if (bad.length > 0) return { ok: false, errors: [BAD_COLOUR] };
  if (!hasCrest && colours.length === 0) return { ok: false, errors: [NOTHING_GIVEN] };
  return {
    ok: true,
    input: {
      sportId: parsed.data.sportId,
      roles: parsed.data.roles,
      feel: parsed.data.feel,
      clubName: parsed.data.clubName,
      colours: colours.slice(0, CREST_LIMITS.maxPickedColours),
    },
  };
}
