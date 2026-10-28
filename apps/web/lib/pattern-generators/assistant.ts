import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import { GENERATORS, NEW_GENERATORS, getLibraryGenerator } from "./registry";
import { choiceName, limitSentence, showValue, type WordedParam } from "./params";
import { presetsFor } from "./presets";

/**
 * What the assistant needs: every style and setting with its unit, range, step and plain words, and the rule that turns
 * words into steps. "Bigger" moves a setting up by its own step, never to a number the assistant made up; a step that
 * would pass an end of the range stops at the end and says so.
 */

interface SchemaParam {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number | null;
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly choices: readonly string[];
}

interface SchemaEntry {
  readonly id: string;
  readonly label: string;
  readonly repeat: "tile" | "field";
  readonly maxColours: number;
  readonly params: readonly SchemaParam[];
  readonly presets: readonly { readonly id: string; readonly label: string }[];
}

const paramEntry = (spec: WordedParam): SchemaParam => ({
  id: spec.id,
  label: spec.label,
  unit: spec.unit,
  min: spec.min,
  max: spec.max,
  step: spec.step,
  default: spec.default,
  up: spec.words?.up ?? [],
  down: spec.words?.down ?? [],
  choices: spec.choices ?? [],
});

export const schemaOf = (generator: PatternGenerator): SchemaEntry => ({
  id: generator.id,
  label: generator.label,
  repeat: generator.repeat.kind,
  maxColours: generator.maxColours,
  params: generator.params.map(paramEntry),
  presets: presetsFor(generator.id).map(({ id, label }) => ({ id, label })),
});

/** The schema for the assistant's tool: every style the platform can draw. */
export const assistantSchema = (): SchemaEntry[] => GENERATORS.map(schemaOf);

export type Direction = "up" | "down";

export interface WordStep {
  readonly paramId: string;
  readonly direction: Direction;
  readonly steps: number;
}

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, word: string): boolean => new RegExp(`(^|[^a-z])${escape(word)}([^a-z]|$)`, "i").test(text);

const LOTS = ["a lot", "much", "far", "way", "loads", "heaps"];
const LITTLE = ["a bit", "a little", "slightly", "bit", "little", "touch"];
const BIG_MOVE = 3;

/** How many steps a clause asks for: "a lot" is three, anything else is one. */
export const stepsAsked = (clause: string): number => (LOTS.some((word) => has(clause, word)) && !LITTLE.some((word) => has(clause, word)) ? BIG_MOVE : 1);

/** Splits words into the parts a person joins with "and", a comma or "but". */
const clausesOf = (text: string): string[] => text.split(/\band\b|,|\bbut\b|;/i).map((part) => part.trim()).filter((part) => part !== "");

/** The steps the words ask for in one style. A setting is moved at most once per direction; the first asked wins. */
export function wordsToSteps(generator: Pick<PatternGenerator, "params">, text: string): WordStep[] {
  const found = clausesOf(text).flatMap((clause) =>
    generator.params.flatMap((spec): WordStep[] =>
      (["up", "down"] as const).flatMap((direction) =>
        (spec.words?.[direction] ?? []).some((word) => has(clause, word)) ? [{ paramId: spec.id, direction, steps: stepsAsked(clause) }] : [],
      ),
    ),
  );
  return found.filter((step, at) => found.findIndex((other) => other.paramId === step.paramId) === at);
}

/** A pick-one setting named in words ("diamonds", "graduated"). */
export function choicesFromWords(generator: Pick<PatternGenerator, "params">, text: string): Record<string, number> {
  return Object.fromEntries(
    generator.params.flatMap((spec: WordedParam) => {
      const at = (spec.choices ?? []).findIndex((name) => has(text, name) || has(text, `${name}s`));
      return at < 0 ? [] : [[spec.id, at]];
    }),
  );
}

/** The style a person's words name: by its label or another name it goes by. The newer styles come first, so "fade" is the fade generator, of which the old fade is a preset. */
export function generatorFromWords(text: string): PatternGenerator | undefined {
  const named = (entry: PatternGenerator): boolean => has(text, entry.label.toLowerCase()) || (getLibraryGenerator(entry.id)?.aliases ?? []).some((alias) => has(text, alias));
  return [...NEW_GENERATORS, ...GENERATORS].find(named);
}

interface ParamChange {
  readonly paramId: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
  readonly beforeValue: number;
  readonly afterValue: number;
  /** True when the step stopped at the end of the range. */
  readonly clamped: boolean;
}

interface StepOutcome {
  /** The new settings: the old ones with each moved setting changed. */
  readonly params: Readonly<Record<string, number | string | boolean>>;
  readonly changes: readonly ParamChange[];
  /** Plain sentences about ends of the range and settings that could not be moved. */
  readonly sentences: readonly string[];
}

const tidy = (value: number): number => Math.round(value * 1000) / 1000;

/** Moves settings by their own steps. Values stay inside the range; what was left out is said. */
export function applySteps(generator: Pick<PatternGenerator, "params">, current: Readonly<Record<string, number | string | boolean>>, steps: readonly WordStep[]): StepOutcome {
  const moved = steps.map((step) => {
    const spec = generator.params.find((entry) => entry.id === step.paramId);
    const held = current[step.paramId];
    const from = typeof held === "number" ? held : spec?.default;
    if (spec === undefined || typeof from !== "number") return { sentence: `${spec?.label ?? step.paramId} has no set value yet, so say how much, in centimetres.` };
    const wanted = tidy(from + (step.direction === "up" ? 1 : -1) * spec.step * step.steps);
    const to = Math.min(spec.max, Math.max(spec.min, wanted));
    const edge = wanted > spec.max ? "max" : wanted < spec.min ? "min" : null;
    const change: ParamChange = { paramId: spec.id, label: spec.label, before: showValue(spec, from), after: showValue(spec, to), beforeValue: from, afterValue: to, clamped: edge !== null };
    return { change, sentence: edge === null ? undefined : limitSentence(spec, edge) };
  });
  const changes = moved.flatMap((entry) => ("change" in entry && entry.change !== undefined && entry.change.beforeValue !== entry.change.afterValue ? [entry.change] : []));
  return {
    params: { ...current, ...Object.fromEntries(changes.map((change) => [change.paramId, change.afterValue])) },
    changes,
    sentences: moved.flatMap((entry) => (entry.sentence === undefined ? [] : [entry.sentence])),
  };
}

export const choiceLabel = (spec: WordedParam, value: number): string => choiceName(spec, value) ?? String(value);
