import { KIT_PATTERN_LABELS, LABELLING_LABELS, getType, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { cmText } from "./measurement-input";

/** The most characters a version note may hold. The database enforces the same limit. */
export const NOTE_MAX_LENGTH = 200;

const MAX_LISTED_SIZES_LENGTH = 80;
const ELLIPSIS = "...";

type Type = NonNullable<ReturnType<typeof getType>>;

/** Shortens a note that is too long for the database, and says so with dots. */
export const clipNote = (note: string): string =>
  note.length <= NOTE_MAX_LENGTH ? note : `${note.slice(0, NOTE_MAX_LENGTH - ELLIPSIS.length)}${ELLIPSIS}`;

const panelLabel = (type: Type | undefined, id: string): string =>
  type?.panels.find((panel) => panel.id === id)?.label ?? id;

const pointLabel = (type: Type | undefined, id: string): string =>
  type?.pointsOfMeasure.find((point) => point.id === id)?.label ?? id;

const componentLabel = (type: Type | undefined, id: string): string =>
  type?.components.find((slot) => slot.id === id)?.label ?? id;

const seamLabel = (type: Type | undefined, id: string): string =>
  type?.seams.find((seam) => seam.id === id)?.label ?? id;

const optionNote = (type: Type | undefined, optionId: string, choiceId: string): string => {
  const option = type?.options.find((entry) => entry.id === optionId);
  const choice = option?.choices.find((entry) => entry.id === choiceId);
  return `${option?.label ?? optionId} changed to ${choice?.label ?? choiceId}.`;
};

const sizingNote = (sizing: { sizes: readonly string[]; baseSize: string } | null): string => {
  if (!sizing) return "Sizes removed.";
  const listed = sizing.sizes.join(", ");
  if (listed.length > MAX_LISTED_SIZES_LENGTH) {
    return `Sizes set. There are ${sizing.sizes.length} sizes and the base size is ${sizing.baseSize}.`;
  }
  return `Sizes set to ${listed}. The base size is ${sizing.baseSize}.`;
};

/** The name of the entry with this id, or null when the design has none. */
const nameOf = (list: readonly { id: string; name: string }[], id: string): string | null =>
  list.find((entry) => entry.id === id)?.name ?? null;

const sentence = (noun: string, name: string | null, verb: string, fallback: string): string =>
  name === null ? fallback : `${noun} ${name} ${verb}.`;

/** Notes for options, measurements, sizing and tolerances. Null when the action is not one of them. */
function describeMeasured(type: Type | undefined, action: SpecAction): string | null {
  switch (action.type) {
    case "set-option":
      return clipNote(optionNote(type, action.optionId, action.choiceId));
    case "set-measurement":
      return clipNote(`${pointLabel(type, action.pointId)} set to ${cmText(action.value)} cm.`);
    case "remove-measurement":
      return clipNote(`Your value for ${pointLabel(type, action.pointId)} was removed.`);
    case "set-sizing":
      return clipNote(sizingNote(action.sizing));
    case "set-size-measurement":
      return clipNote(`${pointLabel(type, action.entry.pointId)} at size ${action.entry.size} set to ${cmText(action.entry.value)} cm.`);
    case "remove-size-measurement":
      return clipNote(`Your value for ${pointLabel(type, action.pointId)} at size ${action.size} was removed.`);
    case "set-tolerance":
      return clipNote(`Tolerance for ${pointLabel(type, action.entry.pointId)} set to ${cmText(action.entry.value)} cm.`);
    case "remove-tolerance":
      return clipNote(`Your tolerance for ${pointLabel(type, action.pointId)} was removed.`);
    default:
      return null;
  }
}

/** Notes for fabrics, colourways and artwork. Null when the action is not one of them. */
function describeMaterials(spec: GarmentSpec, type: Type | undefined, action: SpecAction): string | null {
  switch (action.type) {
    case "add-fabric":
      return clipNote(`Fabric ${action.fabric.name} added.`);
    case "update-fabric":
      return clipNote(`Fabric ${action.fabric.name} changed.`);
    case "change-fabric":
      return clipNote(sentence("Fabric", nameOf(spec.fabrics, action.id), "changed", "A fabric was changed."));
    case "remove-fabric":
      return clipNote(sentence("Fabric", nameOf(spec.fabrics, action.id), "removed", "A fabric was removed."));
    case "assign-fabric": {
      const fabric = nameOf(spec.fabrics, action.fabricId) ?? action.fabricId;
      return clipNote(`${panelLabel(type, action.panelId)} now uses ${fabric}.`);
    }
    case "add-colourway":
      return clipNote(`Colourway ${action.colourway.name} added.`);
    case "update-colourway":
      return clipNote(`Colourway ${action.colourway.name} changed.`);
    case "remove-colourway":
      return clipNote(sentence("Colourway", nameOf(spec.colourways, action.id), "removed", "A colourway was removed."));
    case "add-artwork":
      return clipNote(`Artwork ${action.artwork.name} added.`);
    case "update-artwork":
      return clipNote(`Artwork ${action.artwork.name} changed.`);
    case "remove-artwork":
      return clipNote(sentence("Artwork", nameOf(spec.artwork, action.id), "removed", "Artwork was removed."));
    default:
      return null;
  }
}

/** Notes for names and numbers, the kit pattern, components, construction, labelling, wearer and type. Null when the action is not one of them. */
function describeDetails(spec: GarmentSpec, type: Type | undefined, action: SpecAction): string | null {
  switch (action.type) {
    case "set-names-numbers":
      return spec.namesAndNumbers === undefined ? "Player names and numbers added." : "Player names and numbers changed.";
    case "remove-names-numbers":
      return "Player names and numbers removed.";
    case "set-kit-pattern":
      return `Kit pattern set to ${KIT_PATTERN_LABELS[action.kitPattern.style]}.`;
    case "remove-kit-pattern":
      return "Kit pattern removed. The kit is plain.";
    case "set-component":
      return clipNote(`Details for ${componentLabel(type, action.component.id)} saved.`);
    case "remove-component":
      return clipNote(`Details for ${componentLabel(type, action.id)} removed.`);
    case "set-construction":
      return clipNote(`Stitch details for ${seamLabel(type, action.entry.seamId)} saved.`);
    case "remove-construction":
      return clipNote(`Stitch details for ${seamLabel(type, action.seamId)} removed.`);
    case "set-labelling":
      return `${LABELLING_LABELS[action.field]} ${action.text === "" ? "removed" : "saved"}.`;
    case "change-wearer":
      return `Made for ${action.wearer}.`;
    case "change-type":
      return clipNote(`Garment type changed to ${getType(action.typeId)?.label ?? action.typeId}.`);
    default:
      return null;
  }
}

/**
 * One plain sentence saying what an action changed, for the history of a design. It
 * uses the labels people see, never the ids, and never changes the design. Stays under
 * the length the database allows.
 */
export const describeAction = (spec: GarmentSpec, action: SpecAction): string => {
  const type = getType(spec.typeId);
  return describeMeasured(type, action) ?? describeMaterials(spec, type, action) ?? describeDetails(spec, type, action) ?? "";
};

/**
 * The note for several changes a person saved as one version. One change reads as it always
 * does. More say how many there were and name the first, since a long list does not fit.
 */
export const describeActions = (spec: GarmentSpec, actions: readonly SpecAction[]): string => {
  const [first, ...rest] = actions;
  if (!first) return "Nothing changed.";
  const one = describeAction(spec, first);
  return rest.length === 0 ? one : clipNote(`${actions.length} changes saved together. The first: ${one}`);
};

/** The note for a version that was made by going back to an older one. */
/** Who proposed a change stored as one version: the assistant from a message, or a picture reading. */
export type ProposalSource = "assistant" | "picture" | "kit-style";

const PROPOSAL_PREFIX: Readonly<Record<ProposalSource, string>> = {
  assistant: "By the assistant",
  picture: "Read from a picture",
  "kit-style": "Picked from the kit styles",
};

/** The version note for changes the assistant proposed, from the sentences that explain them. */
export const describeProposal = (source: ProposalSource, explanations: readonly string[]): string =>
  clipNote(`${PROPOSAL_PREFIX[source]}: ${explanations.join(" ")}`);

export const restoreNote = (version: number): string => `Restored version ${version}.`;
