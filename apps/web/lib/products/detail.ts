import type { BaseArticle, BaseArticleSummary } from "@/lib/catalogue/types";
import { NOT_YET_SAMPLED } from "@/lib/catalogue/vocabulary";
import { describeMissing } from "@/lib/factory/dates";
import { GAP_RULE_ID, type Capability, type Factory, type FabricColour, type ProgrammeFabric } from "@/lib/factory/schemas";
import { fabricCard, NOT_SET, type FabricCard } from "@/lib/home/article-view";
import { groupLabel } from "@/lib/home/catalogue-view";
import { sizeSpan } from "./cards";
import { shortLabel } from "./configurator";

/**
 * The product page's facts (09 screen 11, v3.5; prototype p03): the bullets, the decoration methods, the
 * "Made by Knitwright" card, the Fulfilment box, the options available, the lead time and the rules summary.
 *
 * Every line is read from a row or says it is not set. The decoration tabs are the prototype's four methods; the
 * only one the rows can speak to is sublimation (the fabric programme's `sublimatable` column, and Class A is
 * sublimated by definition, spec decision 4). The other three are not agreed for any base, and say so.
 */

export const DECORATION_METHODS = ["Sublimation", "Embroidery", "Screen print", "Heat transfer"] as const;

export type Decoration = Readonly<{ method: string; line: string; offered: boolean }>;

export function decorations(fabrics: readonly FabricCard[], productionClass: string): readonly Decoration[] {
  const sublimates = fabrics.some((fabric) => fabric.sublimation === "Takes a sublimation print");
  return DECORATION_METHODS.map((method) => {
    if (method !== "Sublimation") return { method, line: `${method} is not agreed with the factory for this base yet.`, offered: false };
    if (sublimates) return { method, line: "All-over print in any colour, dyed into the fabric.", offered: true };
    return productionClass === "A"
      ? { method, line: "Class A is sublimated. The fabric programme does not say yet whether this fabric takes the print.", offered: true }
      : { method, line: "Not on file for this fabric.", offered: false };
  });
}

/** Up to four lines under the title: the fabric, the cut, the sizes and the class. */
export function bullets(article: BaseArticle, fabrics: readonly FabricCard[]): readonly string[] {
  const body = fabrics[0];
  return [
    body ? `${body.blend === NOT_SET ? body.name : body.blend}, ${body.gsm}` : "Fabric not set yet",
    `Fit: ${article.fit ?? NOT_SET.toLowerCase()}`,
    `Sizes: ${sizeSpan(article.sizeRange) ?? NOT_SET.toLowerCase()}`,
    article.productionClass === "A" ? "Class A: sublimated, made from one piece" : "Class B: small runs on stock-colour fabric",
  ];
}

export type Fact = Readonly<{ label: string; value: string; note: string | null; ruleId: string }>;

export interface LeadTimeParts {
  readonly leadTimeDays: number | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
}

/** The lead time with whatever part is missing named, never a date nobody agreed (decision 0104). */
export function leadTimeFact(capability: Capability | undefined, parts: Omit<LeadTimeParts, "leadTimeDays">): Fact {
  const lead = capability?.leadTimeDays ?? null;
  const missing = [
    lead === null ? "the factory's lead time" : null,
    parts.qcDays === null ? "the days for QC" : null,
    parts.freightDays === null ? "the freight days" : null,
  ].filter((part): part is string => part !== null);
  const value = lead === null ? NOT_SET : `${lead} working days`;
  const note = missing.length === 0 ? `+ ${parts.qcDays} days QC, ${parts.freightDays} days freight` : `No delivery date yet. ${describeMissing(missing)}`;
  return { label: "Avg. production", value, note, ruleId: capability?.ruleId ?? GAP_RULE_ID };
}

export interface FulfilmentInput {
  readonly factory: Factory | null;
  readonly capability: Capability | undefined;
  readonly priceLine: string;
  readonly priceLabel: string | null;
  readonly priceRuleId: string;
  readonly parts: Omit<LeadTimeParts, "leadTimeDays">;
}

/** The Fulfilment box's top row: quality, price, shipping and production. */
export function fulfilmentFacts(input: FulfilmentInput): readonly Fact[] {
  const delta = input.capability?.colourDeltaMax ?? null;
  return [
    {
      label: "Quality",
      value: delta === null ? NOT_SET : `Colour within ΔE ${delta}`,
      note: input.factory?.label ?? null,
      ruleId: input.capability?.ruleId ?? GAP_RULE_ID,
    },
    { label: "Price", value: input.priceLine, note: input.priceLabel, ruleId: input.priceRuleId },
    { label: "Shipping", value: NOT_SET, note: "No shipping rate is agreed yet.", ruleId: GAP_RULE_ID },
    leadTimeFact(input.capability, input.parts),
  ];
}

export type Swatch = Readonly<{ name: string; hex: string }>;

export const swatchesOf = (cards: readonly FabricCard[]): readonly Swatch[] => cards.flatMap((card) => card.colours);

export const fabricCards = (article: BaseArticle, programme: readonly ProgrammeFabric[], colours: readonly FabricColour[]): readonly FabricCard[] =>
  article.fabrics.map((fabric) => fabricCard(fabric, programme, colours));

export type OptionLine = Readonly<{ group: string; choices: readonly Readonly<{ label: string; full: string; sampled: boolean }>[]; ruleId: string }>;

/** "Options available": each group with its choices, and which are not sampled yet. */
export function optionsAvailable(article: BaseArticle): readonly OptionLine[] {
  const groups = [...new Set(article.options.map((option) => option.group))];
  return groups.map((group) => {
    const own = article.options.filter((option) => option.group === group);
    return {
      group: groupLabel(group),
      choices: own.map((option) => ({ label: shortLabel(option.label), full: option.label, sampled: option.isDefault || option.approvedBySampleId !== null })),
      ruleId: own[0]!.ruleId,
    };
  });
}

export type RuleLine = Readonly<{ text: string; ruleId: string }>;

/** The rules summary: each option, range and the price, with the rule behind it, so every one has a Why?. */
export function rulesSummary(article: BaseArticle, priceRuleId: string): readonly RuleLine[] {
  const options = article.options.map((option) => ({ text: `${groupLabel(option.group)}: ${shortLabel(option.label)}`, ruleId: option.ruleId }));
  const ranges = article.parameters
    .filter((parameter) => parameter.type === "range")
    .map((parameter) => ({
      text: `${groupLabel(parameter.key)}: ${parameter.min ?? "?"} to ${parameter.max ?? "?"} ${parameter.unit ?? "mm"}${parameter.approvedBySampleId === null ? ` · ${NOT_YET_SAMPLED}` : ""}`,
      ruleId: parameter.ruleId,
    }));
  return [...options, ...ranges, { text: "Price ladder", ruleId: priceRuleId }];
}

/** Bases for the same sports as this one, in catalogue order, up to four. */
export function sameSports(article: Pick<BaseArticleSummary, "code" | "sportTags">, all: readonly BaseArticleSummary[]): readonly BaseArticleSummary[] {
  return all.filter((other) => other.code !== article.code && other.sportTags.some((tag) => article.sportTags.includes(tag))).slice(0, 4);
}
