import { isOffered } from "@/lib/config/launch-garments";
import {
  applyAction,
  checkCombination,
  formatCm,
  getType,
  listTypes,
  pointsOfMeasureFor,
  tenthsMmToCm,
  type GarmentSpec,
  type ResolvedType,
  type SpecAction,
} from "@/lib/garment";
import { plainChoices } from "@/lib/garment/conditions";
import { applyBatch } from "./batch";
import type { FollowUp, FollowUpChoice } from "./outcome";
import { plainIds } from "./plain-ids";
import type { WireAction } from "./reply-schema";

/**
 * Ways on from the parts of a request that could not be made (the assistant audit, item 1).
 * Each part gets one plain sentence and, where there is one, a one-tap way to get what was
 * meant. Everything is worked out from the registry, never from a model's words, and every
 * change offered has been made once already on the design it will apply to.
 */

/** A part of a request that was not made, with the reason the editor gave. */
export interface SkippedPart {
  readonly wire: WireAction;
  readonly reason: string;
}

type SetOption = Extract<WireAction, { type: "set-option" }>;
export type AskAmount = Extract<WireAction, { type: "ask-amount" }>;

/** More ways than this are hard to choose between. */
const MAX_WAYS = 3;
const AMOUNTS_CM = [1, 2, 3] as const;

const article = (label: string): string => (/^[aeiou]/i.test(label) ? `An ${label}` : `A ${label}`);
const lower = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1);

function choiceLabel(type: ResolvedType, optionId: string, choiceId: string): string {
  const option = type.options.find((entry) => entry.id === optionId);
  return [...(option?.choices ?? []), ...(option?.notOffered ?? [])].find((choice) => choice.id === choiceId)?.label ?? choiceId;
}

/** The changes a batch made, or null when it cannot be made. */
function made(spec: GarmentSpec, actions: readonly WireAction[]): readonly SpecAction[] | null {
  const batch = applyBatch(spec, actions);
  return batch.ok && batch.steps.length > 0 ? batch.steps.map((step) => step.action) : null;
}

interface Fixes {
  readonly actions: readonly SetOption[];
  /** The choices the fixes make, as labels, for the button. */
  readonly labels: readonly string[];
}

/**
 * The other options to change so the choice no longer clashes: for each rule it breaks, the
 * other options in the rule move to their default, or to the first choice the rule allows.
 */
function clashFixes(spec: GarmentSpec, wire: SetOption): Fixes {
  const type = getType(spec.typeId);
  if (!type) return { actions: [], labels: [] };
  const chosen = { ...plainChoices(spec.options), [wire.optionId]: wire.choiceId };
  const fixes = new Map<string, string>();
  for (const violation of checkCombination(type.id, chosen)) {
    const rule = type.rules.find((entry) => entry.id === violation.ruleId);
    for (const condition of rule?.when ?? []) {
      const option = type.options.find((entry) => entry.id === condition.option);
      if (!option || option.id === wire.optionId || fixes.has(option.id)) continue;
      const allowed = option.choices.filter((choice) => !condition.in.includes(choice.id));
      const pick = allowed.find((choice) => choice.id === option.defaultChoice) ?? allowed[0];
      if (pick) fixes.set(option.id, pick.id);
    }
  }
  const actions = [...fixes].map(([optionId, choiceId]): SetOption => ({ type: "set-option", optionId, choiceId }));
  return { actions, labels: actions.map((fix) => lower(choiceLabel(type, fix.optionId, fix.choiceId))) };
}

const withFixes = (label: string, fixes: Fixes): string => (fixes.labels.length > 0 ? `${label} (${fixes.labels.join(", ")})` : label);

/** One tap that makes the choice together with the changes it needs. */
function switchChoice(spec: GarmentSpec, type: ResolvedType, wire: SetOption): FollowUpChoice[] {
  const fixes = clashFixes(spec, wire);
  if (fixes.actions.length === 0) return [];
  const actions = made(spec, [...fixes.actions, wire]);
  return actions ? [{ kind: "apply", label: withFixes(`Switch to ${choiceLabel(type, wire.optionId, wire.choiceId)}`, fixes), actions }] : [];
}

/**
 * The garments of the same family, offered and made for the same wearer, that come with the
 * choice: each one a change of type, the choice, and whatever the choice then needs. `rest`
 * are other changes to make with them.
 */
export function typeChangeChoices(spec: GarmentSpec, wire: SetOption, rest: readonly WireAction[] = []): FollowUpChoice[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  return listTypes(type.family)
    .filter((other) => other.id !== type.id && isOffered(other.id) && other.wearers.includes(spec.wearer))
    .filter((other) => other.options.some((option) => option.id === wire.optionId && option.choices.some((choice) => choice.id === wire.choiceId)))
    .flatMap((other): FollowUpChoice[] => {
      const retyped = applyAction(spec, { type: "change-type", typeId: other.id });
      if (!retyped.ok) return [];
      const fixes = clashFixes(retyped.spec, wire);
      const actions = made(spec, [{ type: "change-type", typeId: other.id }, ...rest, ...fixes.actions, wire]);
      return actions ? [{ kind: "apply", label: withFixes(`Change to ${other.label}`, fixes), actions }] : [];
    })
    .slice(0, MAX_WAYS);
}

function optionFollowUp(spec: GarmentSpec, wire: SetOption, reason: string): FollowUp {
  const type = getType(spec.typeId);
  const option = type?.options.find((entry) => entry.id === wire.optionId);
  if (!type || !option) return { text: plainIds(reason), choices: [] };
  const offered = option.choices.some((choice) => choice.id === wire.choiceId);
  if (!offered) {
    return {
      text: `${article(type.label)} does not come with ${choiceLabel(type, wire.optionId, wire.choiceId)} for ${option.label}.`,
      choices: typeChangeChoices(spec, wire),
    };
  }
  const clash = checkCombination(type.id, { ...plainChoices(spec.options), [wire.optionId]: wire.choiceId });
  return { text: clash.length > 0 ? clash.map((entry) => entry.reason).join(" ") : plainIds(reason), choices: switchChoice(spec, type, wire) };
}

/** One part that was not made, why, and the ways on, worked out on the design given. */
export function skippedFollowUp(spec: GarmentSpec, part: SkippedPart): FollowUp {
  if (part.wire.type === "set-option") return optionFollowUp(spec, part.wire, part.reason);
  return { text: plainIds(part.reason), choices: [] };
}

/** The options that set a length a measurement also gives, in the order they are tried. */
const LENGTH_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  "sleeve-length": ["sleeve-length", "sleeves"],
  inseam: ["leg-length"],
  outseam: ["leg-length"],
};

/** The next choice of a length option in the direction asked for, as one tap. */
function lengthChoice(spec: GarmentSpec, wire: AskAmount): FollowUpChoice[] {
  const type = getType(spec.typeId);
  const option = type?.options.find((entry) => (LENGTH_OPTIONS[wire.pointId] ?? []).includes(entry.id));
  if (!type || !option || !Object.hasOwn(spec.options, option.id)) return [];
  const index = option.choices.findIndex((choice) => choice.id === spec.options[option.id].choiceId);
  const next = option.choices[wire.direction === "longer" ? index + 1 : index - 1];
  if (index < 0 || !next) return [];
  const actions = made(spec, [{ type: "set-option", optionId: option.id, choiceId: next.id }]);
  return actions ? [{ kind: "apply", label: next.label, actions }] : [];
}

/**
 * A length asked for without an amount, such as "a bit longer". The amounts offered are sent
 * as the person's own words, so the number is theirs. With no value to add to, it says so
 * and offers to type one; a measurement is never guessed.
 */
export function amountFollowUp(spec: GarmentSpec, wire: AskAmount): FollowUp {
  const point = pointsOfMeasureFor(spec).find((entry) => entry.id === wire.pointId);
  if (!point) {
    const label = getType(spec.typeId)?.pointsOfMeasure.find((entry) => entry.id === wire.pointId)?.label ?? "such measurement";
    return { text: `This design has no ${label} to change.`, choices: [] };
  }
  const name = lower(point.label);
  const word = wire.direction;
  const options = lengthChoice(spec, wire);
  const current = spec.measurements.find((entry) => entry.pointId === wire.pointId);
  if (!current) {
    return {
      text: `The ${name} has no value yet, so it cannot be made ${word} by an amount. Type the ${name} you want.`,
      choices: [{ kind: "fill", label: `Type the ${name}`, text: `Set the ${name} to ` }, ...options],
    };
  }
  const sign = word === "longer" ? "+" : "-";
  const amounts = AMOUNTS_CM.filter((amount) => word === "longer" || tenthsMmToCm(current.value) - amount > 0);
  return {
    text: `How much ${word} should the ${name} be? It is ${formatCm(current.value)} cm now.`,
    choices: [
      ...amounts.map((amount): FollowUpChoice => ({ kind: "say", label: `${sign}${amount} cm`, text: `Make the ${name} ${amount} cm ${word}` })),
      ...options,
    ],
  };
}
