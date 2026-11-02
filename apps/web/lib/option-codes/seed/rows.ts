import type { Citation, OptionCodeMapping } from "../types";

/**
 * THE MAP ITSELF, as the seed of `public.option_code_map` (decision 0099). `seed/sql.ts` writes these rows into
 * the migration `20261201040000_option_code_map.sql` and `seed/sql.test.ts` fails if the two drift apart, exactly
 * as the catalogue seeds its own approved options (`lib/catalogue/seed/sql.ts`). The app reads the rows, never this
 * file.
 *
 * **Nothing here is a guess.** A row joins a registry choice to a catalogue code only where a published file says
 * the two are the same thing, and it quotes that file word for word; `rows.test.ts` reads every cited file and
 * fails if a quote is not in it. Where nothing published joins them the row says `no_code_yet`, carries no code and
 * names the gap, and the tech pack then says plainly that the catalogue has no code for the option yet.
 *
 * Only `JSY-SS-01` is mapped, because it is the only article with options: the other seven launch articles are
 * seeded with no option codes at all (each one's own `article.json` holds none, decision 0090), so there is nothing
 * to join them to.
 */

const JSY = "docs/spec/articles/JSY-SS-01";
const ARTICLE_JSON = `${JSY}/article.json`;
const RULEBOOK = `${JSY}/rulebook.md`;
const README = `${JSY}/README.md`;
const TECHPACK = `${JSY}/techpack/JSY-SS-01_techpack.html`;
const ONBOARDING = "docs/spec/articles/ONBOARDING.md";

const GAP_RULE = "R-GAP-000";
const ARTICLE_CODE = "JSY-SS-01";

const cite = (file: string, quote: string): Citation => ({ file, quote });

/** The published line that describes the whole garment, which names every feature it has. */
const PAGE_ONE = cite(TECHPACK, "Short sleeve, set-in sleeve, crew neck (C01), straight hem");
const ARTICLE_NAME = cite(ARTICLE_JSON, '"name": "Short-sleeve sublimated jersey, set-in sleeve, regular fit"');
const DEFAULTS_DRAFTED = cite(README, "Only the default options are drafted (crew neck C01, hem K01, no parameter offsets).");

type Row = Omit<OptionCodeMapping, "articleCode">;

/** A registry choice that **is** one of the article's catalogue codes. */
const mapped = (
  registryKey: string,
  registryChoice: string,
  optionGroup: string,
  optionCode: string,
  ruleId: string,
  sources: readonly Citation[],
): Row => ({ registryKey, registryChoice, optionGroup, optionCode, kind: "mapped", sources, note: null, ruleId });

/** A registry choice the catalogue carries somewhere other than an option code, so no code is owed. */
const elsewhere = (
  registryKey: string,
  registryChoice: string | null,
  note: string,
  sources: readonly Citation[],
  ruleId: string = GAP_RULE,
): Row => ({ registryKey, registryChoice, optionGroup: null, optionCode: null, kind: "not_an_option", sources, note, ruleId });

/** A registry choice, or a catalogue group, that nothing published joins to a code. */
const noCodeYet = (registryKey: string | null, registryChoice: string | null, optionGroup: string | null, note: string): Row => ({
  registryKey,
  registryChoice,
  optionGroup,
  optionCode: null,
  kind: "no_code_yet",
  sources: [],
  note,
  ruleId: GAP_RULE,
});

/**
 * `JSY-SS-01`, short-sleeve sublimated jersey. Its registry types are `football-shirt` and `team-jersey`
 * (`lib/catalogue/registry-map.ts`), and between them they ask nine questions: fit, neckline, collar, placket,
 * sleeve type, sleeve length, hem shape, side panels and cuffs. Every one of them has a row here.
 */
const JSY_SS_01: readonly Row[] = [
  // --- The two registry keys the catalogue has codes for. ---
  mapped("neckline", "crew", "collar", "C01", "R-CON-004", [
    DEFAULTS_DRAFTED,
    PAGE_ONE,
    cite(ARTICLE_JSON, '"code": "C01", "name": "Crew neck, 1x1 rib, 20 mm finished", "default": true'),
    cite(RULEBOOK, "Collar C01 | 1x1 rib, 20 mm finished, joined at CB, attached with overlock"),
  ]),
  mapped("neckline", "v-neck", "collar", "C02", "R-CON-005", [
    cite(RULEBOOK, "Collar C02 | V-neck with 15 mm self-fabric binding and a mitred V"),
    cite(RULEBOOK, "V-neck C02 uses a 140 mm front drop"),
    cite(ARTICLE_JSON, '"code": "C02", "name": "V-neck, self-fabric binding 15 mm, mitred V, front drop 140 mm"'),
  ]),
  mapped("cuffs", "none", "sleeve_finish", "K01", "R-CON-007", [
    cite(RULEBOOK, "Hems K01, body | 2-needle coverstitch (ISO 406), 6.4 mm gauge; sleeve 20 mm, body 25 mm"),
    DEFAULTS_DRAFTED,
    cite(ARTICLE_JSON, '"code": "K01", "name": "Coverstitch hem, 20 mm", "default": true'),
  ]),
  mapped("cuffs", "rib-cuff", "sleeve_finish", "K02", "R-CON-008", [
    cite(RULEBOOK, "Cuff K02 | 1x1 rib cuff, 25 mm finished"),
    cite(RULEBOOK, "Rib cuffs (K02), V-neck (C02) and drop tail add sewing time"),
    cite(ARTICLE_JSON, "Neck rib (C01) or cuffs (K02)"),
  ]),

  // --- Registry keys the catalogue carries as something other than an option code. ---
  elsewhere(
    "fit",
    null,
    "Fit is an article attribute, not an option code: this article is one fit, and the catalogue holds it on the article row (base_articles.fit, 'regular'). A design asking for another fit is a validation matter, not a missing code.",
    [ARTICLE_NAME, cite(RULEBOOK, "Regular fit: chest half 520 mm at M, grading 30 mm per size, tolerance ±10 mm")],
    "R-FIT-001",
  ),
  elsewhere(
    "sleeve-type",
    null,
    "The article is a set-in sleeve by definition, named in the article's own name, its tech pack's first page and its construction table. A raglan jersey is a different block, not an option of this one.",
    [ARTICLE_NAME, PAGE_ONE, cite(ARTICLE_JSON, "sleeve set in flat before side seams")],
    "R-CON-001",
  ),
  elsewhere(
    "sleeve-length",
    null,
    "The article is the short-sleeve jersey; the long-sleeve one is its own article, JSY-LS-01. Sleeve length picks the article, not an option code.",
    [ARTICLE_NAME, PAGE_ONE, cite(ONBOARDING, "Long-sleeve jersey / goalkeeper")],
  ),
  elsewhere(
    "collar",
    "none",
    "This article has no collar: the published description of the whole garment names a crew neck and no collar, and the catalogue group called 'collar' is the neck finish (C01 to C03). So 'no collar' is what the article already is, and no code is owed for it.",
    [PAGE_ONE, cite(ARTICLE_JSON, '"code": "C01", "name": "Crew neck, 1x1 rib, 20 mm finished", "default": true')],
    "R-CON-004",
  ),
  elsewhere(
    "placket",
    "none",
    "This article has no placket: the published description of the whole garment names every feature it has and no placket among them. So 'no placket' is what the article already is.",
    [PAGE_ONE],
  ),
  elsewhere(
    "side-panels",
    "none",
    "This article has no side panels: the published description of the whole garment names every feature it has and no side panel among them.",
    [PAGE_ONE],
  ),
  elsewhere(
    "hem-shape",
    "straight",
    "The article's hem is straight, named on the tech pack's first page and in the hem width point of measure.",
    [PAGE_ONE, cite(ARTICLE_JSON, "Hem width, half (straight body)")],
    "R-FIT-001",
  ),
  elsewhere(
    "hem-shape",
    "curved",
    "A hem that drops at the back is carried as the parameter back_drop_tail (0 to 40 mm), not as an option code, so the package reports it as a parameter and not as a code.",
    [
      cite(RULEBOOK, "The back hem can curve down by up to 40 mm at centre back"),
      cite(README, "The V-neck, rib cuff and drop tail are drafted once the base is approved."),
    ],
    "R-PAT-005",
  ),

  // --- The gaps. Nothing published joins these to a code, so none is written. ---
  noCodeYet(
    "collar",
    "band-collar",
    null,
    "No published source names a catalogue code for a band collar on this article. The catalogue group called 'collar' is the neck finish (C01 to C03), not a stand collar, so the registry's band collar has no code to map to.",
  ),
  noCodeYet("placket", "buttons", null, "No published source names a catalogue code for a buttoned placket on this article."),
  noCodeYet("placket", "zip", null, "No published source names a catalogue code for a zipped placket on this article."),
  noCodeYet(
    "side-panels",
    "contrast-insert",
    null,
    "No published source names a catalogue code for a contrast side panel on this article.",
  ),
  noCodeYet(
    "hem-shape",
    "side-vent",
    null,
    "No published source names a catalogue code, or a parameter, for a side-vented hem on this article.",
  ),
  noCodeYet(
    null,
    null,
    "pattern_fill",
    "No registry option key records the garment's pattern: a design's pattern is drawn as artwork layers, so no registry choice maps to P00, P01 or P02. The package reports the article's own default and labels it as coming from the base.",
  ),
];

/** Every row of the map, article by article, in a fixed order, so the same source always gives the same seed. */
export const OPTION_CODE_MAP_SEED: readonly OptionCodeMapping[] = JSY_SS_01.map((row) => ({ ...row, articleCode: ARTICLE_CODE }));

/** The files the rows quote, so a test can read each one once. */
export const CITED_FILES: readonly string[] = [...new Set(OPTION_CODE_MAP_SEED.flatMap((row) => row.sources.map((source) => source.file)))].sort();
