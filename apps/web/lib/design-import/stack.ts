import { ARTWORK_STACK_VERSION, parseArtworkStack, type ArtworkStack, type ViewId } from "@/lib/artwork-stack";
import type { FoundColour } from "./colours";
import { READ_PROVENANCE } from "./types";

/**
 * The proposed design as a W7a stack (plan W7d step 8). This release reads the views, the outline and the colours,
 * so the stack is the colour list and one ground layer over the views that are in the picture. Nothing else is
 * put in it that was not read, and no colour carries a code: a code is whatever a person types.
 */

const ORDER = ["main", "second", "third", "fourth", "fifth", "sixth"] as const;
const ROLES = ["Main colour", "Second colour", "Third colour", "Fourth colour", "Fifth colour", "Sixth colour"] as const;

export const GROUND_LAYER_ID = "ground";
export const COLOURWAY_ID = "as-read";

export function buildStack(input: { readonly views: readonly ViewId[]; readonly colours: readonly FoundColour[] }): ArtworkStack | null {
  if (input.views.length === 0 || input.colours.length === 0) return null;
  const colours = input.colours.slice(0, ORDER.length).map((colour, at) => ({
    id: ORDER[at],
    role: ROLES[at],
    screen: colour.hex,
    codes: [],
    provenance: READ_PROVENANCE,
  }));
  const candidate = {
    schemaVersion: ARTWORK_STACK_VERSION,
    views: [...input.views],
    colours,
    layers: [
      {
        id: GROUND_LAYER_ID,
        name: "Main colour",
        kind: "ground",
        views: [...input.views],
        opacity: 1,
        blend: "normal",
        provenance: READ_PROVENANCE,
        colourId: "main",
      },
    ],
    colourways: [
      {
        id: COLOURWAY_ID,
        name: "As read from your picture",
        colours: Object.fromEntries(colours.map((c) => [c.id, { screen: c.screen, codes: [], provenance: READ_PROVENANCE }])),
      },
    ],
  };
  const parsed = parseArtworkStack(candidate);
  return parsed.ok ? parsed.stack : null;
}
