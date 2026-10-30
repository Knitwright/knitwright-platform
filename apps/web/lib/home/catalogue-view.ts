import type { BaseArticle } from "@/lib/catalogue/types";
import type { SellCurrency } from "@/lib/factory/schemas";
import { fromPrice, type FromPrice, type PriceSource } from "./price";

/**
 * The catalogue's tabs, sort and grid cards (spec F-S4, "Base product and template catalogue").
 *
 * A card shows only what the rows hold: the article's name and code, its production class, where it
 * has reached on its way to the catalogue, the "From £x · from 1 pc" line from X6's tiers, and
 * whether its form can be edited. The spec's NEW tag and its Newest / Most used sorts need a
 * created date and a use count that the catalogue does not keep, so neither is faked.
 */

export const CATALOGUE_TABS = [
  { id: "bases", label: "Base products" },
  { id: "templates", label: "Templates" },
] as const;
export type CatalogueTab = (typeof CATALOGUE_TABS)[number]["id"];

export const tabFromQuery = (value: string | readonly string[] | undefined): CatalogueTab => {
  const asked = Array.isArray(value) ? value[0] : value;
  return CATALOGUE_TABS.find((tab) => tab.id === asked)?.id ?? "bases";
};

export const SORTS = [
  { id: "name", label: "Name, A to Z" },
  { id: "name-desc", label: "Name, Z to A" },
  { id: "code", label: "Code, A to Z" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

/** Why the spec's two sorts are not offered. */
export const SORT_NOTE = "Newest and Most used need a created date and a use count, which the catalogue does not keep yet.";

export const sortFromQuery = (value: string | readonly string[] | undefined): SortId => {
  const asked = Array.isArray(value) ? value[0] : value;
  return SORTS.find((sort) => sort.id === asked)?.id ?? "name";
};

/** Sorting needs only a name and a code, so it works on a summary and on a whole article alike. */
type Sortable = Readonly<{ name: string; code: string }>;

const BY: Readonly<Record<SortId, (a: Sortable, b: Sortable) => number>> = {
  name: (a, b) => a.name.localeCompare(b.name, "en"),
  "name-desc": (a, b) => b.name.localeCompare(a.name, "en"),
  code: (a, b) => a.code.localeCompare(b.code, "en"),
};

export const sortArticles = <T extends Sortable>(articles: readonly T[], sort: SortId): readonly T[] => [...articles].sort(BY[sort]);

/** What a base article has reached, in words a reader can act on. */
export const STATUS_LABELS = {
  draft: "Draft, not reviewed by a factory",
  sampling: "Being sampled",
  live: "In the catalogue",
} as const;

export interface CardTag {
  readonly label: string;
  readonly tone: "class" | "status";
}

export interface ArticleCardView {
  readonly code: string;
  readonly name: string;
  readonly href: string;
  readonly tags: readonly CardTag[];
  readonly price: FromPrice;
  /** True where the article has an option or a range a founder can change.  */
  readonly editableForm: boolean;
  /** What the "Edit this product's form" icon says it does, built from the article's own options. */
  readonly formHint: string | null;
  readonly dataLabel: string;
}

/** "sleeve_finish" as "Sleeve finish". */
export const groupLabel = (group: string): string => {
  const words = group.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const listed = (parts: readonly string[]): string =>
  parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const measurements = (count: number): string => `${count} measurement${count === 1 ? "" : "s"}`;

/** What can be changed on this article, from its own option groups and ranges. Null where nothing can. */
export function formHint(article: BaseArticle): string | null {
  const groups = [...new Set(article.options.map((option) => option.group))].map(groupLabel);
  const ranges = article.parameters.filter((parameter) => parameter.type === "range").length;
  const parts = [
    groups.length > 0 ? `${listed(groups)} can be changed` : null,
    ranges > 0 ? `${measurements(ranges)} move within the range on file` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : `${parts.join("; ")}.`;
}

export function articleCard(article: BaseArticle, source: PriceSource, currency: SellCurrency): ArticleCardView {
  const hint = formHint(article);
  return {
    code: article.code,
    name: article.name,
    href: `/catalogue/${article.code}`,
    tags: [
      { label: `Class ${article.productionClass}`, tone: "class" },
      { label: STATUS_LABELS[article.status], tone: "status" },
    ],
    price: fromPrice(source, currency),
    editableForm: hint !== null,
    formHint: hint,
    dataLabel: article.dataLabel,
  };
}

/** The accessible name of the icon that marks an article whose form can be edited (spec F-S4). */
export const EDIT_FORM_LABEL = "Edit this product's form";
