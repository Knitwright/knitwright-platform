import { z } from "zod";
import {
  AU_STATES,
  COUNTRY_CODES,
  ORGANISATION_TYPES,
  REGION_MAX,
  countryName,
  countryOptions,
  organisationTypeLabel,
  placeOf,
  type CountryOption,
  type OrganisationType,
} from "./organisation-options";

export {
  AU_STATES,
  COUNTRY_CODES,
  ORGANISATION_TYPES,
  REGION_MAX,
  countryName,
  countryOptions,
  organisationTypeLabel,
  placeOf,
  type CountryOption,
  type OrganisationType,
};

/**
 * Who a brand is (Platform and Store Guide, page 9: asked for when a design is saved): the type
 * of organisation, the country, and a state for Australia or a region elsewhere. Every detail is
 * optional. The database checks the same rules (migrations 20261011010000 and 20261011050000).
 */

const TYPE_IDS = ORGANISATION_TYPES.map((type) => type.id) as [OrganisationType, ...OrganisationType[]];
const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);
const CONTROL_CHARACTER = /\p{Cc}/u;

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToNull, schema.nullable().default(null));

export const organisationDetailsSchema = z
  .object({
    organisationType: optional(z.enum(TYPE_IDS, "Choose a type of organisation.")),
    country: optional(
      z.string().trim().toUpperCase().refine((code) => COUNTRY_SET.has(code), "Choose a country from the list."),
    ),
    region: optional(
      z
        .string()
        .trim()
        .max(REGION_MAX, `Keep it under ${REGION_MAX} characters.`)
        .refine((text) => !CONTROL_CHARACTER.test(text), "Remove line breaks and hidden characters."),
    ),
  })
  .superRefine((details, context) => {
    if (details.region === null) return;
    if (details.country === null) {
      context.addIssue({ code: "custom", path: ["region"], message: "Choose a country first." });
    } else if (details.country === "AU" && !AU_STATES.some((state) => state.id === details.region)) {
      context.addIssue({ code: "custom", path: ["region"], message: "Choose a state or territory." });
    }
  });

export type OrganisationDetails = z.output<typeof organisationDetailsSchema>;

export type DetailName = keyof OrganisationDetails;

const NONE: OrganisationDetails = { organisationType: null, country: null, region: null };

/**
 * Details read back from the database. A stored detail the form would refuse is treated as not
 * given, so one odd value never takes down the pages that show it; the others are kept. A region
 * goes with a country it does not fit, so this can take up to three passes.
 */
export function storedDetails(stored: Readonly<Record<DetailName, string | null>>): OrganisationDetails {
  let input: Record<string, string> = {
    organisationType: stored.organisationType ?? "",
    country: stored.country ?? "",
    region: stored.region ?? "",
  };
  for (let pass = 0; pass < 3; pass += 1) {
    const result = organisationDetailsSchema.safeParse(input);
    if (result.success) return result.data;
    const refused = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    input = Object.fromEntries(Object.entries(input).map(([name, value]) => [name, refused.has(name) ? "" : value]));
  }
  return NONE;
}

/** The details a brand has not given yet. */
export const missingDetails = (details: OrganisationDetails): DetailName[] =>
  (["organisationType", "country", "region"] as const).filter((name) => details[name] === null);
