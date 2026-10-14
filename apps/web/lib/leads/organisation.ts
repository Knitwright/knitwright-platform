import { z } from "zod";

/**
 * Who a brand is (Platform and Store Guide, page 9: asked for when a design is saved): the type
 * of organisation, the country, and a state for Australia or a region elsewhere. Every detail is
 * optional. The database checks the same rules (migrations 20261011010000 and 20261011050000).
 */

export const ORGANISATION_TYPES = [
  { id: "club", label: "Club" },
  { id: "school", label: "School" },
  { id: "brand", label: "Brand" },
  { id: "gym", label: "Gym or academy" },
  { id: "event", label: "Event or corporate" },
] as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[number]["id"];

const TYPE_IDS = ORGANISATION_TYPES.map((type) => type.id) as [OrganisationType, ...OrganisationType[]];

export const organisationTypeLabel = (id: string | null): string =>
  ORGANISATION_TYPES.find((type) => type.id === id)?.label ?? "Not given";

export const AU_STATES = [
  { id: "ACT", label: "Australian Capital Territory" },
  { id: "NSW", label: "New South Wales" },
  { id: "NT", label: "Northern Territory" },
  { id: "QLD", label: "Queensland" },
  { id: "SA", label: "South Australia" },
  { id: "TAS", label: "Tasmania" },
  { id: "VIC", label: "Victoria" },
  { id: "WA", label: "Western Australia" },
] as const;

/** ISO 3166-1 two-letter codes. */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS " +
  "BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE " +
  "EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM " +
  "HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC " +
  "LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA " +
  "NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO " +
  "TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);
const regionNames = new Intl.DisplayNames(["en-AU"], { type: "region" });

export const countryName = (code: string): string => regionNames.of(code) ?? code;

export type CountryOption = Readonly<{ id: string; label: string }>;

let countries: readonly CountryOption[] | null = null;

/**
 * Every country by name, Australia first. Built once, on the server, and handed to the forms as
 * a prop: the browser's own country names differ from the server's ("Antigua & Barbuda" against
 * "Antigua and Barbuda"), so naming them in the browser broke hydration.
 */
export const countryOptions = (): readonly CountryOption[] => {
  if (countries) return countries;
  const others = COUNTRY_CODES.filter((code) => code !== "AU")
    .map((code) => Object.freeze({ id: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  countries = Object.freeze([Object.freeze({ id: "AU", label: countryName("AU") }), ...others]);
  return countries;
};

/** "Australia, NSW", "United Kingdom", or "Not given". */
export const placeOf = (country: string | null, region: string | null): string => {
  if (!country) return "Not given";
  return region ? `${countryName(country)}, ${region}` : countryName(country);
};

export const REGION_MAX = 80;
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
