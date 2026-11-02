import type { BaseArticle } from "@/lib/catalogue";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { SECTION_IDS, SECTION_TITLES, type SectionId } from "@/lib/techpack/types";
import { ruleForGap, type GapKind } from "./rules";

/**
 * The tech pack templates of `docs/spec/07-template-library.md`: a page set and default fields per
 * base article, one per base article (plan v5 L8, decision 0098).
 *
 * A page is in an article's page set only when the article's own data can fill it, and a page that
 * cannot be filled is reported as a gap naming what is missing and the rulebook entry that explains
 * it. **Nothing is filled in.** Seven of the eight launch articles publish no point of measure and no
 * block (decision 0090), so their templates are mostly refusals, and that is the correct output: a
 * tech pack that states a measurement nobody has taken is cut in a factory.
 *
 * No measurement is copied here either. Where an article has a point-of-measure table, the template
 * names the letters and codes its pages have, never a value: the values belong to the article.
 */

/** What a page needs from the article before it can be filled. `always` needs nothing. */
type Need = GapKind | "always";

const SECTION_NEEDS: Readonly<Record<SectionId, Need>> = {
  cover: "always",
  readiness: "always",
  flats: "drawing",
  measurements: "poms",
  "how-to-measure": "poms",
  "pattern-and-cutting": "pattern",
  components: "always",
  fabric: "fabric",
  construction: "construction",
  colourways: "always",
  artwork: "drawing",
  "artwork-and-colour": "drawing",
  operations: "construction",
  labelling: "always",
  suggested: "always",
  "sign-off": "always",
};

/** What is missing when a page cannot be filled, in words for the person reading the template. */
const MISSING: Readonly<Record<GapKind, string>> = {
  poms: "no point of measure with a value and a tolerance from the factory",
  pattern: "no block and no master pattern on file, so nothing is drafted",
  construction: "no construction table, seam allowance or thread on file",
  drawing: "no garment type in the editor, so there is no drawing to put on the page",
  fabric: "no fabric on file",
};

/** True when the article's own data can fill a page with this need. */
const met = (article: BaseArticle, need: Need): boolean => {
  if (need === "always") return true;
  if (need === "drawing") return article.registryTypeId !== null;
  if (need === "poms") return article.poms.length > 0;
  if (need === "pattern") return article.seamAllowances !== null;
  if (need === "construction") return article.construction.length > 0;
  return article.fabrics.length > 0;
};

/** One thing a tech pack template cannot fill, with the rule that explains it. */
export interface TechpackGap {
  readonly section: SectionId;
  readonly sectionTitle: string;
  readonly missing: string;
  readonly ruleId: string;
}

export interface SeedTechpack {
  readonly slug: string;
  readonly baseArticleCode: string;
  readonly title: string;
  /** The pages this article's pack has, in the tech pack's own order. */
  readonly sections: readonly SectionId[];
  /** The fields the pack fills from the article's own row. Never a measurement. */
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly gaps: readonly TechpackGap[];
  readonly label: string;
}

const gap = (section: SectionId, kind: GapKind, code: string): TechpackGap => ({
  section,
  sectionTitle: SECTION_TITLES[section],
  missing: MISSING[kind],
  ruleId: ruleForGap(code, kind),
});

/**
 * The one open item on a page that is otherwise filled: owner decision 10 of plan v5 says an article
 * cannot be sold until the factory's own signed master pattern is on file, and none is for any article. No
 * entry of any rulebook says it, so it carries the gap rule id and is listed in the pull request.
 */
const NO_MASTER_PATTERN: TechpackGap = {
  section: "pattern-and-cutting",
  sectionTitle: SECTION_TITLES["pattern-and-cutting"],
  missing: "no master pattern from the factory on file, so the pattern on the page is a Knitwright draft",
  ruleId: GAP_RULE_ID,
};

/** The fields the template fills from the article's row. A value the article does not have is left out. */
function defaultsFor(article: BaseArticle): Record<string, unknown> {
  const present = <T>(key: string, value: T | null): Record<string, T> => (value === null ? {} : { [key]: value });
  const some = <T>(key: string, values: readonly T[]): Record<string, readonly T[]> => (values.length === 0 ? {} : { [key]: values });
  return {
    base_article: article.code,
    name: article.name,
    article_type: article.articleType,
    production_class: article.productionClass,
    status: article.status,
    ...present("fit", article.fit),
    ...present("hs_code", article.hsCode),
    ...present("origin", article.origin),
    ...present("sample_size", article.sampleSize),
    ...present("registry_type", article.registryTypeId),
    ...some("genders", article.genders),
    ...some("size_range", article.sizeRange),
    ...some("sport_tags", article.sportTags),
    ...some("fabric_codes", article.fabrics.map((fabric) => fabric.code)),
    // The letters and codes of the points of measure the pages have. No value: a value belongs to the article.
    ...some("pom_letters", article.poms.map((pom) => `${pom.letter} ${pom.code}`)),
    ...some("construction_steps", article.construction.map((step) => step.seam)),
  };
}

export function buildTechpackTemplate(article: BaseArticle): SeedTechpack {
  const sections = SECTION_IDS.filter((id) => met(article, SECTION_NEEDS[id]));
  const gaps = SECTION_IDS.flatMap((id) => {
    const need = SECTION_NEEDS[id];
    return need === "always" || met(article, need) ? [] : [gap(id, need, article.code)];
  });
  return {
    slug: `techpack-${article.code.toLowerCase()}`,
    baseArticleCode: article.code,
    title: `Tech pack pages for ${article.name}`,
    sections,
    defaults: defaultsFor(article),
    gaps: sections.includes("pattern-and-cutting") ? [...gaps, NO_MASTER_PATTERN] : gaps,
    label: article.dataLabel,
  };
}

/** One template per base article, in the order the catalogue gives them. */
export const buildTechpackTemplates = (articles: readonly BaseArticle[]): readonly SeedTechpack[] => articles.map(buildTechpackTemplate);

/** The row `template_techpacks` stores. */
export const techpackRowOf = (template: SeedTechpack) => ({
  slug: template.slug,
  base_article_code: template.baseArticleCode,
  title: template.title,
  sections: [...template.sections],
  defaults: template.defaults,
  gaps: template.gaps.map((entry) => ({ section: entry.section, section_title: entry.sectionTitle, missing: entry.missing, rule_id: entry.ruleId })),
  label: template.label,
  source: "knitwright",
});
