import { PLACE_DEFINITIONS, sampleFor, type NamesAndNumbers, type PlayerMarkPlace } from "@/lib/garment";
import { tidy } from "./chain";
import { TEXT_COLOUR, safeColour } from "./colour";
import type { FlatElement, Point, View } from "./model";

/** How far below the middle of a line of text its baseline sits, as a share of the type size. */
export const BASELINE_SHIFT = 0.35;

/** The view each place is seen in. */
const VIEW_OF: Readonly<Record<PlayerMarkPlace, View>> = {
  "back-name": "back",
  "back-number": "back",
  "front-number": "front",
  "leg-number": "front",
};

/**
 * Heights to DRAW a sample at when none was typed, in tenths of a millimetre. They place the
 * sample on the drawing and are never shown or written as a measurement: the tech pack says
 * "to be confirmed" for a height nobody typed, like SCHEMATIC_CHEST in model.ts.
 */
const DRAWN_HEIGHT: Readonly<Record<PlayerMarkPlace, number>> = {
  "back-name": 600,
  "back-number": 2000,
  "front-number": 1000,
  "leg-number": 800,
};

/** Room left between the name and the number below it. */
const NAME_GAP = 150;

const drawnHeight = (marks: NamesAndNumbers, place: PlayerMarkPlace): number =>
  marks.places.find((entry) => entry.place === place)?.height ?? DRAWN_HEIGHT[place];

/**
 * Where the middle of a place's sample goes. The back number goes below the name when there is
 * one, so the two never overlap, whatever heights were typed.
 */
function centreOf(marks: NamesAndNumbers, place: PlayerMarkPlace, anchorOf: (panelId: string, anchorId: string) => Point | null): Point | null {
  const { panelId, anchor } = PLACE_DEFINITIONS[place];
  const at = anchorOf(panelId, anchor);
  if (!at) return null;
  if (place !== "back-number" || !marks.places.some((entry) => entry.place === "back-name")) return at;
  const name = PLACE_DEFINITIONS["back-name"];
  const nameAt = anchorOf(name.panelId, name.anchor);
  if (!nameAt) return at;
  const below = nameAt.y + drawnHeight(marks, "back-name") / 2 + NAME_GAP + drawnHeight(marks, place) / 2;
  return { x: at.x, y: Math.max(at.y, below) };
}

/**
 * The sample name and number as lines of text, in the colour chosen, at each place seen in
 * this view. Both renderers draw them in their one font: the lettering style is a written
 * instruction for the factory, not a drawn font.
 */
export function playerMarkElements(
  marks: NamesAndNumbers | undefined,
  view: View,
  anchorOf: (panelId: string, anchorId: string) => Point | null,
): readonly FlatElement[] {
  if (!marks) return [];
  return marks.places.flatMap(({ place }): FlatElement[] => {
    if (VIEW_OF[place] !== view) return [];
    const centre = centreOf(marks, place, anchorOf);
    if (!centre) return [];
    const size = drawnHeight(marks, place);
    return [
      {
        kind: "text",
        text: sampleFor(marks, place),
        at: { x: tidy(centre.x), y: tidy(centre.y + size * BASELINE_SHIFT) },
        size,
        anchor: "middle",
        colour: safeColour(marks.swatch) ?? TEXT_COLOUR,
        rotation: 0,
      },
    ];
  });
}
