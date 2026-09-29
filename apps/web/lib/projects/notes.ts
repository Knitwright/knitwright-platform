import { LABELLING_LABELS, getType, type GarmentSpec, type SpecAction } from "@/lib/garment";
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

/**
 * One plain sentence saying what an action changed, for the history of a design. It
 * uses the labels people see, never the ids, and never changes the design. Stays under
 * the length the database allows.
 */
export const describeAction = (spec: GarmentSpec, action: SpecAction): string => {
  const type = getType(spec.typeId);
  switch (action.type) {
    case "set-option":
      return clipNote(optionNote(type, action.optionId, action.choiceId));
    case "set-measurement":
      return clipNote(`${pointLabel(type, action.pointId)} set to ${cmText(action.value)} cm.`);
    case "remove-measurement":
      return clipNote(`Your value for ${pointLabel(type, action.pointId)} was removed.`);
    case "set-sizing":
      return clipNote(sizingNote(action.sizing));
    case "add-fabric":
      return clipNote(`Fabric ${action.fabric.name} added.`);
    case "update-fabric":
      return clipNote(`Fabric ${action.fabric.name} changed.`);
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
  }
};

/** The note for a version that was made by going back to an older one. */
export const restoreNote = (version: number): string => `Restored version ${version}.`;
