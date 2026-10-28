import {
  SWATCH_PATTERN,
  colourwaySchema,
  panelsFor,
  type Colourway,
  type GarmentSpec,
  type PanelColour,
  type SpecAction,
} from "@/lib/garment";
import { NEUTRAL_FILL } from "@/lib/flat/colour";

export interface ColourRow {
  readonly panelId: string;
  readonly label: string;
  /** The free text colour code, such as a Pantone name. Empty when none is set. */
  readonly colourText: string;
  /** The colour to show in the picker: the swatch, or light grey when there is none. */
  readonly swatch: string;
  readonly hasSwatch: boolean;
}

type ColourRequest =
  | Readonly<{ kind: "action"; action: SpecAction }>
  | Readonly<{ kind: "problem"; reason: string }>;

export interface ColourChange {
  /** The new colour code. Leave out to keep what is there. */
  readonly colourText?: string;
  /** The new swatch, `#rrggbb`, or null to clear it. Leave out to keep what is there. */
  readonly swatch?: string | null;
}

/** The colourway shown: the one asked for, or the first, which every design has. */
const activeColourway = (spec: GarmentSpec, colourwayId?: string): Colourway =>
  spec.colourways.find((colourway) => colourway.id === colourwayId) ?? spec.colourways[0];

export const activeColourwayId = (spec: GarmentSpec, colourwayId?: string): string => activeColourway(spec, colourwayId).id;

export interface ColourwayChoice {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
}

/** Every colourway of the design, with the one shown marked. */
export const colourwayChoices = (spec: GarmentSpec, colourwayId?: string): readonly ColourwayChoice[] => {
  const shown = activeColourwayId(spec, colourwayId);
  return spec.colourways.map((colourway) => ({ id: colourway.id, name: colourway.name, selected: colourway.id === shown }));
};

/** One row for every panel of the design, built from the registry and the options chosen. */
export function colourRows(spec: GarmentSpec, colourwayId?: string): readonly ColourRow[] {
  const colours = activeColourway(spec, colourwayId).colours;
  return panelsFor(spec).map((panel) => {
    const entry = colours.find((colour) => colour.panelId === panel.id);
    return {
      panelId: panel.id,
      label: panel.label,
      colourText: entry?.colour ?? "",
      swatch: entry?.swatch ?? NEUTRAL_FILL,
      hasSwatch: entry?.swatch !== undefined,
    };
  });
}

/**
 * What a person typed into the field for the drawn colour, as `#rrggbb` in lower case.
 * Empty text means clear the colour (null). Anything else that is not a colour is handed
 * back as it was, so that the refusal can name it.
 */
export function normaliseSwatch(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidate = (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toLowerCase();
  return SWATCH_PATTERN.test(candidate) ? candidate : trimmed;
}

const BAD_SWATCH = "Pick a colour, such as #1b2a49.";
const NO_SUCH_PANEL = "This design has no such part to colour.";

/** The entry for a panel after a change, or null when nothing is left of it. */
function changedEntry(existing: PanelColour | undefined, panelId: string, change: ColourChange): PanelColour | null {
  const swatch = change.swatch === undefined ? existing?.swatch : (change.swatch ?? undefined);
  const typed = change.colourText === undefined ? (existing?.colour ?? "") : change.colourText.trim();
  if (typed === "" && swatch === undefined) return null;
  return {
    panelId,
    colour: typed,
    ...(swatch === undefined ? {} : { swatch }),
    provenance: "user-edited",
  };
}

/**
 * Turns a change to one panel's colour into a colourway change for the server, or into a
 * plain reason why not. The change is made to the colourway the editor shows, and the
 * colours of the other panels are kept. The design given is not changed.
 */
export function colourAction(spec: GarmentSpec, panelId: string, change: ColourChange, colourwayId?: string): ColourRequest {
  if (!panelsFor(spec).some((panel) => panel.id === panelId)) return { kind: "problem", reason: NO_SUCH_PANEL };
  if (typeof change.swatch === "string" && !SWATCH_PATTERN.test(change.swatch)) return { kind: "problem", reason: BAD_SWATCH };
  const colourway = activeColourway(spec, colourwayId);
  const existing = colourway.colours.find((colour) => colour.panelId === panelId);
  const entry = changedEntry(existing, panelId, change);
  const others = colourway.colours.filter((colour) => colour.panelId !== panelId);
  const colours = entry ? (existing ? colourway.colours.map((colour) => (colour.panelId === panelId ? entry : colour)) : [...others, entry]) : others;
  const next = { id: colourway.id, name: colourway.name, colours };
  const checked = colourwaySchema.safeParse(next);
  if (!checked.success) return { kind: "problem", reason: checked.error.issues[0]?.message ?? "That colour cannot be used." };
  return { kind: "action", action: { type: "update-colourway", colourway: checked.data } };
}

/** The colourway named in the address, or undefined when there is none. */
export const colourwayParam = (value: string | readonly string[] | undefined): string | undefined => {
  const first = typeof value === "string" ? value : value?.[0];
  return first ? first : undefined;
};
