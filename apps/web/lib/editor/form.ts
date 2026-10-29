import type { BaseArticle, OptionDef, ParameterDef } from "@/lib/catalogue";
import { NOT_YET_SAMPLED, RULE_GAP } from "@/lib/catalogue";
import { formatMoney } from "@/lib/factory/pricing";
import type { FormValues } from "./slots";

/**
 * The Form toolbar (spec F-S4): the base article's option groups as tiles with their catalogue
 * codes, and its parameters as sliders showing the range the factory approved. Everything comes
 * from the catalogue row (X1), so a value the article does not offer cannot be reached: a slider's
 * ends and step are the article's, and `withinRange` refuses anything else before it is saved.
 *
 * An option or range with no golden sample behind it yet carries a lock mark, the words
 * "Not yet sampled" and a Why? link (decision 0075). It can still be chosen: "not sampled" is a
 * thing the design has to answer for before it is ordered, not a value the factory cannot make.
 */

/** Drafting jargon a person never needs to read: `body_length_offset` is "Body length" on the slider. */
const JARGON = ["_offset"];

/** A parameter key or option group as words: `sleeve_finish` is "Sleeve finish". No per-key table, so a new article needs no code. */
export function humanise(key: string): string {
  let plain = key;
  for (const suffix of JARGON) if (plain.endsWith(suffix)) plain = plain.slice(0, -suffix.length);
  const words = plain.split(/[_-]+/).filter(Boolean).join(" ");
  return words.length === 0 ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

/** A signed length in millimetres, with the typographic minus a range reads with. */
export const signedMm = (mm: number): string => `${mm < 0 ? "−" : "+"}${Math.abs(mm)} mm`;

/** The end of a range: "−30" or "+40". A nought is written without a sign. */
const rangeEnd = (mm: number): string => (mm === 0 ? "0" : `${mm < 0 ? "−" : "+"}${Math.abs(mm)}`);

export interface OptionTile {
  /** The catalogue code, as `C01`. */
  readonly code: string;
  readonly label: string;
  readonly chosen: boolean;
  /** True when no golden sample has signed this option off yet. */
  readonly notSampled: boolean;
  /** The words beside the lock mark, or null when a sample has signed the option off. */
  readonly lockNote: string | null;
  readonly ruleId: string;
  /** "+£2.50", or null when nobody has priced the option: an option is never shown as free because of that. */
  readonly extraCost: string | null;
}

export interface OptionGroupView {
  readonly group: string;
  readonly label: string;
  readonly chosen: string | null;
  readonly tiles: readonly OptionTile[];
}

export interface ParameterSlider {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** The value the article is drafted at. A slider away from it is a change the design has to answer for. */
  readonly defaultMm: number;
  readonly unit: string;
  /** "Body length +20 mm · range −30 to +40" (spec F-S4). */
  readonly rangeLabel: string;
  readonly notSampled: boolean;
  readonly lockNote: string | null;
  readonly ruleId: string;
  /** The points of measure the parameter moves, for the summary and the tech pack. */
  readonly pomLetters: readonly string[];
}

const tileOf = (option: OptionDef, chosen: string | null): OptionTile => ({
  code: option.code,
  label: option.label,
  chosen: option.code === chosen,
  notSampled: option.approvedBySampleId === null,
  lockNote: option.approvedBySampleId === null ? NOT_YET_SAMPLED : null,
  ruleId: option.ruleId || RULE_GAP,
  extraCost: option.extraCostMinor !== null && option.currency ? `+${formatMoney(option.extraCostMinor, option.currency)}` : null,
});

/** The chosen code of a group: what the person picked, else the group's default, else the first option. */
export function chosenOption(options: readonly OptionDef[], picked: string | undefined): string | null {
  if (picked !== undefined && options.some((option) => option.code === picked)) return picked;
  return options.find((option) => option.isDefault)?.code ?? options[0]?.code ?? null;
}

/** Every option group of the article as tiles, groups in catalogue order. */
export function optionGroups(article: BaseArticle, form: FormValues): readonly OptionGroupView[] {
  const groups: string[] = [];
  for (const option of article.options) if (!groups.includes(option.group)) groups.push(option.group);
  return groups.map((group) => {
    const options = article.options.filter((option) => option.group === group);
    const chosen = chosenOption(options, form.options[group]);
    return { group, label: humanise(group), chosen, tiles: options.map((option) => tileOf(option, chosen)) };
  });
}

/** Whole steps from the minimum, allowing for the rounding of a decimal step, as the drafter checks it. */
const onStep = (def: Pick<ParameterDef, "min" | "step">, value: number): boolean => {
  if (def.min === null || def.step === null || def.step === 0) return true;
  const steps = (value - def.min) / def.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};

/**
 * Whether a value is one the article offers. The sliders cannot reach anything else, and this is
 * checked again before a change is kept, so neither a keyboard nor a hand-written address can
 * leave the approved range.
 */
export function withinRange(def: Pick<ParameterDef, "min" | "max" | "step">, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (def.min !== null && value < def.min) return false;
  if (def.max !== null && value > def.max) return false;
  return onStep(def, value);
}

/** The value of a parameter: the person's, when the article offers it, else the article's default. */
export function parameterValue(def: ParameterDef, given: number | undefined): number {
  const fallback = typeof def.defaultValue === "number" ? def.defaultValue : 0;
  return given !== undefined && withinRange(def, given) ? given : fallback;
}

const sliderOf = (def: ParameterDef, value: number): ParameterSlider => ({
  key: def.key,
  label: humanise(def.key),
  min: def.min ?? 0,
  max: def.max ?? 0,
  step: def.step ?? 1,
  value,
  defaultMm: parameterValue(def, undefined),
  unit: def.unit ?? "mm",
  rangeLabel: `${humanise(def.key)} ${signedMm(value)} · range ${rangeEnd(def.min ?? 0)} to ${rangeEnd(def.max ?? 0)}`,
  notSampled: def.approvedBySampleId === null,
  lockNote: def.approvedBySampleId === null ? NOT_YET_SAMPLED : null,
  ruleId: def.ruleId || RULE_GAP,
  pomLetters: def.pomLetters,
});

/** Every range parameter of the article as a slider. A parameter that is not a range waits for its own control. */
export function parameterSliders(article: BaseArticle, form: FormValues): readonly ParameterSlider[] {
  return article.parameters
    .filter((def) => def.type === "range" && def.min !== null && def.max !== null)
    .map((def) => sliderOf(def, parameterValue(def, form.parameters[def.key])));
}

/** The form the article starts a design in: every group's default option and every parameter's default value. */
export function defaultForm(article: BaseArticle | null): FormValues {
  if (!article) return { options: {}, parameters: {} };
  const options: Record<string, string> = {};
  for (const group of optionGroups(article, { options: {}, parameters: {} })) {
    if (group.chosen) options[group.group] = group.chosen;
  }
  const parameters: Record<string, number> = {};
  for (const def of article.parameters) {
    if (def.type === "range") parameters[def.key] = parameterValue(def, undefined);
  }
  return { options, parameters };
}

/**
 * The form the address asks for, with everything the article does not offer dropped. Text that is
 * not a number, a code the article has no option for, and a value outside the approved range all
 * fall back to the article's own default, so no address can make an unmanufacturable design.
 */
export function resolveForm(article: BaseArticle | null, asked: Readonly<{ options: Readonly<Record<string, string>>; parameters: Readonly<Record<string, string>> }>): FormValues {
  if (!article) return { options: {}, parameters: {} };
  const numbers: Record<string, number> = {};
  for (const [key, text] of Object.entries(asked.parameters)) {
    const value = Number(text);
    if (Number.isFinite(value)) numbers[key] = value;
  }
  return defaultsOver(article, { options: asked.options, parameters: numbers });
}

/** A form over the article's defaults: every unknown key dropped and every value checked. */
export function defaultsOver(article: BaseArticle, asked: FormValues): FormValues {
  const options: Record<string, string> = {};
  for (const group of optionGroups(article, asked)) if (group.chosen) options[group.group] = group.chosen;
  const parameters: Record<string, number> = {};
  for (const def of article.parameters) {
    if (def.type === "range") parameters[def.key] = parameterValue(def, asked.parameters[def.key]);
  }
  return { options, parameters };
}

/** Every option and range the design leans on that no sample has signed off, for the validate list and the summary. */
export function notSampled(article: BaseArticle | null, form: FormValues): readonly Readonly<{ label: string; ruleId: string }>[] {
  if (!article) return [];
  const found: Readonly<{ label: string; ruleId: string }>[] = [];
  for (const group of optionGroups(article, form)) {
    const tile = group.tiles.find((entry) => entry.chosen);
    if (tile?.notSampled) found.push({ label: `${group.label} ${tile.code}`, ruleId: tile.ruleId });
  }
  for (const slider of parameterSliders(article, form)) {
    if (slider.notSampled && slider.value !== slider.defaultMm) found.push({ label: `${slider.label} ${signedMm(slider.value)}`, ruleId: slider.ruleId });
  }
  return found;
}
