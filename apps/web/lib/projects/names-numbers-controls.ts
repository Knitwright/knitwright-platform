import {
  DEFAULT_SAMPLE_NAME,
  DEFAULT_SAMPLE_NUMBER,
  LETTERING_LABELS,
  LETTERING_STYLES,
  PLACE_DEFINITIONS,
  TECHNIQUES,
  getType,
  namesAndNumbersSchema,
  placesFor,
  usualPlaces,
  type GarmentSpec,
  type NamesAndNumbers,
  type PlayerMarkPlace,
  type SpecAction,
} from "@/lib/garment";
import { TECHNIQUE_CHOICES } from "./artwork-controls";
import { normaliseSwatch } from "./colour-controls";
import { cmText, parseCmInput } from "./measurement-input";

/**
 * The editor's form for player names and numbers (decision 0027): which places, the lettering
 * style, the colour, how they are made, heights if known, and the sample drawn. Each player's
 * own name and number belong to the team order, so there is no roster here.
 */

export interface NamesNumbersForm {
  /** The places ticked, and the height typed for each, in centimetres. Empty means not given. */
  readonly places: readonly { readonly place: PlayerMarkPlace; readonly on: boolean; readonly heightCm: string }[];
  /** A lettering style id, or empty for "choose later". */
  readonly style: string;
  readonly colour: string;
  readonly swatch: string;
  /** A technique id, or empty for "choose later". */
  readonly technique: string;
  readonly sampleName: string;
  readonly sampleNumber: string;
}

export interface NamesNumbersPanel {
  /** True when the design already has names and numbers. */
  readonly set: boolean;
  readonly form: NamesNumbersForm;
  /** The label of each place the garment has, in the order of the form. */
  readonly placeLabels: Readonly<Record<string, string>>;
}

type NamesNumbersRequest =
  | Readonly<{ kind: "action"; action: SpecAction }>
  | Readonly<{ kind: "problem"; reason: string }>;

export const LETTERING_CHOICES: readonly { id: string; label: string }[] = LETTERING_STYLES.map((id) => ({ id, label: LETTERING_LABELS[id] }));
export { TECHNIQUE_CHOICES };

export const NO_PLACES_FOR_MARKS = "This garment has no place for player names or numbers.";
const PICK_A_PLACE = "Tick at least one place.";
const HEIGHT_RULE = "Enter a height in centimetres, such as 25, or leave it empty.";
const SWATCH_RULE = "Pick a colour, such as #1b2a49, or leave it empty.";

function formOf(places: readonly PlayerMarkPlace[], ticked: readonly PlayerMarkPlace[], marks: NamesAndNumbers | undefined): NamesNumbersForm {
  return {
    places: places.map((place) => {
      const height = marks?.places.find((entry) => entry.place === place)?.height;
      return { place, on: ticked.includes(place), heightCm: height === undefined ? "" : cmText(height) };
    }),
    style: marks?.style ?? "",
    colour: marks?.colour ?? "",
    swatch: marks?.swatch ?? "",
    technique: marks?.technique ?? "",
    sampleName: marks?.sampleName ?? DEFAULT_SAMPLE_NAME,
    sampleNumber: marks?.sampleNumber ?? DEFAULT_SAMPLE_NUMBER,
  };
}

/** What the editor shows for names and numbers, or null when the garment has no place for them. */
export function namesNumbersPanel(spec: GarmentSpec): NamesNumbersPanel | null {
  const type = getType(spec.typeId);
  if (!type) return null;
  const places = placesFor(type, spec.options);
  if (places.length === 0) return null;
  const marks = spec.namesAndNumbers;
  const ticked = marks ? marks.places.map((entry) => entry.place) : usualPlaces(type, spec.options);
  return {
    set: marks !== undefined,
    form: formOf(places, ticked, marks),
    placeLabels: Object.fromEntries(places.map((place) => [place, PLACE_DEFINITIONS[place].label])),
  };
}

const problem = (reason: string): NamesNumbersRequest => ({ kind: "problem", reason });

const optionalId = <T extends string>(text: string, allowed: readonly T[]): T | undefined =>
  (allowed as readonly string[]).includes(text) ? (text as T) : undefined;

function heightsOf(form: NamesNumbersForm): NamesAndNumbers["places"] | string {
  const places: NamesAndNumbers["places"][number][] = [];
  for (const entry of form.places.filter((candidate) => candidate.on)) {
    if (entry.heightCm.trim() === "") {
      places.push({ place: entry.place });
      continue;
    }
    const parsed = parseCmInput(entry.heightCm);
    if (!parsed.ok) return HEIGHT_RULE;
    places.push({ place: entry.place, height: parsed.tenths });
  }
  return places;
}

/**
 * Turns the form into a change for the server, or a plain reason why not. A height left empty
 * stays unset. A browser cannot say where the values came from: the server stamps that.
 */
export function buildNamesNumbersAction(form: NamesNumbersForm): NamesNumbersRequest {
  const places = heightsOf(form);
  if (typeof places === "string") return problem(places);
  if (places.length === 0) return problem(PICK_A_PLACE);
  const swatch = normaliseSwatch(form.swatch);
  if (swatch !== null && !swatch.startsWith("#")) return problem(SWATCH_RULE);
  const style = optionalId(form.style, LETTERING_STYLES);
  const technique = optionalId(form.technique, TECHNIQUES);
  const candidate = {
    places,
    colour: form.colour,
    sampleName: form.sampleName,
    sampleNumber: form.sampleNumber.trim(),
    // A browser has no say in this. The server replaces it with `user-edited`.
    provenance: "user-edited",
    ...(style === undefined ? {} : { style }),
    ...(technique === undefined ? {} : { technique }),
    ...(swatch === null ? {} : { swatch }),
  };
  const checked = namesAndNumbersSchema.safeParse(candidate);
  if (!checked.success) return problem(checked.error.issues[0]?.message ?? "Those names and numbers cannot be used.");
  return { kind: "action", action: { type: "set-names-numbers", namesAndNumbers: checked.data } };
}

export const removeNamesNumbersAction = (): NamesNumbersRequest => ({ kind: "action", action: { type: "remove-names-numbers" } });
