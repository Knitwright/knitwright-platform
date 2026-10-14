/**
 * The choices of the organisation form, with their labels: types, Australian states and
 * countries. Kept apart from the zod schema (lib/leads/organisation.ts) so the form does not
 * ship zod to the browser.
 */

export const ORGANISATION_TYPES = [
  { id: "club", label: "Club" },
  { id: "school", label: "School" },
  { id: "brand", label: "Brand" },
  { id: "gym", label: "Gym or academy" },
  { id: "event", label: "Event or corporate" },
] as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[number]["id"];

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
