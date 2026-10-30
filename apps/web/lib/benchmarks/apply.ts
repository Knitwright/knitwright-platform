import type { BaseArticle, OptionDef, ParameterDef } from "@/lib/catalogue";
import { functionalFeatures } from "./normalise";
import type { BenchmarkCard } from "./schema";
import { featureOf, RULE_GAP, type Feature } from "./vocabulary";

/**
 * "Apply to my design" (spec F-S2 step 6): the functional features of a benchmark, mapped onto the base article's own
 * approved options and parameter ranges. Nothing else crosses over. A logo, a brand name, a print, a claim and the
 * product's name are left behind by construction: this file reads the feature list and never the words of the card
 * (apply.test.ts proves no part of the plan holds the benchmark's brand or product name).
 *
 * A feature the base article has no option or range for is listed as "not available on this base", which is the
 * honest answer and never a nudge to make the base do it anyway.
 */

export const NOT_AVAILABLE = "Not available on this base.";

/** The kinds of thing that are never carried onto a design, said as kinds, never as the benchmark's own words. */
export const NEVER_CARRIED: readonly Readonly<{ label: string; why: string }>[] = [
  { label: "Brand name", why: "A competitor's name is never put on your design." },
  { label: "Logo or brand mark", why: "A competitor's mark is never put on your design." },
  { label: "Print or graphic", why: "A competitor's artwork is never copied onto your design." },
  { label: "Product name and marketing claims", why: "Their words stay theirs; your design says what it is." },
];

export type MappedFeature = Readonly<{
  featureKey: string;
  featureLabel: string;
  purpose: string;
  /** What the editor would set. */
  target: Readonly<{ kind: "option"; group: string; code: string; label: string } | { kind: "parameter"; key: string; min: number | null; max: number | null; unit: string | null }>;
  /** The rule the catalogue row carries, so the screen can show its "Why?" (F-S5). */
  ruleId: string;
}>;

export type UnsupportedFeature = Readonly<{ featureKey: string; featureLabel: string; message: string; ruleId: string }>;

export type ApplyPlan = Readonly<{
  articleCode: string;
  mapped: readonly MappedFeature[];
  unsupported: readonly UnsupportedFeature[];
  neverCarried: typeof NEVER_CARRIED;
}>;

const holds = (option: OptionDef, words: readonly string[]): boolean => {
  const haystack = `${option.label} ${option.code}`.toLowerCase();
  return words.some((word) => haystack.includes(word.toLowerCase()));
};

const matchOption = (feature: Feature, options: readonly OptionDef[]): MappedFeature | null => {
  const hint = feature.catalogue;
  if (hint?.words === undefined) return null;
  const inGroup = hint.optionGroup === undefined ? options : options.filter((option) => option.group === hint.optionGroup);
  const found = (inGroup.length > 0 ? inGroup : options).find((option) => holds(option, hint.words ?? []));
  if (found === undefined) return null;
  return {
    featureKey: feature.key,
    featureLabel: feature.label,
    purpose: feature.purpose,
    target: { kind: "option", group: found.group, code: found.code, label: found.label },
    ruleId: found.ruleId,
  };
};

const matchParameter = (feature: Feature, parameters: readonly ParameterDef[]): MappedFeature | null => {
  const key = feature.catalogue?.parameterKey;
  if (key === undefined) return null;
  const found = parameters.find((parameter) => parameter.key === key);
  if (found === undefined) return null;
  return {
    featureKey: feature.key,
    featureLabel: feature.label,
    purpose: feature.purpose,
    target: { kind: "parameter", key: found.key, min: found.min, max: found.max, unit: found.unit },
    ruleId: found.ruleId,
  };
};

/**
 * The plan for one card against one base article. `chosen` is the feature keys the user ticked; with none given, every
 * functional feature of the card is considered.
 */
export function applyPlan(card: BenchmarkCard, article: BaseArticle, chosen?: readonly string[]): ApplyPlan {
  const wanted = functionalFeatures(card)
    .map((found) => found.key)
    .filter((key) => chosen === undefined || chosen.includes(key));
  const mapped: MappedFeature[] = [];
  const unsupported: UnsupportedFeature[] = [];
  for (const key of wanted) {
    const feature = featureOf(key);
    if (feature === undefined) continue;
    const match = matchParameter(feature, article.parameters) ?? matchOption(feature, article.options);
    if (match === null) unsupported.push({ featureKey: key, featureLabel: feature.label, message: NOT_AVAILABLE, ruleId: RULE_GAP });
    else mapped.push(match);
  }
  return { articleCode: article.code, mapped, unsupported, neverCarried: NEVER_CARRIED };
}
