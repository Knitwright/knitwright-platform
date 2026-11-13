/**
 * THE RETURNS POLICY AND PRODUCT SAFETY (spec F-L5 "Returns"; 09 screens 23 and 25 "GPSR").
 *
 * The returns policy is the brand's, per storefront, and is shown on every product page and before payment. Until
 * the brand writes its own, it starts from the spec's words, which are the platform's rule rather than legal advice
 * (the owner's legal review is still open, plan v6 "Owner-blocked").
 */

export const DEFAULT_RETURNS_POLICY = [
  "Made-to-order personalised items cannot be returned except for defects.",
  "Standard-size products follow UK and EU 14-day cancellation rights: tell us within 14 days of delivery and send the item back unworn.",
  "Defects are remade or refunded within 30 days: send us photos of the fault.",
].join("\n\n");

export const RETURNS_POLICY_MAX = 4000;

/** The policy's paragraphs, for the page. */
export const paragraphsOf = (policy: string): readonly string[] =>
  policy
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export type GpsrState = "done" | "needed";

export interface GpsrRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly state: GpsrState;
}

export interface GpsrFacts {
  /** The factory's name and country, as the factory rows hold them, or null when none is on file. */
  readonly factory: Readonly<{ name: string; country: string }> | null;
  readonly euResponsiblePerson: string | null;
}

export const EU_PERSON_NEEDED = "Needed to sell into the EU or Northern Ireland";

/** The "Filled in by Knitwright" table, with the EU responsible person the brand still owes. */
export function gpsrRows(facts: GpsrFacts): readonly GpsrRow[] {
  return [
    {
      id: "manufacturer",
      label: "Manufacturer",
      value: facts.factory ? `${facts.factory.name}, ${facts.factory.country}` : "Knitwright's partner factory (named when the factory profile is on file)",
      state: facts.factory ? "done" : "needed",
    },
    { id: "eu-person", label: "EU responsible person", value: facts.euResponsiblePerson ?? EU_PERSON_NEEDED, state: facts.euResponsiblePerson ? "done" : "needed" },
    { id: "safety", label: "Safety and care", value: "Fibre, care and origin labels come from the tech pack and are checked before every order", state: "done" },
  ];
}
