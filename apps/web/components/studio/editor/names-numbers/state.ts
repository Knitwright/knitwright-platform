import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { colourRows } from "@/lib/projects/colour-controls";
import { buildNamesNumbersAction, namesNumbersPanel, removeNamesNumbersAction, type NamesNumbersForm } from "@/lib/projects/names-numbers-controls";
import { composeColour, roleChoices, splitColour, type ColourRoleChoice } from "./colour";
import { fontForStyle, type KitFont } from "./fonts";
import { markPreview, SPEC_SAMPLE_NAME, SPEC_SAMPLE_NUMBER, type MarkPreview } from "./preview";
import { zonesOf, type Zone } from "./zones";

/**
 * Everything the Names & numbers panel shows, worked out from the design it was given (plan v5 Y8,
 * decision 0081). The slot fetches nothing: the design, its colourway and its article all arrive
 * through `EditorSlotProps`, and this module turns them into the panel's state.
 *
 * The saved shape is the one decision 0027 already built, so a design saved from this panel is
 * read by the tech pack, the flats and the exports without any of them changing.
 */

export interface NamesNumbersView {
  /** Null where this garment has no place for names and numbers at all. */
  readonly form: NamesNumbersForm | null;
  readonly set: boolean;
  readonly zones: readonly Zone[];
  readonly font: KitFont | null;
  /** The lettering colour, apart from its outline. */
  readonly colour: string;
  readonly outline: string;
  readonly roles: readonly ColourRoleChoice[];
  readonly preview: MarkPreview;
}

/** The form a design with no names and numbers yet starts from: the spec's own SMITH 7. */
const startingForm = (form: NamesNumbersForm, set: boolean): NamesNumbersForm =>
  set ? form : { ...form, sampleName: SPEC_SAMPLE_NAME, sampleNumber: SPEC_SAMPLE_NUMBER };

/** The panel's state for a design, or a view whose form is null for a garment with no zone for them. */
export function namesNumbersView(spec: GarmentSpec, colourwayId: string, form?: NamesNumbersForm): NamesNumbersView {
  const panel = namesNumbersPanel(spec);
  const current = form ?? (panel ? startingForm(panel.form, panel.set) : null);
  const zones = zonesOf(panel && current ? { ...panel, form: current } : panel);
  const parts = splitColour(current?.colour ?? "");
  return {
    form: current,
    set: panel?.set ?? false,
    zones,
    font: current ? fontForStyle(current.style) : null,
    colour: parts.colour,
    outline: parts.outline,
    roles: roleChoices(colourRows(spec, colourwayId)),
    preview: markPreview(current ?? { places: [], style: "", colour: "", swatch: "", technique: "", sampleName: "", sampleNumber: "" }, zones),
  };
}

/** The form with one zone ticked or unticked. */
export const toggleZone = (form: NamesNumbersForm, place: string, on: boolean): NamesNumbersForm => ({
  ...form,
  places: form.places.map((entry) => (entry.place === place ? { ...entry, on } : entry)),
});

/** The form with one zone's height typed, in centimetres. Left empty it stays unset, never guessed. */
export const setZoneHeight = (form: NamesNumbersForm, place: string, heightCm: string): NamesNumbersForm => ({
  ...form,
  places: form.places.map((entry) => (entry.place === place ? { ...entry, heightCm } : entry)),
});

/** The form with the colour and its outline written back into the one instruction the design stores. */
export const setColour = (form: NamesNumbersForm, colour: string, outline: string): NamesNumbersForm => ({
  ...form,
  colour: composeColour({ colour, outline }),
});

export type SaveRequest = Readonly<{ kind: "action"; action: SpecAction }> | Readonly<{ kind: "problem"; reason: string }>;

/** The change to save, or the plain reason it cannot be saved yet. The shell checks it again. */
export const saveRequest = (form: NamesNumbersForm): SaveRequest => buildNamesNumbersAction(form);

/** Turning names and numbers off takes them off the design altogether. */
export const removeRequest = (): SaveRequest => removeNamesNumbersAction();
