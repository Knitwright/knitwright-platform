import type { BaseArticle } from "@/lib/catalogue";
import { feelById, type FeelId } from "./settings";

/**
 * The template families of spec F-T2 step 3 ("palette × template family × feel"), as data.
 *
 * A FAMILY IS A CATALOGUE CODE, NOT A PICTURE. The base article's `pattern_fill` option group is
 * the factory's own list of the fills it prints — `P00` plain, `P01` vertical stripes, `P02`
 * diagonal gradient on JSY-SS-01 — and a family here is one of those codes with the words a club
 * reads. That is what makes a proposed kit manufacturable by construction (spec decision 5): the
 * only families offered are the ones whose code the article offers, so the engine cannot propose a
 * fill the factory has not listed, and the card shows the very code the factory will read.
 *
 * A family the catalogue has no code for yet is listed in `MISSING_FAMILIES` and never offered. It
 * is the honest answer: the spec's own examples name bands and panels, and no base article carries
 * a code for either.
 */

export const FAMILIES = ["plain", "banded", "striped", "diagonal", "panelled", "printed"] as const;
export type FamilyId = (typeof FAMILIES)[number];

/** The option group of the base article a family chooses in. The catalogue's own group name. */
export const FILL_GROUP = "pattern_fill";

export interface TemplateFamily {
  readonly id: FamilyId;
  readonly label: string;
  /** One line under the card, in the words a club secretary reads. */
  readonly hint: string;
  /** The catalogue code of the fill, or null where no base article carries one for this family yet. */
  readonly code: string | null;
}

export const TEMPLATE_FAMILIES: readonly TemplateFamily[] = [
  { id: "plain", label: "Plain", hint: "One colour across the body, trimmed in your second.", code: "P00" },
  { id: "striped", label: "Stripes", hint: "Vertical stripes down the body.", code: "P01" },
  { id: "printed", label: "Gradient", hint: "A diagonal fade from one of your colours into another.", code: "P02" },
  { id: "banded", label: "Bands", hint: "Bands around the body.", code: null },
  { id: "diagonal", label: "Sash", hint: "A band from shoulder to hip.", code: null },
  { id: "panelled", label: "Panels", hint: "A panel down each side.", code: null },
];

export const familyById = (id: string): TemplateFamily | undefined => TEMPLATE_FAMILIES.find((family) => family.id === id);

/** The families no base article carries a fill code for. Named on the screen and on the pull request. */
export const MISSING_FAMILIES: readonly TemplateFamily[] = TEMPLATE_FAMILIES.filter((family) => family.code === null);

/** Said where a feel's own families are not in the catalogue, so the club is not left wondering. */
export const familiesMissingNote = (families: readonly TemplateFamily[]): string =>
  families.length === 0
    ? ""
    : `${families.map((family) => family.label.toLowerCase()).join(", ")} ${families.length === 1 ? "is" : "are"} not offered yet: no base article carries a print fill for ${families.length === 1 ? "it" : "them"}.`;

/** The fill codes the article offers, in catalogue order. */
export const fillCodesOf = (article: BaseArticle | null): readonly string[] =>
  (article?.options ?? []).filter((option) => option.group === FILL_GROUP).map((option) => option.code);

/** The families a list of names stands for, in that order. A name no family carries is left out. */
export const familiesOf = (ids: readonly string[]): readonly TemplateFamily[] =>
  ids.flatMap((id) => {
    const family = familyById(id);
    return family === undefined ? [] : [family];
  });

/** A family the engine may actually use: one whose fill code the article lists. */
export type OfferedFamily = TemplateFamily & Readonly<{ code: string }>;

/**
 * The families a feel offers on one base article: the feel's own families in its own order, cut to
 * those whose fill code the article actually offers. An article with no fill group gives an empty
 * list, and the engine then says so rather than proposing a fill nobody listed.
 */
export function familiesFor(feel: FeelId, article: BaseArticle | null): readonly OfferedFamily[] {
  const offered = new Set(fillCodesOf(article));
  return familiesOf(feelById(feel).families).flatMap((family) => (family.code !== null && offered.has(family.code) ? [family as OfferedFamily] : []));
}

/** The families a feel asked for that the article could not offer, so the screen can name them. */
export function familiesWithoutCode(feel: FeelId, article: BaseArticle | null): readonly TemplateFamily[] {
  const offered = new Set(fillCodesOf(article));
  return familiesOf(feelById(feel).families).filter((family) => family.code === null || !offered.has(family.code));
}
