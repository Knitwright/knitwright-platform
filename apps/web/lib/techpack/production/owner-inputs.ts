import type { OwnerInputNote, ReadinessLine } from "./types";

/**
 * Items of the "Ready for the factory" list that wait on the owner (plans/production-outputs.md, section 7, P1 to P17).
 * An open item says plainly that it is open, what is needed, and what is used until then. P11 (whether the Platform and
 * Store Guide supersedes the 2026-09-27 decisions) and P17 (a paid converter for AI files) hold up no item of this list.
 */
interface Entry {
  readonly codes: readonly string[];
  readonly needed: string;
  readonly until: string;
}

const PATTERN_REVIEW: Entry = {
  codes: ["P1"],
  needed: "a pattern technician reviews each pattern block (the pattern library keeps the review record)",
  until: 'every pattern and print file says "Draft pattern, not reviewed."',
};
const PATTERNS: Entry = {
  codes: ["P2", "P3"],
  needed: "patterns for products Knitwright cannot draft yet, and Australian size charts with the pattern size each label is cut from",
  until: 'the pattern library slot says "No pattern yet", and size labels use starter values shown as suggested',
};
const FABRIC_TEST: Entry = {
  codes: ["P4"],
  needed: "a fabric test for each base fabric from the mill or print house: stretch, recovery and sublimation shrink at the press settings",
  until: "the values stay not set, the print scale is 1.0, and every print file says in its margin that it is not scaled for shrink",
};
const PRINT_PROFILE: Entry = {
  codes: ["P5"],
  needed: "the print house gives its colour profile (ICC file), dpi, maximum print width, bleed and the colours that sublimate badly",
  until: "150 dpi and 15 mm bleed are used and labelled Knitwright default, no colour profile is embedded, and the list of colours to avoid is empty and says so",
};

export const OWNER_INPUTS: Readonly<Record<string, Entry>> = {
  "pattern-present": PATTERNS,
  "pattern-review": PATTERN_REVIEW,
  "fabric-test": FABRIC_TEST,
  "fabric-reduction": FABRIC_TEST,
  "fabric-use-basis": {
    codes: ["P9"],
    needed: "the factory gives its marker efficiency and the usable width of the fabric",
    until: "fabric use is worked out with the default efficiency, labelled as a default, and replaced when a marker or the factory gives one",
  },
  "print-profile": PRINT_PROFILE,
  "print-avoid-colours": PRINT_PROFILE,
  "print-colour-codes": {
    codes: ["P6", "P15"],
    needed: "whether Knitwright licenses a Pantone library, and whether the codes are TCX or TPG",
    until: "no Pantone data is shipped, factory codes are what a person types and are shown as typed, and screen colours are labelled screen only",
  },
  "print-image-dpi": {
    codes: ["P14"],
    needed: "the print house gives its lowest resolution for photographs and for line art, and the file types it accepts",
    until: "150 dpi is used as the warning level and labelled Knitwright default",
  },
  "print-picture-read": {
    codes: ["P12", "P13", "P16"],
    needed: "the owner approves the wording on user pictures going to the vision and image providers, supplies real example pictures, and sets the price cap per picture",
    until: 'reading a picture stays behind a switch that is off, the screen says "close reading" and makes no claim about quality, and a low daily cap per brand applies',
  },
  "league-rules": {
    codes: ["P7"],
    needed: "the league or competition rules for the clubs targeted: number heights, digits, contrast and sleeve badges",
    until: 'no rule set is used, and the list says "No league rules set: check with the competition."',
  },
  "proof-strike-off": {
    codes: ["P10"],
    needed: "the owner names who signs for pattern, print, production and the club",
    until: "a sign-off record accepts any member of the brand with a role typed in",
  },
};

/** The note for an item, or null when the item is met or does not wait on the owner. */
export function ownerInputFor(itemId: string, met: boolean): OwnerInputNote | null {
  const entry = OWNER_INPUTS[itemId];
  if (met || entry === undefined) return null;
  const codes = entry.codes.join(" and ");
  return { ...entry, sentence: `Open owner input ${codes}: ${entry.needed}. Until then: ${entry.until}.` };
}

export const withOwnerInput = <T extends { readonly id: string; readonly met: boolean }>(line: T): T & Pick<ReadinessLine, "ownerInput"> => ({
  ...line,
  ownerInput: ownerInputFor(line.id, line.met),
});
