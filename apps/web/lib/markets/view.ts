import { labelRulesOf, SIZE_CODE_CONVENTION, type LabelRules } from "@/lib/compliance/rows";
import { GAP_RULE_ID as COMPLIANCE_GAP, RULE_CARE_LABEL } from "@/lib/compliance/model";
import { describeMissing } from "@/lib/factory/dates";
import type { CountryRule, SellCurrency } from "@/lib/factory/schemas";
import { ladderRows, type LadderRow, type PriceSource } from "@/lib/home/price";
import type { Market } from "@/lib/home/market";
import { marketPhrase, taxTreatment, type TaxTreatment } from "./tax";

/**
 * What choosing a market means, in one read (plan v5 O3, decision 0103; spec F-S8's market and currency
 * selector).
 *
 * The selector on the catalogue and the article page used to change the currency a price was shown in
 * and nothing else. Choosing Australia changes four things, and all four are now shown beside it: which
 * currency the ladder is in and whether it has any prices at all, which tax the market charges and
 * whether it is being charged, which label lines a garment sold there may carry, and what is still
 * missing before a delivery date can be promised.
 *
 * Every line comes from a row. Where a row says nothing, the line says so and carries the rule that
 * would explain it. Nothing here converts a price, assumes a tax or works out a date.
 */

export interface LabelLineState {
  readonly kind: "fibre" | "care" | "origin" | "size" | "importer";
  readonly title: string;
  /** What the label will carry, or why it cannot. */
  readonly note: string;
  readonly ready: boolean;
  readonly source: string | null;
  readonly ruleId: string;
}

export interface MarketSummary {
  readonly market: Market;
  readonly countryName: string;
  /** The name as it reads after a preposition: "Australia", "the United Kingdom". */
  readonly countryPhrase: string;
  readonly currency: SellCurrency;
  /** False where the market's row says nothing is sold there. */
  readonly sellingEnabled: boolean;
  readonly tax: TaxTreatment;
  readonly ladder: readonly LadderRow[];
  /** What the price ladder is, in one line: priced, or not priced in this currency. */
  readonly priceNote: string;
  readonly labelLines: readonly LabelLineState[];
  /** The provenance label of the market's own row, so no figure can be read as agreed. */
  readonly rowLabel: string | null;
  /** "Not set: the days for QC and the freight days." Never a date (decision 0103). */
  readonly deliveryNote: string;
  /** Everything still missing for this market, each with the rule that explains it. */
  readonly gaps: readonly Readonly<{ note: string; ruleId: string }>[];
}

export interface MarketSummaryInput {
  readonly market: Market;
  /** The market's own row. Null: the catalogue could not be read, which is not the same as "closed". */
  readonly rule: CountryRule | null;
  readonly price: PriceSource;
  /** Working days the factory has agreed for production. Null: none agreed. */
  readonly leadTimeDays: number | null;
  /** Working days for QC and packing, from the production settings. Null: none agreed. */
  readonly qcDays: number | null;
}

const LABEL_TITLES: Readonly<Record<LabelLineState["kind"], string>> = {
  fibre: "Fibre content",
  care: "Care symbols",
  origin: "Country of origin",
  size: "Size",
  importer: "Importer address",
};

const fibreState = (rules: LabelRules): LabelLineState => {
  const { fibre } = rules;
  const ready = fibre.language !== null && fibre.order !== null;
  return {
    kind: "fibre",
    title: LABEL_TITLES.fibre,
    note: ready
      ? `In ${fibre.language}, ${String(fibre.order).replaceAll("_", " ")}, from the fabric's own blend.`
      : "Nobody has written which language and which order this market needs the fibre content in.",
    ready,
    source: fibre.source,
    ruleId: RULE_CARE_LABEL,
  };
};

const careState = (rules: LabelRules): LabelLineState => ({
  kind: "care",
  title: LABEL_TITLES.care,
  note:
    rules.care.symbolCodes.length > 0
      ? `${rules.care.symbolCodes.length} symbol${rules.care.symbolCodes.length === 1 ? "" : "s"} chosen for this market.`
      : (rules.care.gapNote ?? "No care symbol is chosen, and none is transcribed in the platform."),
  ready: rules.care.symbolCodes.length > 0 && rules.care.source !== null,
  source: rules.care.source,
  ruleId: rules.care.gapRuleId ?? RULE_CARE_LABEL,
});

const originState = (rules: LabelRules): LabelLineState => ({
  kind: "origin",
  title: LABEL_TITLES.origin,
  note: rules.origin.text ?? "No country of origin is written for this market.",
  ready: rules.origin.text !== null && rules.origin.source !== null,
  source: rules.origin.source,
  ruleId: RULE_CARE_LABEL,
});

const sizeState = (rules: LabelRules): LabelLineState => {
  const byConvention = rules.size.text === null && rules.size.convention === SIZE_CODE_CONVENTION && rules.size.source !== null;
  return {
    kind: "size",
    title: LABEL_TITLES.size,
    note: byConvention
      ? "One label per size, carrying the garment's own size code."
      : (rules.size.text ?? "Nobody has written how a size is designated on a label for this market."),
    ready: byConvention || (rules.size.text !== null && rules.size.source !== null),
    source: rules.size.source,
    ruleId: RULE_CARE_LABEL,
  };
};

const importerState = (rules: LabelRules): LabelLineState => ({
  kind: "importer",
  title: LABEL_TITLES.importer,
  note:
    rules.importer.required === null
      ? "Nobody has recorded whether this market needs an importer address on the label."
      : rules.importer.required
        ? "This market needs an importer address, taken from the brand's own details."
        : "This market needs no importer address.",
  ready: rules.importer.required !== null,
  source: rules.importer.source,
  ruleId: rules.importer.required === null ? COMPLIANCE_GAP : RULE_CARE_LABEL,
});

/** Which label lines a garment sold in this market may carry, and why each other one cannot. */
export const labelLinesFor = (rules: LabelRules): readonly LabelLineState[] => [
  fibreState(rules),
  careState(rules),
  originState(rules),
  sizeState(rules),
  importerState(rules),
];

/** What the ladder is in one line. A currency with no price in any tier says so rather than showing none. */
const priceNoteOf = (rows: readonly LadderRow[], currency: SellCurrency, where: string): string => {
  if (rows.length === 0) return `No price ladder is on file for this article, so nothing can be priced for ${where}.`;
  const priced = rows.filter((row) => row.priced).length;
  if (priced === 0) return `No ${currency} price is set in any tier. The ladder's quantity bands are on file; the prices for ${where} are not.`;
  return priced === rows.length
    ? `Every tier has a ${currency} price.`
    : `${priced} of ${rows.length} tiers have a ${currency} price; the others say so.`;
};

/** The three things a promised date needs, with the ones nobody has agreed named. */
const missingForDate = (input: MarketSummaryInput): readonly string[] =>
  [
    input.leadTimeDays === null ? "the factory's lead time" : null,
    input.qcDays === null ? "the days for QC" : null,
    (input.rule?.freightDays ?? null) === null ? "the freight days" : null,
  ].filter((part): part is string => part !== null);

/** Everything about a market a screen shows beside the selector. Pure: the same rows give the same words. */
export function marketSummary(input: MarketSummaryInput): MarketSummary {
  const { market, rule } = input;
  const countryName = rule?.name ?? market.label;
  const phrase = marketPhrase(countryName);
  const rules = labelRulesOf(rule?.labelRules ?? {});
  const ladder = ladderRows(input.price.ladder, market.currency);
  const labelLines = labelLinesFor(rules);
  const missing = missingForDate(input);
  const tax = rule === null ? null : taxTreatment(rule);
  const gaps = [
    ...(rule === null ? [{ note: `The rules for ${phrase} could not be read, so nothing about this market is shown.`, ruleId: COMPLIANCE_GAP }] : []),
    ...(tax?.missing === undefined || tax.missing === null ? [] : [{ note: tax.missing, ruleId: tax.ruleId }]),
    ...(ladder.some((row) => !row.priced) || ladder.length === 0
      ? [{ note: priceNoteOf(ladder, market.currency, phrase), ruleId: ladder[0]?.ruleId ?? COMPLIANCE_GAP }]
      : []),
    ...labelLines.filter((line) => !line.ready).map((line) => ({ note: `${line.title}: ${line.note}`, ruleId: line.ruleId })),
    ...(missing.length === 0 ? [] : [{ note: `No delivery date can be shown. ${describeMissing(missing)}`, ruleId: COMPLIANCE_GAP }]),
  ];
  return {
    market,
    countryName,
    countryPhrase: phrase,
    currency: market.currency,
    sellingEnabled: rule?.sellingEnabled ?? false,
    tax:
      tax ??
      taxTreatment({
        name: countryName,
        currency: market.currency,
        taxName: null,
        vatRateBp: null,
        taxRegistered: false,
        taxRegistrationThresholdMinor: null,
        taxSource: null,
      }),
    ladder,
    priceNote: priceNoteOf(ladder, market.currency, phrase),
    labelLines,
    rowLabel: rule?.label ?? null,
    deliveryNote: missing.length === 0 ? "A delivery date can be worked out for this market." : `No delivery date yet. ${describeMissing(missing)}`,
    gaps,
  };
}
