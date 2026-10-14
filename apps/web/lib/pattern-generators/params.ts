import type { ParamSpec } from "@/lib/artwork-stack/generator";

/** A setting with its plain wording. `noun` is the thing it sizes ("camo blob"), `choices` the names of a pick-one setting (the value is the position). */
export interface WordedParam extends ParamSpec {
  readonly noun?: string;
  readonly choices?: readonly string[];
}

export interface GeneratorParam extends WordedParam {
  readonly default: number;
}

export type Values = Readonly<Record<string, number>>;

const clampTo = (spec: ParamSpec, value: number): number => {
  const stepped = spec.unit === "none" || spec.unit === "count" ? Math.round(value) : value;
  return Math.min(spec.max, Math.max(spec.min, stepped));
};

/** Every setting as a number inside its range. A missing, wrong or out of range value becomes the nearest allowed one, or the default. */
export function resolveParams(specs: readonly GeneratorParam[], given: Readonly<Record<string, number | string | boolean>>): Values {
  return Object.fromEntries(
    specs.map((spec) => {
      const value = given[spec.id];
      return [spec.id, typeof value === "number" && Number.isFinite(value) ? clampTo(spec, value) : spec.default];
    }),
  );
}

/** A length in centimetres as a person says it: 12 cm, 2.5 cm. */
export const cmText = (mm: number): string => `${Math.round(mm) / 10} cm`;

export function valueText(spec: ParamSpec, value: number): string {
  if (spec.unit === "mm") return cmText(value);
  if (spec.unit === "degrees") return `${Math.round(value)} degrees`;
  if (spec.unit === "ratio") return `${Math.round(value * 100)} percent`;
  if (spec.unit === "yes-no") return value >= 1 ? "yes" : "no";
  return String(Math.round(value));
}

export const choiceName = (spec: WordedParam, value: number): string | undefined => spec.choices?.[Math.round(value)];

/** The value as shown to a person: a choice by name, else with its unit. */
export const showValue = (spec: WordedParam, value: number): string => choiceName(spec, value) ?? valueText(spec, value);

/** Plain sentence when an ask goes past an end of the range. */
export function limitSentence(spec: WordedParam, edge: "min" | "max"): string {
  const thing = spec.noun ?? spec.label.toLowerCase();
  return `${edge === "max" ? "Largest" : "Smallest"} ${thing} is ${showValue(spec, spec[edge])}.`;
}
