/**
 * Test support. Designs and MADE-UP measurements for the drawing tests. The numbers are
 * invented so a drawing has something realistic to work with. They are not measurements
 * of any garment and must never be loaded as real size chart data.
 */
import { listTypes, pointsOfMeasureFor, type GarmentSpec } from "@/lib/garment";
import { allCombinations, type Choices } from "@/lib/garment/fixtures/combinations";
import { start } from "@/lib/garment/fixtures/specs";
import { checkCombination, validateSpec } from "@/lib/garment";
import { resolveMeasurements, type Resolution } from "@/lib/sizing";

export const TOPS_TYPE_IDS = ["crew-tee", "v-neck-tee", "long-sleeve-tee", "polo", "team-jersey"] as const;

/** A made-up set of measurements in tenths of a millimetre, chosen to fit the options. */
export function madeUpValues(choices: Choices, scale = 1): Readonly<Record<string, number>> {
  const raglan = choices["sleeve-type"] === "raglan";
  const long = choices["sleeve-length"] === "long";
  const vNeck = choices.neckline === "v-neck";
  const polo = choices.collar === "polo-collar";
  const bandCollar = choices.collar === "band-collar";
  const base: Record<string, number> = {
    "chest-width": 5200,
    "body-length": 7000,
    "shoulder-width": 4600,
    "sleeve-length": raglan ? (long ? 6600 : 2900) : long ? 6100 : 2200,
    armhole: raglan ? 3200 : 2300,
    "upper-arm": raglan ? (long ? 1050 : 1650) : long ? 1400 : 1900,
    "sleeve-opening": long ? 1000 : 1700,
    "hem-width": 5200,
    "neck-width": polo ? 1500 : bandCollar ? 1600 : 1800,
    "front-neck-drop": vNeck ? 1500 : 850,
    "back-neck-drop": 200,
    "collar-height": bandCollar ? 500 : 600,
    "placket-length": 1200,
    "placket-width": 320,
  };
  return Object.fromEntries(Object.entries(base).map(([id, value]) => [id, Math.round(value * scale)]));
}

/** The choice each option starts with for a type, as the registry says. */
export function defaultChoices(typeId: string): Choices {
  return Object.fromEntries(Object.entries(start(typeId).options).map(([optionId, choice]) => [optionId, choice.choiceId]));
}

/** Made-up measurements that suit a type with these choices on top of its starting choices. */
export const madeUpForType = (typeId: string, choices: Choices, scale = 1): Readonly<Record<string, number>> =>
  madeUpValues({ ...defaultChoices(typeId), ...choices }, scale);

/** A design of a type with these choices. Every choice is marked as typed in by a person. */
export function designWith(typeId: string, choices: Choices, values?: Readonly<Record<string, number>>): GarmentSpec {
  const base = start(typeId);
  const options = Object.fromEntries(
    Object.entries(choices).map(([optionId, choiceId]) => [optionId, { choiceId, provenance: "user-edited" as const }]),
  );
  const draft: GarmentSpec = { ...base, options: { ...base.options, ...options } };
  const measurements = values
    ? pointsOfMeasureFor(draft)
        .filter((point) => values[point.id] !== undefined)
        .map((point) => ({ pointId: point.id, value: values[point.id] as number, provenance: "user-edited" as const }))
    : [];
  const checked = validateSpec({ ...draft, measurements });
  if (!checked.ok) throw new Error(checked.issues.join(" "));
  return checked.spec;
}

/** What the sizing library says about a design that has only the measurements typed in. */
export function typedIn(spec: GarmentSpec): Resolution {
  return resolveMeasurements(spec, "");
}

const valid = (typeId: string): Choices[] =>
  allCombinations(typeId).filter((choices) => checkCombination(typeId, choices).length === 0);

const pairsOf = (choices: Choices): string[] => {
  const entries = Object.entries(choices);
  return entries.flatMap(([a, x], i) => entries.slice(i + 1).map(([b, y]) => `${a}=${x}|${b}=${y}`));
};

/**
 * A short list of combinations in which every choice of every option meets every choice
 * of every other option at least once, wherever the rules allow it (all pairs sampling).
 */
export function pairwise(typeId: string): Choices[] {
  const candidates = valid(typeId);
  const uncovered = new Set(candidates.flatMap(pairsOf));
  const picked: Choices[] = [];
  while (uncovered.size > 0) {
    let best: Choices | undefined;
    let bestGain = 0;
    for (const candidate of candidates) {
      const gain = pairsOf(candidate).filter((pair) => uncovered.has(pair)).length;
      if (gain > bestGain) {
        best = candidate;
        bestGain = gain;
      }
    }
    if (!best) break;
    picked.push(best);
    for (const pair of pairsOf(best)) uncovered.delete(pair);
  }
  return picked;
}

export const allTopsTypes = (): readonly string[] => listTypes("tops").map((type) => type.id);
