import { getType } from "@/lib/garment";
import type { Step } from "./batch";
import { choiceTarget, findMentions, isStated, typeTarget, wearerTarget } from "./mentions";

/**
 * How each option is treated by the ambiguity rules. A construction option changes how the
 * garment is made, so a model may not change it unless the person named the new choice.
 * A style option may follow from a looser request, such as "make it roomier".
 * An option missing from this list is treated as construction, the careful side.
 */
export const OPTION_KINDS: Readonly<Record<string, "construction" | "style">> = {
  fit: "style",
  neckline: "construction",
  collar: "construction",
  placket: "construction",
  "sleeve-type": "construction",
  "sleeve-length": "construction",
  "hem-shape": "construction",
  "side-panels": "construction",
  cuffs: "construction",
};

export const isConstruction = (optionId: string): boolean => OPTION_KINDS[optionId] !== "style";

const WEARER_WORDS: Readonly<Record<string, string>> = { men: "men", women: "women", youth: "youth" };

function choiceLabel(typeId: string, optionId: string, choiceId: string | undefined): string {
  if (choiceId === undefined) return "nothing";
  const option = getType(typeId)?.options.find((entry) => entry.id === optionId);
  return [...(option?.choices ?? []), ...(option?.notOffered ?? [])].find((choice) => choice.id === choiceId)?.label ?? choiceId;
}

/** A sentence for a change the person did not name, or null when they named it or it changes nothing. */
function unstated(step: Step, stated: (target: string) => boolean): string | null {
  const { wire, before } = step;
  if (wire.type === "change-type") {
    if (wire.typeId === before.typeId || stated(typeTarget(wire.typeId))) return null;
    const label = (id: string): string => getType(id)?.label ?? id;
    return `the garment type from ${label(before.typeId)} to ${label(wire.typeId)}`;
  }
  if (wire.type === "change-wearer") {
    if (wire.wearer === before.wearer || stated(wearerTarget(wire.wearer))) return null;
    return `the wearer from ${WEARER_WORDS[before.wearer]} to ${WEARER_WORDS[wire.wearer]}`;
  }
  if (wire.type === "set-option" && isConstruction(wire.optionId)) {
    const was = Object.hasOwn(before.options, wire.optionId) ? before.options[wire.optionId].choiceId : undefined;
    if (was === wire.choiceId || stated(choiceTarget(wire.optionId, wire.choiceId))) return null;
    const option = getType(before.typeId)?.options.find((entry) => entry.id === wire.optionId);
    return `${option?.label ?? wire.optionId} from ${choiceLabel(before.typeId, wire.optionId, was)} to ${choiceLabel(before.typeId, wire.optionId, wire.choiceId)}`;
  }
  return null;
}

/**
 * The ambiguity rules. Any change of garment type, wearer or construction that the person
 * did not name outright is listed, one phrase each, so it becomes a question. Deterministic:
 * it reads only the person's words and the changes, never the model's confidence.
 */
export function unstatedChanges(utterance: string, steps: readonly Step[]): { readonly steps: readonly Step[]; readonly phrases: readonly string[] } {
  const mentions = findMentions(utterance);
  const stated = (target: string): boolean => isStated(mentions, target);
  const found = steps.flatMap((step) => {
    const phrase = unstated(step, stated);
    return phrase === null ? [] : [{ step, phrase }];
  });
  return { steps: found.map((entry) => entry.step), phrases: found.map((entry) => entry.phrase) };
}
