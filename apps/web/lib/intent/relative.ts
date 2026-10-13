import { pointsOfMeasureFor, tenthsMmToCm, type GarmentSpec } from "@/lib/garment";
import { NOTHING_CHANGED } from "./batch";
import type { WireAction } from "./reply-schema";

/**
 * "Make the sleeve length 2 cm longer": the words the assistant's amount buttons send, and
 * that a person may type. They are read here without any model, so the amount is the
 * person's own and costs nothing. The value only moves when there is one to move; with none
 * the person is asked for it, never given a guess.
 */

const RELATIVE = /^\s*make the ([a-z][a-z ,'-]*?) (\d+(?:[.,]\d+)?) ?cm (longer|shorter)\.?\s*$/i;

type RelativeReply =
  | { readonly kind: "changes"; readonly actions: readonly WireAction[] }
  | { readonly kind: "rejection"; readonly reason: string };

/** True when the words are a length moved by an amount in centimetres. Needs no design, so the route can price it. */
export const looksRelative = (utterance: string): boolean => RELATIVE.test(utterance);

/** Rounded to a hundredth of a centimetre, the finest a measurement keeps. */
const hundredths = (cm: number): number => Math.round(cm * 100) / 100;

/** The reply a model would give to such words, or null for any other words. */
export function relativeReply(utterance: string, spec: GarmentSpec): RelativeReply | null {
  const match = RELATIVE.exec(utterance);
  if (!match) return null;
  const [, named, amountText, way] = match;
  const name = named.trim().toLowerCase();
  const direction = way.toLowerCase() === "longer" ? "longer" : "shorter";
  const point = pointsOfMeasureFor(spec).find((entry) => entry.label.toLowerCase() === name);
  if (!point) return { kind: "rejection", reason: `This design has no measurement called ${name}. ${NOTHING_CHANGED}` };
  const current = spec.measurements.find((entry) => entry.pointId === point.id);
  if (!current) return { kind: "changes", actions: [{ type: "ask-amount", pointId: point.id, direction }] };
  const amount = Number(amountText.replace(",", "."));
  const cm = hundredths(tenthsMmToCm(current.value) + (direction === "longer" ? amount : -amount));
  if (cm <= 0) return { kind: "rejection", reason: `That would leave the ${name} at nothing. ${NOTHING_CHANGED}` };
  return { kind: "changes", actions: [{ type: "set-measurement", pointId: point.id, cm }] };
}
