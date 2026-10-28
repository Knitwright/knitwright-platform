import { getType, tenthsMmToCm, type GarmentSpec } from "@/lib/garment";
import type { WireAction } from "./reply-schema";

const CM_PER_INCH = 2.54;
const CM_PER_MM = 0.1;
/** Half a millimetre, to allow for rounding when inches are turned into centimetres. */
const TOLERANCE_CM = 0.05;

/** Every number written in the text. "52,5" is also read as 52.5. */
function statedNumbers(text: string): readonly number[] {
  const plain = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const comma = [...text.matchAll(/\d+,\d+/g)].map((match) => Number(match[0].replace(",", ".")));
  return [...plain, ...comma].filter(Number.isFinite);
}

function unitScales(text: string): readonly number[] {
  const scales = [1];
  if (/\d\s*(?:inch|inches|in)\b|\d\s*"|\binch(?:es)?\b/i.test(text)) scales.push(CM_PER_INCH);
  if (/\d\s*mm\b|\bmm\b|millimet/i.test(text)) scales.push(CM_PER_MM);
  return scales;
}

/** The values the person could mean: a number they gave, or the current value moved by one. */
function allowedCm(text: string, currentCm: number | undefined): readonly number[] {
  const amounts = statedNumbers(text).flatMap((number) => unitScales(text).map((scale) => number * scale));
  if (currentCm === undefined) return amounts;
  return [...amounts, ...amounts.flatMap((amount) => [currentCm + amount, currentCm - amount])];
}

function measurementProblem(text: string, spec: GarmentSpec, wire: Extract<WireAction, { type: "set-measurement" }>): string | null {
  const current = spec.measurements.find((entry) => entry.pointId === wire.pointId);
  const allowed = allowedCm(text, current === undefined ? undefined : tenthsMmToCm(current.value));
  if (allowed.some((value) => Math.abs(value - wire.cm) <= TOLERANCE_CM)) return null;
  const label = getType(spec.typeId)?.pointsOfMeasure.find((point) => point.id === wire.pointId)?.label ?? wire.pointId;
  return `The assistant suggested ${wire.cm} cm for ${label}, but that number was not in your message. Measurements are never guessed: type the value you want. Nothing was changed.`;
}

function weightProblem(text: string, wire: Extract<WireAction, { type: "change-fabric" }>): string | null {
  const weight = wire.changes.weightGsm;
  if (weight === undefined || weight === null || statedNumbers(text).includes(weight)) return null;
  return `The assistant suggested ${weight} gsm for the fabric weight, but that number was not in your message. Fabric weights are never guessed: type the value you want. Nothing was changed.`;
}

/**
 * The rule against invented numbers (owner action A5): a measurement or fabric weight a
 * model sets must be a number the person typed, or the current value moved by one.
 * Returns the reason for the first number that breaks it, or null.
 */
export function numberProblem(text: string, spec: GarmentSpec, actions: readonly WireAction[]): string | null {
  for (const wire of actions) {
    const found =
      wire.type === "set-measurement"
        ? measurementProblem(text, spec, wire)
        : wire.type === "change-fabric"
          ? weightProblem(text, wire)
          : null;
    if (found) return found;
  }
  return null;
}
