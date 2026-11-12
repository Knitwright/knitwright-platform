import { z } from "zod";
import type { BaseArticle, OptionDef, ParameterDef } from "@/lib/catalogue/types";
import { NOT_YET_SAMPLED } from "@/lib/catalogue/vocabulary";
import { groupLabel } from "@/lib/home/catalogue-view";
import type { OptionCodeMapping } from "@/lib/option-codes";

/**
 * The product configurator (09 screen 28, prototype p04; spec decision 5, "manufacturable by construction").
 *
 * Its chips are the article's own option groups and length ranges. An option the factory has not sampled is shown
 * with 🔒 and cannot be picked; the default is always open, because it is the base the article is drawn as. A length
 * range offers its steps from the range on file; a step other than the base length opens once a sample at it exists
 * and is then set in the editor's Options, so here it is shown and locked.
 *
 * CREATE MY DESIGN sends the chosen option codes. The server checks every one again against the rows, and turns
 * each into the registry's own choice through the option code map (decision 0099). A code the map has no registry
 * choice for is not applied, and the editor says which.
 */

export interface Chip {
  readonly value: string;
  readonly label: string;
  /** Why it cannot be picked, or null when it can. */
  readonly locked: string | null;
  readonly isDefault: boolean;
}

export interface ChipGroup {
  readonly id: string;
  readonly label: string;
  /** A group of option codes is sent; a length group is only shown. */
  readonly kind: "option" | "length" | "fixed";
  readonly chips: readonly Chip[];
  readonly ruleId: string | null;
}

/** "Crew neck" from "Crew neck, 1x1 rib, 20 mm finished": the chip is short, and the full words are its title. */
export const shortLabel = (label: string): string => label.split(",")[0]!.trim();

const optionChip = (option: OptionDef): Chip => ({
  value: option.code,
  label: shortLabel(option.label),
  locked: option.isDefault || option.approvedBySampleId !== null ? null : NOT_YET_SAMPLED,
  isDefault: option.isDefault,
});

function optionGroups(options: readonly OptionDef[]): readonly ChipGroup[] {
  const groups = [...new Set(options.map((option) => option.group))];
  return groups.map((group) => {
    const own = options.filter((option) => option.group === group);
    return { id: group, label: groupLabel(group), kind: "option", chips: own.map(optionChip), ruleId: own[0]?.ruleId ?? null };
  });
}

const signed = (value: number, unit: string): string => (value === 0 ? "Standard" : `${value > 0 ? "+" : "−"}${Math.abs(value)} ${unit}`);

const SET_IN_EDITOR = "Set in the editor's Options once sampled";

/** The steps of one length range, from the range on file. Null where the range has no ends or step yet. */
function lengthGroup(parameter: ParameterDef): ChipGroup | null {
  const { min, max, step } = parameter;
  if (min === null || max === null || step === null || step <= 0) return null;
  const unit = parameter.unit ?? "mm";
  const values: number[] = [];
  for (let value = min; value <= max && values.length < 20; value += step) values.push(value);
  const base = typeof parameter.defaultValue === "number" ? parameter.defaultValue : 0;
  return {
    id: parameter.key,
    label: groupLabel(parameter.key.replace(/_offset$/, "")),
    kind: "length",
    chips: values.map((value) => ({
      value: String(value),
      label: signed(value - base, unit),
      locked: value === base ? null : parameter.approvedBySampleId === null ? NOT_YET_SAMPLED : SET_IN_EDITOR,
      isDefault: value === base,
    })),
    ruleId: parameter.ruleId,
  };
}

/** Every group the configurator shows: fit, the option groups, then the length ranges. */
export function configuratorGroups(article: BaseArticle): readonly ChipGroup[] {
  const fit: readonly ChipGroup[] =
    article.fit === null
      ? []
      : [{ id: "fit", label: "Fit", kind: "fixed", chips: [{ value: article.fit, label: groupLabel(article.fit), locked: null, isDefault: true }], ruleId: null }];
  const lengths = article.parameters.filter((parameter) => parameter.type === "range").map(lengthGroup);
  return [...fit, ...optionGroups(article.options), ...lengths.filter((group): group is ChipGroup => group !== null)];
}

/** The chips picked when the modal opens: each group's default. */
export const defaultChoices = (groups: readonly ChipGroup[]): Readonly<Record<string, string>> =>
  Object.fromEntries(
    groups.filter((group) => group.kind === "option").flatMap((group) => {
      const chip = group.chips.find((one) => one.isDefault) ?? group.chips.find((one) => one.locked === null);
      return chip ? [[group.id, chip.value]] : [];
    }),
  );

export const chosenOptionsSchema = z.record(z.string().regex(/^[a-z][a-z_]{0,39}$/), z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/));

export type ChoiceCheck = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: string }>;

/** Checks the choices again on the server: every group and code exists on the article and may be picked. */
export function checkChoices(article: BaseArticle, chosen: Readonly<Record<string, string>>): ChoiceCheck {
  for (const [group, code] of Object.entries(chosen)) {
    const option = article.options.find((one) => one.group === group && one.code === code);
    if (!option) return { ok: false, reason: `${article.name} has no ${groupLabel(group).toLowerCase()} option ${code}.` };
    if (!option.isDefault && option.approvedBySampleId === null) {
      return { ok: false, reason: `${shortLabel(option.label)} is not sampled yet, so it cannot be chosen.` };
    }
  }
  return { ok: true };
}

export type RegistryChoice = Readonly<{ optionId: string; choiceId: string }>;

/** The registry choices the chosen codes stand for, through the rows of the option code map that join them. */
export function registryChoicesFor(map: readonly OptionCodeMapping[], chosen: Readonly<Record<string, string>>): readonly RegistryChoice[] {
  return Object.entries(chosen).flatMap(([group, code]) =>
    map
      .filter((row) => row.kind === "mapped" && row.optionGroup === group && row.optionCode === code && row.registryKey !== null && row.registryChoice !== null)
      .map((row) => ({ optionId: row.registryKey!, choiceId: row.registryChoice! })),
  );
}
