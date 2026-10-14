import type { ParamSpec, ParamValue, PatternGenerator } from "@/lib/artwork-stack/generator";
import { choicesOf } from "./choices";
import { ALL_GENERATORS } from "./registry";

/**
 * The generators as the assistant sees them: each setting with its unit, range, default and the plain words that
 * move it. The assistant moves a setting by whole steps; it never invents a number. A step past the end of a range
 * stops there and says so.
 */

export interface AssistantParam {
  readonly id: string;
  readonly label: string;
  readonly unit: ParamSpec["unit"];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number | null;
  readonly up: readonly string[];
  readonly down: readonly string[];
  /** The names of the choices, for a setting that picks from a list. */
  readonly choices?: readonly string[];
}

export interface AssistantGenerator {
  readonly id: string;
  readonly label: string;
  readonly repeat: PatternGenerator["repeat"]["kind"];
  readonly maxColours: number;
  readonly params: readonly AssistantParam[];
}

export function assistantSchema(generator: PatternGenerator): AssistantGenerator {
  return {
    id: generator.id,
    label: generator.label,
    repeat: generator.repeat.kind,
    maxColours: generator.maxColours,
    params: generator.params.map((spec) => {
      const choices = choicesOf(generator.id, spec.id);
      return {
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        min: spec.min,
        max: spec.max,
        step: spec.step,
        default: spec.default,
        up: spec.words?.up ?? [],
        down: spec.words?.down ?? [],
        ...(choices === undefined ? {} : { choices }),
      };
    }),
  };
}

export const assistantSchemas = (generators: readonly PatternGenerator[] = ALL_GENERATORS): readonly AssistantGenerator[] => generators.map(assistantSchema);

export type Direction = "up" | "down";

export interface Step {
  readonly paramId: string;
  readonly label: string;
  readonly before: number;
  readonly after: number;
  /** True when the step was cut short by the end of the range. */
  readonly clamped: boolean;
  readonly sentence: string;
}

const normal = (word: string): string => word.trim().toLowerCase();

/** The setting and direction a plain word moves, or null when no setting of this generator uses it. */
export function paramForWord(generator: PatternGenerator, word: string): { readonly paramId: string; readonly direction: Direction } | null {
  const said = normal(word);
  for (const spec of generator.params) {
    if (spec.words?.up.includes(said)) return { paramId: spec.id, direction: "up" };
    if (spec.words?.down.includes(said)) return { paramId: spec.id, direction: "down" };
  }
  return null;
}

/** A length as a person says it: centimetres from 10 cm, else millimetres. */
export const lengthText = (mm: number): string => (mm >= 100 ? `${Math.round(mm) / 10} cm` : `${Math.round(mm * 10) / 10} mm`);

const valueText = (spec: ParamSpec, value: number): string => {
  if (spec.unit === "mm") return lengthText(value);
  if (spec.unit === "degrees") return `${value} degrees`;
  return `${Math.round(value * 100) / 100}`;
};

const lowered = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1);

/** What a setting is now: the value given, else the default. */
export const currentValue = (spec: ParamSpec, params: Readonly<Record<string, ParamValue>>): number => {
  const given = params[spec.id];
  return typeof given === "number" ? given : (spec.default ?? spec.min);
};

/** Moves one setting by `times` steps and says what happened, including when the end of its range stopped it. */
export function stepParam(generator: PatternGenerator, params: Readonly<Record<string, ParamValue>>, paramId: string, direction: Direction, times = 1): Step | null {
  const spec = generator.params.find((entry) => entry.id === paramId);
  if (spec === undefined) return null;
  const before = currentValue(spec, params);
  const wanted = before + (direction === "up" ? 1 : -1) * spec.step * Math.max(1, times);
  const after = Math.round(Math.min(spec.max, Math.max(spec.min, wanted)) * 1000) / 1000;
  const clamped = after !== Math.round(wanted * 1000) / 1000;
  const edge = direction === "up" ? `Largest ${lowered(generator.label)} ${lowered(spec.label)} is ${valueText(spec, spec.max)}.` : `Smallest ${lowered(generator.label)} ${lowered(spec.label)} is ${valueText(spec, spec.min)}.`;
  const moved = `${spec.label}: ${valueText(spec, before)} to ${valueText(spec, after)}.`;
  return { paramId, label: spec.label, before, after, clamped, sentence: clamped ? (after === before ? edge : `${moved} ${edge}`) : moved };
}

/** Picks a choice by its name ("hexagons"), or null when this setting has no such choice. */
export function chooseOption(generator: PatternGenerator, params: Readonly<Record<string, ParamValue>>, paramId: string, name: string): Step | null {
  const spec = generator.params.find((entry) => entry.id === paramId);
  const at = choicesOf(generator.id, paramId)?.indexOf(normal(name)) ?? -1;
  if (spec === undefined || at < 0) return null;
  const before = currentValue(spec, params);
  return { paramId, label: spec.label, before, after: at, clamped: false, sentence: `${spec.label}: ${choicesOf(generator.id, paramId)?.[before] ?? before} to ${normal(name)}.` };
}
