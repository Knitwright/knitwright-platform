import type { BaseArticle } from "@/lib/catalogue";
import { addColourwayAction, defaultsOver, findingLines, humanise, optionGroups, parameterSliders, signedMm, sizeChoices, type FormValues } from "@/lib/editor";
import { formatMoney } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { GarmentSpec } from "@/lib/garment";
import { fromPrice, type PriceSource } from "@/lib/home/price";
import { priceSteps, stepLabels } from "@/lib/make/prices";
import { activeColourwayId, colourRows, colourwayChoices } from "@/lib/projects/colour-controls";
import { buildNamesNumbersAction, LETTERING_CHOICES, namesNumbersPanel, removeNamesNumbersAction } from "@/lib/projects/names-numbers-controls";
import type { ValidationCheck } from "@/lib/validation/check";
import { elementSummaries, elementViews } from "./elements";
import { productInfo, type FactoryFacts } from "./product-info";
import type { DesignChange, GarmentChecks, GarmentInspectorView, GarmentNamesNumbers, GarmentPrice, InspectorCheck, InspectorSlider } from "./types";

/**
 * THE GARMENT INSPECTOR, worked out (plan v6 E3, decision 0147; `08` §5.3 "Garment board", e15).
 *
 * Every figure comes from what already decides it, and nothing here decides anything new:
 *
 *   * **Options** are the base article's option tiles and range sliders as the editor's Form toolbar
 *     builds them (`lib/editor/form.ts`), with the lock mark and Why? of every option no golden sample
 *     has signed off. The sliders start from the parameters stored on the design (`spec.article`).
 *   * **Checks** are the stored result of `lib/validation` for this version, read as the editor's
 *     Validate list reads it (`findingLines`), plus the options no sample has signed off. Nothing is
 *     re-checked or softened here, and the order gate (D1) is not touched.
 *   * **Price** is the factory's price tiers through `priceFor` (`lib/make/prices.ts`), with each
 *     tier's own label, and "not set" where there is none — never a zero.
 *   * **Colourways**, **kit colours** and **names and numbers** are the editor's own controls
 *     (`lib/projects/colour-controls.ts`, `names-numbers-controls.ts`), whose changes the server
 *     works out here so the browser only hands one back.
 */

/** The quantities of the price line: `08` §5.3 "from £x at 1 / 50 / 100 / 300". */
export const PRICE_QUANTITIES: readonly number[] = [1, 50, 100, 300];

export interface GarmentInspectorInput {
  readonly designId: string;
  readonly name: string;
  readonly version: number;
  readonly spec: GarmentSpec;
  readonly article: BaseArticle | null;
  /** The stored checks of this version, as the editor reads them (newest result first). */
  readonly checks: readonly ValidationCheck[];
  readonly price: PriceSource;
  readonly currency: SellCurrency;
  readonly factory: FactoryFacts;
  /** The colourway the address names, if any. */
  readonly colourwayId?: string;
  /** The option codes the address names (`opt=group:CODE`), as the editor keeps them. */
  readonly options?: Readonly<Record<string, string>>;
}

/** The numeric parameters stored on the design: what the sliders start from. */
const storedNumbers = (spec: GarmentSpec): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(spec.article?.parameters ?? {})) if (typeof value === "number") out[key] = value;
  return out;
};

/** The form the inspector shows: the address's options and the design's parameters over the article's defaults. */
export function inspectorForm(article: BaseArticle | null, spec: GarmentSpec, options: Readonly<Record<string, string>> = {}): FormValues {
  if (article === null) return { options: {}, parameters: {} };
  return defaultsOver(article, { options, parameters: storedNumbers(spec) });
}

const rangeEnd = (mm: number): string => (mm === 0 ? "0" : `${mm < 0 ? "−" : "+"}${Math.abs(mm)}`);

function sliderOf(slider: ReturnType<typeof parameterSliders>[number]): InspectorSlider {
  return {
    key: slider.key,
    label: slider.label,
    min: slider.min,
    max: slider.max,
    step: slider.step,
    value: slider.value,
    unit: slider.unit,
    valueText: slider.value === 0 ? `0 ${slider.unit}` : slider.unit === "mm" ? signedMm(slider.value) : `${slider.value} ${slider.unit}`,
    rangeText: `Range ${rangeEnd(slider.min)} to ${rangeEnd(slider.max)} ${slider.unit}`,
    locked: slider.notSampled,
    lockNote: slider.lockNote,
    ruleId: slider.ruleId,
  };
}

function optionsOf(article: BaseArticle | null, form: FormValues): GarmentInspectorView["options"] {
  if (article === null) return { groups: [], sliders: [], empty: "This design is not on a base article yet, so it has no options of its own to change." };
  const groups = optionGroups(article, form).map((group) => ({
    group: group.group,
    label: group.label,
    options: group.tiles.map((tile) => ({
      code: tile.code,
      label: tile.label,
      chosen: tile.chosen,
      locked: tile.notSampled,
      lockNote: tile.lockNote,
      ruleId: tile.ruleId,
      extraCost: tile.extraCost,
    })),
  }));
  const sliders = parameterSliders(article, form).map(sliderOf);
  const empty = groups.length === 0 && sliders.length === 0 ? `${article.code} has no options or ranges on file yet. ${article.dataLabel}.` : null;
  return { groups, sliders, empty };
}

const TONE = { blocker: "bad", warning: "warn" } as const;

/** The Checks section: the stored result of `lib/validation`, problems first, then what passed. */
export function garmentChecks(checks: readonly ValidationCheck[], article: BaseArticle | null, form: FormValues): GarmentChecks {
  const problems: InspectorCheck[] = findingLines({ checks, draft: null, article, form }).map((line) => ({
    key: line.key,
    tone: TONE[line.severity],
    label: line.message,
    target: line.target,
    ruleId: line.ruleId,
  }));
  const passing: InspectorCheck[] = checks
    .filter((check) => check.passed)
    .map((check) => ({ key: `passed:${check.code}`, tone: "ok", label: humanise(check.code), target: null, ruleId: null }));
  const passed = checks.filter((check) => check.passed).length;
  const checked = checks.length > 0;
  return {
    checked,
    passed,
    total: checks.length,
    summary: checked ? `${passed} / ${checks.length}` : "Not checked yet",
    lines: [...problems, ...passing],
    blockers: problems.filter((line) => line.tone === "bad").length,
  };
}

/** The Price section: the price at 1, 50, 100 and 300 pieces, from the factory's tiers. */
export function garmentPrice(source: PriceSource, currency: SellCurrency, quantities: readonly number[] = PRICE_QUANTITIES): GarmentPrice {
  const steps = priceSteps(source.ladder, currency, quantities);
  const from = fromPrice(source, currency);
  return {
    from: from.line,
    steps: steps.map((step) => ({ qty: step.qty, unit: step.result.status === "priced" ? formatMoney(step.result.unitMinor, step.result.currency) : null })),
    labels: stepLabels(steps),
    priced: from.priced,
  };
}

const actionOf = (request: Readonly<{ kind: string; action?: unknown }>): DesignChange | null =>
  request.kind === "action" ? (request.action as DesignChange) : null;

/** Names and numbers: on or off, the lettering style and the sample shown, with the change behind each control. */
export function garmentNamesNumbers(spec: GarmentSpec): GarmentNamesNumbers {
  const panel = namesNumbersPanel(spec);
  if (panel === null) {
    return { available: false, on: false, style: null, styleId: "", styles: [], colour: "", sample: "", turnOn: null, turnOff: null, withStyle: {} };
  }
  const { form } = panel;
  const styles = LETTERING_CHOICES.map((choice) => ({ id: choice.id, label: choice.label }));
  const withStyle: Record<string, DesignChange> = {};
  for (const style of styles) {
    const change = actionOf(buildNamesNumbersAction({ ...form, style: style.id }));
    if (change !== null) withStyle[style.id] = change;
  }
  return {
    available: true,
    on: panel.set,
    style: styles.find((style) => style.id === form.style)?.label ?? null,
    styleId: form.style,
    styles,
    colour: form.colour,
    sample: `${form.sampleName} ${form.sampleNumber}`.trim(),
    turnOn: actionOf(buildNamesNumbersAction(form)),
    turnOff: actionOf(removeNamesNumbersAction()),
    withStyle,
  };
}

const productLine = (article: BaseArticle | null): string => {
  if (article === null) return "Not on a base article yet";
  const fabric = article.fabrics[0];
  const fabricText = fabric ? `${fabric.code}${fabric.gsm ? ` ${fabric.gsm} gsm` : ""}` : null;
  return [article.code, `Class ${article.productionClass}`, fabricText].filter((part): part is string => part !== null).join(" · ");
};

/** Everything the garment inspector shows for one design at its current version. */
export function garmentInspector(input: GarmentInspectorInput): GarmentInspectorView {
  const { spec, article } = input;
  const form = inspectorForm(article, spec, input.options);
  const colourwayId = activeColourwayId(spec, input.colourwayId);
  const shown = spec.colourways.find((colourway) => colourway.id === colourwayId) ?? spec.colourways[0];
  const choices = colourwayChoices(spec, colourwayId);
  return {
    designId: input.designId,
    name: input.name,
    version: input.version,
    product: { name: article?.name ?? humanise(spec.typeId), line: productLine(article), hasArticle: article !== null },
    options: optionsOf(article, form),
    colourways: { choices, add: addColourwayAction(choices) as DesignChange },
    kitColours: colourRows(spec, colourwayId).map((row) => ({ id: row.panelId, label: row.label, hex: row.hasSwatch ? row.swatch : null, code: row.colourText })),
    colourway: {
      id: shown.id,
      name: shown.name,
      colours: shown.colours.map((entry) => ({ panelId: entry.panelId, colour: entry.colour, ...(entry.swatch === undefined ? {} : { swatch: entry.swatch }) })),
    },
    namesNumbers: garmentNamesNumbers(spec),
    sizes: { sizes: sizeChoices(spec.sizing?.sizes ?? [], article?.sizeRange ?? []), base: spec.sizing?.baseSize ?? article?.sampleSize ?? null },
    checks: garmentChecks(input.checks, article, form),
    price: garmentPrice(input.price, input.currency),
    elements: elementSummaries(spec),
    elementViews: elementViews(spec),
    productInfo: productInfo({ designId: input.designId, spec, article, price: input.price, currency: input.currency, factory: input.factory }),
    article: spec.article
      ? { baseArticleCode: spec.article.baseArticleCode, productionClass: spec.article.productionClass, parameters: spec.article.parameters }
      : article
        ? { baseArticleCode: article.code, productionClass: article.productionClass, parameters: {} }
        : null,
  };
}
