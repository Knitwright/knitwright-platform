/**
 * The settings and tables crest-to-kit works from (spec F-T2, plan v5 Z6, decision 0104).
 *
 * Nothing here is a literal buried in code: every limit, every feel and every rule id is a row in
 * this file, so the owner can change one without touching the engine, and every figure says whose
 * it is. No structural value appears here at all — a kit's options and parameters come only from
 * the base article's approved options and ranges (spec decision 5).
 */

/** Used where the rulebook has no entry for a rule this code applies. Listed on the pull request. */
export const GAP_RULE_ID = "R-GAP-000";

/** The label every seeded figure in this file carries, so no screen reads it as a factory's terms. */
export const SETTINGS_LABEL = "Knitwright default, taken from the specification and not agreed with a factory";

/**
 * The limits of crest intake. The file size and the colour count are the specification's own
 * figures (F-T2 step 1); the kit counts and the budget are its own too (F-T2 step 5). The rest are
 * Knitwright's defaults until the owner says otherwise.
 */
export const CREST_LIMITS = {
  /** "up to 10 MB" (spec F-T2 step 1). Tighter than artwork intake's 50 MB on purpose: a crest is small. */
  maxFileBytes: 10 * 1024 * 1024,
  /** "or pick up to 3 colours" (spec F-T2 step 1). */
  maxPickedColours: 3,
  /** How many colours a crest is read as. The palette gives fewer when the crest holds fewer. */
  readColours: 5,
  /** "6-9 complete kits" (spec F-T2 step 5). */
  minKits: 6,
  maxKits: 9,
  /** "In under 30 seconds" (spec F-T2 step 5): the budget the whole run is measured against. */
  budgetMs: 30_000,
  /** The longest a club name may be: the design name's own limit in Z5's `saveKitSchema`. */
  maxClubNameLength: 80,
} as const;

/** The four feels of spec F-T2 step 4. */
export const FEELS = ["classic", "modern", "bold", "plain"] as const;
export type FeelId = (typeof FEELS)[number];

/**
 * What a feel means, as data. A feel decides which template families are offered and how many of
 * the palette's colours a kit uses. It decides no measurement, no seam and no option the article
 * does not offer.
 */
export interface FeelDefinition {
  readonly id: FeelId;
  readonly label: string;
  /** One line under the choice, in the words a club secretary reads. */
  readonly hint: string;
  /** The template families this feel offers, in the order it prefers them (names from `families.ts`). */
  readonly families: readonly string[];
  /** How many colours of the palette a kit of this feel uses. Two is a main colour and a trim. */
  readonly colours: 2 | 3;
  /**
   * The catalogue code this feel prefers in each of the article's other option groups, by group
   * name. A code the article does not offer is simply not used: the engine never writes a code
   * that is not in the article's own list, so a preference here can never make an unmakeable kit.
   */
  readonly finish: Readonly<Record<string, string>>;
  /** Says whose definition this is. */
  readonly dataLabel: string;
}

export const FEEL_DEFINITIONS: readonly FeelDefinition[] = [
  {
    id: "classic",
    label: "Classic",
    hint: "The shapes a club has worn for a century, with a ribbed crew neck and a plain hem.",
    families: ["plain", "banded", "striped"],
    colours: 2,
    finish: { collar: "C01", sleeve_finish: "K01" },
    dataLabel: SETTINGS_LABEL,
  },
  {
    id: "modern",
    label: "Modern",
    hint: "A printed fade across the body, with a bound neck, in two or three of your colours.",
    families: ["panelled", "printed", "plain"],
    colours: 3,
    finish: { collar: "C03", sleeve_finish: "K01" },
    dataLabel: SETTINGS_LABEL,
  },
  {
    id: "bold",
    label: "Bold",
    hint: "Your colours set against each other, with a V-neck and ribbed cuffs.",
    families: ["diagonal", "striped", "banded"],
    colours: 3,
    finish: { collar: "C02", sleeve_finish: "K02" },
    dataLabel: SETTINGS_LABEL,
  },
  {
    id: "plain",
    label: "Plain",
    hint: "One colour, trimmed in your second. Nothing printed across the body.",
    families: ["plain"],
    colours: 2,
    finish: { collar: "C01", sleeve_finish: "K01" },
    dataLabel: SETTINGS_LABEL,
  },
];

export const feelById = (id: string | null | undefined): FeelDefinition =>
  FEEL_DEFINITIONS.find((feel) => feel.id === id) ?? FEEL_DEFINITIONS[0]!;

/** Which kits to propose: the three the spec names, or all three at once (spec F-T2 step 3). */
export const KIT_ROLES = ["home", "away", "gk"] as const;
export type KitRoleId = (typeof KIT_ROLES)[number];

export const ROLE_CHOICES = [...KIT_ROLES, "all"] as const;
export type RoleChoice = (typeof ROLE_CHOICES)[number];

export const ROLE_LABELS: Readonly<Record<RoleChoice, string>> = {
  home: "Home",
  away: "Away",
  gk: "Goalkeeper",
  all: "All three",
};

/** The roles a choice asks for. "all" asks for the three in the spec's order. */
export const rolesOf = (choice: RoleChoice): readonly KitRoleId[] => (choice === "all" ? KIT_ROLES : [choice]);

/**
 * The rulebook entries this workstream cites, each read from
 * `docs/spec/articles/JSY-SS-01/rulebook.md`. A check with no entry uses `GAP_RULE_ID` and is
 * listed on the pull request.
 */
export const RULES = {
  /** 150 DPI at 1:1, sRGB, not mirrored; "upload vector logos (SVG/PDF) where possible". The vectorise check. */
  printQuality: "R-SUB-003",
  /** Critical elements keep 15 mm away from a seam: why a crest sits in a slot and is never stretched over one. */
  crestPlacement: "R-SUB-004",
  /** Colours are checked against a printed strike-off, tolerance ΔE CMC(2:1) ≤ 1.5. */
  colourTolerance: "R-SUB-005",
  /** Only white polyester-rich fabric is sublimated, which is why a club colour is printed, not dyed. */
  sublimationFabric: "R-SUB-001",
  /** Full sublimation costs the same whether the design is plain or busy. */
  patternCost: "R-COST-001",
  /** Options add sewing time; their prices come from the factory profile. */
  optionCost: "R-COST-002",
  /** Names and numbers are printed in the same pass; their per-piece price is a placeholder. */
  personalisationCost: "R-COST-003",
} as const;
