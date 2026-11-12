import type { Route } from "next";
import type { BaseArticleSummary } from "@/lib/catalogue/types";
import { describeMissing } from "@/lib/factory/dates";
import { CLASS_NOTE } from "@/lib/home/catalogue-filters";
import type { PriceSource } from "@/lib/home/price";
import { subCategoriesOf } from "./categories";
import { isEco } from "./cards";
import type { ProgrammeFabric } from "@/lib/factory/schemas";
import { ALL_CATEGORY, categoryHref } from "./routes";

/**
 * The catalogue home's rows (09 screen 10, v3.5; prototype p01). Each row is a question the rows can answer:
 *
 * - **Top picks for clubs:** the articles that serve teamwear (ONBOARDING.md "Serves").
 * - **From one piece:** the articles whose factory takes an order of one (the capability's minimum). The
 *   prototype's "New arrivals" needs a launch date the catalogue does not keep, so this row stands in its place.
 * - **Eco picks:** fabrics the programme marks PFAS-free or OEKO-TEX certified.
 * - **Discover more:** the article types, each opening the whole catalogue filtered to it.
 * - **Questions:** answered from the same rows; a part nobody has agreed says so.
 */

export const ROW_SIZE = 4;

export interface HomeRows {
  readonly topPicks: readonly BaseArticleSummary[];
  readonly onePiece: readonly BaseArticleSummary[];
  readonly eco: readonly BaseArticleSummary[];
}

export function homeRows(
  articles: readonly BaseArticleSummary[],
  source: (code: string) => PriceSource,
  fabrics: readonly ProgrammeFabric[],
): HomeRows {
  return {
    topPicks: articles.filter((article) => article.uses.includes("teamwear")).slice(0, ROW_SIZE),
    onePiece: articles.filter((article) => source(article.code).moq === 1).slice(0, ROW_SIZE),
    eco: articles.filter((article) => isEco(article.fabricCodes, fabrics)).slice(0, 3),
  };
}

export type DiscoverLink = Readonly<{ label: string; href: Route }>;

/** "Jerseys", "Shorts" … each opening every product of that type. */
export const discoverLinks = (articles: readonly BaseArticleSummary[]): readonly DiscoverLink[] =>
  subCategoriesOf(articles).map((sub) => ({ label: sub.label, href: categoryHref(ALL_CATEGORY, { articleType: sub.type }) }));

export interface FaqInput {
  readonly articles: readonly BaseArticleSummary[];
  readonly source: (code: string) => PriceSource;
  /** The longest lead time any capability states, in working days, or null. */
  readonly leadTimeDays: number | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
}

export type Faq = Readonly<{ question: string; answer: string }>;

const pieces = (count: number): string => `${count} piece${count === 1 ? "" : "s"}`;

function minimumAnswer(input: FaqInput): string {
  const moqs = input.articles.map((article) => input.source(article.code).moq).filter((moq): moq is number => moq !== null);
  if (moqs.length === 0) return "Not set yet: no factory has agreed a minimum order for any base.";
  const smallest = Math.min(...moqs);
  const covered = moqs.filter((moq) => moq === smallest).length;
  return `From ${pieces(smallest)}, on ${covered} of ${input.articles.length} bases. ${CLASS_NOTE}`;
}

function timeAnswer(input: FaqInput): string {
  const missing = [
    input.leadTimeDays === null ? "the factory's lead time" : null,
    input.qcDays === null ? "the days for QC" : null,
    input.freightDays === null ? "the freight days" : null,
  ].filter((part): part is string => part !== null);
  const making = input.leadTimeDays === null ? "" : `Making takes up to ${input.leadTimeDays} working days from the weekly cut-off. `;
  return missing.length === 0
    ? `${making}QC takes ${input.qcDays} working days and UK freight ${input.freightDays} days. The date is promised when you order.`
    : `${making}No delivery date is promised yet. ${describeMissing(missing)}`;
}

function priceAnswer(input: FaqInput): string {
  const label = input.articles.flatMap((article) => input.source(article.code).ladder).find((tier) => tier.label !== "")?.label;
  return label === undefined
    ? "No base has a price yet. A price is shown only once a factory tier carries one."
    : `Not yet. Every price shown carries the label of the row it comes from: "${label}".`;
}

export const faqs = (input: FaqInput): readonly Faq[] => [
  { question: "What is the minimum order?", answer: minimumAnswer(input) },
  { question: "How long do production and delivery take?", answer: timeAnswer(input) },
  { question: "Are these prices final?", answer: priceAnswer(input) },
  { question: "What do Class A and Class B mean?", answer: CLASS_NOTE },
];

/** The longest lead time any article's capability states, in working days, or null when none does. */
export function longestLeadTime(articles: readonly BaseArticleSummary[], leadTimeOf: (code: string) => number | null): number | null {
  const days = articles.map((article) => leadTimeOf(article.code)).filter((day): day is number => day !== null);
  return days.length === 0 ? null : Math.max(...days);
}
