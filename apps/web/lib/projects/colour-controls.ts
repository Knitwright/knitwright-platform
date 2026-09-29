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

export type ColourRequest =
  | Readonly<{ kind: "action"; action: SpecAction }>
  | Readonly<{ kind: "problem"; reason: string }>;

export interface ColourChange {
  /** The new colour code. Leave out to keep what is there. */
  readonly colourText?: string;
  /** The new swatch, `#rrggbb`, or null to clear it. Leave out to keep what is there. */
  readonly swatch?: string | null;
}

/** The colourway the editor changes: the first, which every design has. */
const activeColourway = (spec: GarmentSpec): Colourway => spec.colourways[0];

/** One row for every panel of the design, built from the registry and the options chosen. */
export function colourRows(spec: GarmentSpec): readonly ColourRow[] {
  const colours = activeColourway(spec).colours;
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

const BAD_SWATCH = "Pick a colour, such as #1b2a49.";
const NO_SUCH_PANEL = "This design has no such part to colour.";

/** The entry for a panel after a change, or null when nothing is left of it. */
function changedEntry(existing: PanelColour | undefined, panelId: string, change: ColourChange): PanelColour | null {
  const swatch = change.swatch === undefined ? existing?.swatch : (change.swatch ?? undefined);
  const typed = change.colourText === undefined ? (existing?.colour ?? "") : change.colourText.trim();
  if (typed === "" && swatch === undefined) return null;
  return {
    panelId,
    colour: typed === "" ? (swatch ?? "") : typed,
    ...(swatch === undefined ? {} : { swatch }),
    provenance: "user-edited",
  };
}

/**
 * Turns a change to one panel's colour into a colourway change for the server, or into a
 * plain reason why not. The change is made to the colourway the editor shows, and the
 * colours of the other panels are kept. The design given is not changed.
 */
export function colourAction(spec: GarmentSpec, panelId: string, change: ColourChange): ColourRequest {
  if (!panelsFor(spec).some((panel) => panel.id === panelId)) return { kind: "problem", reason: NO_SUCH_PANEL };
  if (typeof change.swatch === "string" && !SWATCH_PATTERN.test(change.swatch)) return { kind: "problem", reason: BAD_SWATCH };
  const colourway = activeColourway(spec);
  const existing = colourway.colours.find((colour) => colour.panelId === panelId);
  const entry = changedEntry(existing, panelId, change);
  const others = colourway.colours.filter((colour) => colour.panelId !== panelId);
  const colours = entry ? (existing ? colourway.colours.map((colour) => (colour.panelId === panelId ? entry : colour)) : [...others, entry]) : others;
  const next = { id: colourway.id, name: colourway.name, colours };
  const checked = colourwaySchema.safeParse(next);
  if (!checked.success) return { kind: "problem", reason: checked.error.issues[0]?.message ?? "That colour cannot be used." };
  return { kind: "action", action: { type: "update-colourway", colourway: checked.data } };
}
