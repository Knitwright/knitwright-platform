import { isOffered, notOfferedChange, notOfferedReason } from "@/lib/config/launch-garments";
import type { GarmentSpec } from "@/lib/garment";
import { NOTHING_CHANGED } from "./batch";
import { findMentions } from "./mentions";
import { rejection, type IntentOutcome } from "./outcome";

/**
 * The beta offers only the launch garments (lib/config/launch-garments, decision 0027). A
 * request that names another garment gets a plain answer that it is not offered yet, and is
 * never quietly read as a different garment. The golden sets test reading words, not what is
 * on sale, so they call the resolvers directly and skip this.
 */

/**
 * The answer to a message that names a garment type not offered yet, or null. A design that
 * already is that garment may still talk about it. Pure: no model is asked.
 */
export function namedNotOffered(utterance: string, spec?: GarmentSpec): string | null {
  const named = notOfferedTypeNamed(utterance, spec);
  return named === undefined ? null : `${notOfferedReason(named)} ${NOTHING_CHANGED}`;
}

/** The first garment type the words name, not refused, that is not offered yet. */
export function notOfferedTypeNamed(utterance: string, spec?: GarmentSpec): string | undefined {
  return findMentions(utterance)
    .filter((mention) => !mention.negated && mention.target.startsWith("type:"))
    .map((mention) => mention.target.slice("type:".length))
    .find((typeId) => typeId !== spec?.typeId && !isOffered(typeId));
}

/** Any outcome that offers changes: a change, a question's choices, or a picture's proposal. */
type Offering =
  | IntentOutcome
  | Readonly<{ kind: "proposal"; actions: readonly { type: string; typeId?: string }[] }>;

/**
 * The outcome with every change to a garment that is not offered taken out. A change or a
 * proposal that makes one is refused as a whole; a question loses those choices, and with
 * fewer than two left it is no longer a choice, so the reason is given instead.
 */
export function withinLaunch<T extends Offering>(outcome: T, spec: GarmentSpec): T | ReturnType<typeof rejection> {
  if (outcome.kind === "applied" || outcome.kind === "proposal") {
    const refused = notOfferedChange(spec, outcome.actions);
    return refused === null ? outcome : rejection(`${refused} ${NOTHING_CHANGED}`);
  }
  if (outcome.kind !== "question") return outcome;
  const kept = outcome.choices.filter((choice) => notOfferedChange(spec, choice.actions) === null);
  if (kept.length === outcome.choices.length) return outcome;
  if (kept.length < 2) {
    const refused = outcome.choices.map((choice) => notOfferedChange(spec, choice.actions)).find((reason) => reason !== null);
    return rejection(`${refused ?? ""} ${NOTHING_CHANGED}`);
  }
  const recommended = kept.indexOf(outcome.choices[outcome.recommended]);
  return { ...outcome, choices: kept, recommended: recommended < 0 ? 0 : recommended };
}
