/**
 * The map from the garment registry's option keys to the base article catalogue's option codes
 * (plans/platform-v5.md section 6 item 3, decision 0099).
 *
 * The design object holds the registry's own words (`neckline: "crew"`, `cuffs: "rib-cuff"`); the catalogue holds
 * the codes a factory approved (`C01`, `K01`, `P00`). One row joins one registry choice to one catalogue code, and
 * it may only do so when a published source — the article's `article.json`, its `rulebook.md`, its `README.md`, its
 * 17-page tech pack or `ONBOARDING.md` — says the two are the same thing. Every such row quotes that source.
 *
 * Where nothing published joins them the row still exists and carries no code, so the gap is data a test and a
 * screen can read rather than something a reader has to notice is missing.
 */

/** What one row of the map says. */
export const MAPPING_KINDS = [
  /** A registry choice is one of the article's catalogue codes, and a published source says so. */
  "mapped",
  /** The catalogue carries this somewhere other than an option code (an article attribute, a parameter, or another
   * article altogether), so no code is owed. The source says where. */
  "not_an_option",
  /** No published source joins the two and the catalogue has no code for it yet. The tech pack says so plainly. */
  "no_code_yet",
] as const;

export type MappingKind = (typeof MAPPING_KINDS)[number];

/** One published source, quoted, so a test can check the quote is really in the file. */
export type Citation = Readonly<{
  /** The path from the repository root, as `docs/spec/articles/JSY-SS-01/rulebook.md`. */
  file: string;
  /** Text that appears in that file word for word. */
  quote: string;
}>;

/** One row of the map. */
export type OptionCodeMapping = Readonly<{
  articleCode: string;
  /** The registry's own option key (`neckline`), or null for a catalogue group no registry key feeds. */
  registryKey: string | null;
  /** The registry choice this row is about, or null when it holds for every choice of the key. */
  registryChoice: string | null;
  /** The catalogue option group (`collar`, `sleeve_finish`), or null where the catalogue has no group for the key. */
  optionGroup: string | null;
  /** The catalogue code, or null for every row that is not `mapped`. */
  optionCode: string | null;
  kind: MappingKind;
  /** Empty for `no_code_yet`, and at least one quote for every other kind. */
  sources: readonly Citation[];
  /** Where the catalogue carries it instead, or what is missing. Null for a `mapped` row. */
  note: string | null;
  /** The rulebook rule behind the row, or `R-GAP-000` while none is written (plan v5, "Every rule explains itself"). */
  ruleId: string;
}>;
