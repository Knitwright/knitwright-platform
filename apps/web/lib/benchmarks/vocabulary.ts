/**
 * The fixed words of benchmarks (plans/platform-v5.md Z3, spec F-S2, decision 0084). The database checks the same
 * lists, so a value the code does not know cannot be stored.
 */

/** Where a card's intake came from. A URL is fetched once; a photo is the user's own upload; review text is pasted. */
export const SOURCE_KINDS = ["url", "photo", "review_text"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * How we know a field (spec F-S2 step 4): `observed` is stated on the page or in the pasted words, `inferred` is read
 * out of a picture, `unknown` is not known. An inferred value is never shown as a fact (lib/benchmarks/card.ts).
 */
export const PROVENANCES = ["observed", "inferred", "unknown"] as const;
export type Provenance = (typeof PROVENANCES)[number];

/** The rule id a finding carries while the rulebook has no entry for it (plan v5, "Every rule explains itself"). */
export const RULE_GAP = "R-GAP-000";

/**
 * 2 to 5 cards side by side (spec F-S2 step 5). They live here rather than beside the schema so a form can show the
 * limit without pulling zod into the browser (tests/architecture/client-weight.test.ts).
 */
export const MIN_COMPARE = 2;
export const MAX_CARDS = 5;

/** The gaps this workstream opens. They are listed in the PR comment, as the plan asks. */
export const BENCHMARK_RULE_GAPS = [
  "R-GAP-000 benchmark feature mapping: which of a competitor's features a base article may be asked for",
  "R-GAP-000 design-around: how close a silhouette and a surface layout may come to a benchmark",
] as const;

/**
 * What a feature is. Only a `functional` feature may be carried onto a design (spec F-S2 step 6); a `graphic` feature
 * is a logo, a brand name or a print and is never carried over at all (spec F-G1).
 */
export const FEATURE_KINDS = ["functional", "decorative", "graphic"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

/**
 * How a feature is looked for in a base article's own catalogue rows (lib/catalogue): an option group, the words an
 * option's label or code holds, or a parameter key. The catalogue holds the data; these are only the search words, and
 * they are a Knitwright draft, not reviewed by a factory.
 */
type CatalogueHint = Readonly<{ optionGroup?: string; words?: readonly string[]; parameterKey?: string }>;

export type Feature = Readonly<{
  key: string;
  label: string;
  kind: FeatureKind;
  /** What it does for the wearer, in Knitwright's words. Shown beside the mapping. */
  purpose: string;
  catalogue?: CatalogueHint;
}>;

/**
 * Knitwright's construction taxonomy for benchmarks, built from the features the spec names (F-S2 step 3). Labelled a
 * Knitwright draft, like every other seeded default in this plan.
 */
export const FEATURES: readonly Feature[] = [
  { key: "gusset", label: "Gusset", kind: "functional", purpose: "Frees the stride at the crotch.", catalogue: { optionGroup: "panel", words: ["gusset"] } },
  { key: "flatlock_seams", label: "Flatlock seams", kind: "functional", purpose: "A flat seam that does not rub.", catalogue: { optionGroup: "seam", words: ["flatlock"] } },
  { key: "bonded_hem", label: "Bonded hem", kind: "functional", purpose: "A hem with no stitch line.", catalogue: { optionGroup: "hem", words: ["bonded"] } },
  { key: "mesh_venting", label: "Mesh venting", kind: "functional", purpose: "Lets heat out where the body is hottest.", catalogue: { optionGroup: "fabric_panel", words: ["mesh"] } },
  { key: "hidden_key_pocket", label: "Hidden key pocket", kind: "functional", purpose: "Holds a key out of sight.", catalogue: { optionGroup: "pocket", words: ["key", "hidden"] } },
  { key: "zip_back_pocket", label: "Zip back pocket", kind: "functional", purpose: "A pocket that closes.", catalogue: { optionGroup: "pocket", words: ["zip"] } },
  { key: "silicone_waist_gripper", label: "Silicone waist gripper", kind: "functional", purpose: "Stops the waistband sliding.", catalogue: { optionGroup: "waistband", words: ["silicone", "gripper"] } },
  { key: "drop_tail", label: "Drop tail", kind: "functional", purpose: "A longer back hem.", catalogue: { parameterKey: "back_drop_tail" } },
  { key: "raglan_sleeve", label: "Raglan sleeve", kind: "functional", purpose: "A sleeve seam that runs to the neck.", catalogue: { optionGroup: "sleeve", words: ["raglan"] } },
  { key: "set_in_sleeve", label: "Set-in sleeve", kind: "functional", purpose: "A sleeve seamed at the shoulder.", catalogue: { optionGroup: "sleeve", words: ["set-in", "set in"] } },
  { key: "side_split", label: "Side split", kind: "functional", purpose: "Opens the side hem for stride.", catalogue: { optionGroup: "hem", words: ["split"] } },
  { key: "reflective_trim", label: "Reflective trim", kind: "functional", purpose: "Shows up in headlights.", catalogue: { optionGroup: "trim", words: ["reflective"] } },
  { key: "liner", label: "Inner liner", kind: "functional", purpose: "A second layer inside.", catalogue: { optionGroup: "liner", words: ["liner", "2-in-1"] } },
  { key: "drawcord", label: "Drawcord", kind: "functional", purpose: "Pulls the waist in.", catalogue: { optionGroup: "waistband", words: ["drawcord", "cord"] } },
  { key: "elastic_waistband", label: "Elastic waistband", kind: "functional", purpose: "Holds the waist without a cord.", catalogue: { optionGroup: "waistband", words: ["elastic"] } },
  { key: "thumb_loops", label: "Thumb loops", kind: "functional", purpose: "Keeps a sleeve over the hand.", catalogue: { optionGroup: "cuff", words: ["thumb"] } },
  { key: "mock_neck", label: "Mock neck", kind: "functional", purpose: "A short standing collar.", catalogue: { optionGroup: "collar", words: ["mock"] } },
  { key: "half_zip", label: "Half zip", kind: "functional", purpose: "Opens the neck.", catalogue: { optionGroup: "collar", words: ["zip"] } },
  { key: "crew_neck", label: "Crew neck", kind: "functional", purpose: "A round neck.", catalogue: { optionGroup: "collar", words: ["crew", "rib"] } },
  { key: "inseam_length", label: "Inseam length", kind: "functional", purpose: "How long the leg is.", catalogue: { parameterKey: "inseam" } },
  { key: "body_length", label: "Body length", kind: "functional", purpose: "How long the body is.", catalogue: { parameterKey: "body_length_offset" } },
  { key: "colour_blocking", label: "Colour blocking", kind: "decorative", purpose: "Panels in different colours." },
  { key: "stripes", label: "Stripes", kind: "decorative", purpose: "A striped surface." },
  { key: "brand_logo", label: "Brand logo", kind: "graphic", purpose: "The seller's own mark." },
  { key: "brand_name", label: "Brand name", kind: "graphic", purpose: "The seller's own name." },
  { key: "all_over_print", label: "All-over print", kind: "graphic", purpose: "The seller's own artwork." },
] as const;

export const FEATURE_KEYS: readonly string[] = FEATURES.map((f) => f.key);

export const featureOf = (key: string): Feature | undefined => FEATURES.find((f) => f.key === key);

/**
 * Where a surface element sits, and what it is. This is the only thing a benchmark keeps about a competitor's
 * artwork: that something of a kind sits in a zone. No picture, no shape, no wording (spec F-S2 "Stored"). The
 * design-around check reads it (lib/benchmarks/design-around.ts).
 */
export const LAYOUT_ZONES = [
  "front",
  "back",
  "left_chest",
  "right_chest",
  "sleeve",
  "shoulder",
  "side_panel",
  "hem",
  "collar",
  "waistband",
] as const;
export type LayoutZone = (typeof LAYOUT_ZONES)[number];

export const LAYOUT_KINDS = ["block", "stripe", "gradient", "mesh", "mark", "text"] as const;
export type LayoutKind = (typeof LAYOUT_KINDS)[number];

/** The label every seeded benchmark default carries, as the plan asks. */
export const DRAFT_LABEL = "Knitwright draft v0.1, not reviewed by a factory";

/** The user agent every benchmark fetch sends (spec F-S2 step 2, plan Z3). */
export const BENCHMARK_USER_AGENT = "KnitwrightBenchmark/1.0 (+https://knitwright.com/bot)";

/** The name the fetch answers to in robots.txt, lower case. */
export const BENCHMARK_ROBOTS_NAME = "knitwrightbenchmark";
