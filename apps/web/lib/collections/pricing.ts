import type { Ladder } from "@/lib/factory/pricing";
import type { FactorySnapshot } from "@/lib/factory/schemas";
import { capabilityFor } from "@/lib/factory/service";
import { noRates } from "./landed";
import type { LandedRates, PricingByStyle, Style } from "./types";
import { GAP_RULE_ID } from "./vocabulary";

/**
 * Where every figure in the line plan comes from (decision 0085). Nothing here is a number: the price
 * ladder is the `price_tiers` rows of the factory's capability for the style's article and fabric, the
 * duty rate is `country_rules.duty_by_hs` read at the article's HS code, and the freight is the
 * `collection_freight_rates` row of the destination.
 *
 * A style whose article is not chosen, or whose article the factory does not make, gets an empty ladder,
 * and the line plan says there is no price rather than showing one.
 */

/** The freight row of a destination, as the app reads it. */
export interface FreightRate {
  readonly country: string;
  readonly perPieceMinor: number | null;
  readonly currency: string;
  readonly dutyBasis: "goods" | "goods_and_freight";
  readonly ruleId: string;
  readonly label: string;
}

/** Everything the rates are built from, each piece of it a row. */
export interface RatesSource {
  readonly country: string;
  readonly freight: FreightRate | null;
  /** HS code to duty in basis points, from the destination's country rule. */
  readonly dutyByHs: Readonly<Record<string, number>>;
  readonly countryLabel: string | null;
  readonly countryRuleId: string | null;
  /** Article code to HS code, from the base articles. Null where the article has none on file. */
  readonly hsByArticle: Readonly<Record<string, string | null>>;
}

const labelsOf = (source: RatesSource): readonly string[] =>
  [source.freight?.label ?? null, source.countryLabel].filter((label): label is string => label !== null);

const ruleIdsOf = (source: RatesSource): readonly string[] =>
  [...new Set([source.freight?.ruleId ?? GAP_RULE_ID, source.countryRuleId ?? GAP_RULE_ID])];

/** The freight and duty that apply to one article at this destination. */
export function ratesFor(source: RatesSource, articleCode: string | null): LandedRates {
  const hsCode = articleCode === null ? null : source.hsByArticle[articleCode] ?? null;
  const dutyRateBp = hsCode === null ? null : source.dutyByHs[hsCode] ?? null;
  return {
    country: source.country,
    freightPerPieceMinor: source.freight?.perPieceMinor ?? null,
    freightCurrency: source.freight?.currency ?? null,
    dutyBasis: source.freight?.dutyBasis ?? "goods_and_freight",
    dutyRateBp,
    hsCode,
    labels: labelsOf(source),
    ruleIds: ruleIdsOf(source),
  };
}

/** The ladder for one style: the tiers of the factory's capability for its article and fabric. */
export function ladderFor(snapshot: FactorySnapshot | null, style: Style): Ladder {
  if (snapshot === null || style.articleCode === null) return [];
  const capability = capabilityFor(snapshot, style.articleCode, style.fabricCode ?? undefined);
  return capability ? snapshot.tiers.filter((tier) => tier.capabilityId === capability.id) : [];
}

/**
 * The ladder and the rates of every style, by style id. A destination with no rows of its own still
 * gets a source: `emptySource` says so, and every landed cost then carries the note that says what is
 * missing instead of a figure nobody set.
 */
export function pricingFor(styles: readonly Style[], snapshot: FactorySnapshot | null, source: RatesSource): PricingByStyle {
  return Object.fromEntries(
    styles.map((style) => [style.id, { ladder: ladderFor(snapshot, style), rates: ratesFor(source, style.articleCode) }]),
  );
}

/** A destination nothing is on file for. Used where the country rule or the freight row is missing. */
export const emptySource = (country: string): RatesSource => ({
  country,
  freight: null,
  dutyByHs: {},
  countryLabel: null,
  countryRuleId: null,
  hsByArticle: {},
});

/** The rates of a destination nothing is on file for, for a screen that has no source at all. */
export const emptyRates = (country: string): LandedRates => noRates(country);

/** The article codes a plan needs an HS code for, each once. */
export const articleCodesOf = (styles: readonly Style[]): readonly string[] => [
  ...new Set(styles.map((style) => style.articleCode).filter((code): code is string => code !== null)),
];
