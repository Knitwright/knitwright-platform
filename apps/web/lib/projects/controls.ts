import { PROVENANCE_LABELS, availableChoices, getType, type GarmentSpec, type Provenance } from "@/lib/garment";
import { toneOf, type Tone } from "./provenance-tone";

export interface ChoiceView {
  readonly choiceId: string;
  readonly label: string;
  readonly help: string | null;
  /** False when choosing it would break a rule. The reason says why. */
  readonly available: boolean;
  readonly reason: string | null;
  /** True only for a choice that a person made or that the type starts with. */
  readonly selected: boolean;
}

export interface OptionControl {
  readonly optionId: string;
  readonly label: string;
  readonly help: string | null;
  readonly choices: readonly ChoiceView[];
  /** Who chose the current value, in plain words. */
  readonly provenanceLabel: string;
  readonly tone: Tone;
  /** The label of a suggested choice that nobody has confirmed, otherwise null. */
  readonly suggestion: string | null;
}

const NOT_CHOSEN = "Not chosen yet";
const STARTING_CHOICE = "Starting choice";

/** Who chose an option, in words. A choice nobody made is the garment type's starting choice. */
const sourceLabel = (provenance: Provenance): string =>
  provenance === "derived" ? STARTING_CHOICE : PROVENANCE_LABELS[provenance];

/**
 * One control for every option of the design's garment type, built from the registry
 * alone. The screen names no option, choice or garment type: whatever the registry
 * holds is what appears. A suggested value (from a chart or the assistant) is not
 * shown as selected until a person confirms it.
 */
export const optionControls = (spec: GarmentSpec): readonly OptionControl[] => {
  const type = getType(spec.typeId);
  if (!type) return [];
  return type.options.map((option) => {
    const current = spec.options[option.id];
    const tone = current ? toneOf(current.provenance) : "derived";
    const unconfirmed = tone === "suggested";
    const choices = availableChoices(spec, option.id).map((choice) => ({
      choiceId: choice.choiceId,
      label: choice.label,
      help: choice.help ?? null,
      available: choice.available,
      reason: choice.reason,
      selected: !unconfirmed && current?.choiceId === choice.choiceId,
    }));
    return {
      optionId: option.id,
      label: option.label,
      help: option.help ?? null,
      choices,
      provenanceLabel: current ? sourceLabel(current.provenance) : NOT_CHOSEN,
      tone,
      suggestion: unconfirmed
        ? (option.choices.find((choice) => choice.id === current?.choiceId)?.label ?? null)
        : null,
    };
  });
};
