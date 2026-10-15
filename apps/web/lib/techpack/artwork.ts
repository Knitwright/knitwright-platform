import {
  KIT_PATTERN_LABELS,
  describeKitPattern,
  LETTERING_LABELS,
  PLACE_DEFINITIONS,
  formatCm,
  getType,
  sampleFor,
  TECHNIQUES,
  type Artwork,
  type GarmentSpec,
  type NamesAndNumbers,
  type PlayerMarkPlacement,
} from "@/lib/garment";
import type { ArtworkStack } from "@/lib/artwork-stack";
import { TBC, numberCell, textCell, type LengthCell, type LengthValue } from "./cell";
import { panelLabelOf } from "./labels";
import { stackItems } from "./stack-items";
import type { ArtworkItem, ArtworkSection, PlayerMarkItem } from "./types";
import { SECTION_TITLES } from "./types";

const TECHNIQUE_LABELS: Readonly<Record<(typeof TECHNIQUES)[number], string>> = {
  sublimation: "Sublimation",
  transfer: "Transfer",
  "screen-print": "Screen print",
  embroidery: "Embroidery",
};

const length = (tenthsMm: number, art: Artwork): LengthCell => ({
  status: "set",
  value: formatCm(tenthsMm),
  tenthsMm,
  provenance: art.provenance,
});

function itemOf(spec: GarmentSpec, art: Artwork): ArtworkItem {
  const from = (text: string) => textCell(text, art.provenance);
  const anchor = getType(spec.typeId)
    ?.panels.find((panel) => panel.id === art.panelId)
    ?.anchors.find((place) => place.id === art.anchor)?.label;
  const turn = numberCell(art.rotationDegrees, "degrees", art.rotationDegrees === 1 ? "degree" : "degrees", art.provenance);
  return {
    id: art.id,
    name: from(art.name),
    panel: from(panelLabelOf(spec, art.panelId)),
    anchor: from(anchor ?? art.anchor),
    across: length(art.offsetX, art),
    down: length(art.offsetY, art),
    width: length(art.width, art),
    height: length(art.height, art),
    rotation: turn,
    technique: from(TECHNIQUE_LABELS[art.technique]),
    content:
      art.source.kind === "file"
        ? { kind: "file", fileId: art.source.fileId, description: from(`Picture: ${art.name}`) }
        : { kind: "text", text: from(art.source.text) },
  };
}

/**
 * A kit pattern as one line of the artwork: printed over the whole of the body, front and back.
 * The band size is given only when someone gave one; nothing is measured from the drawing.
 */
function kitPatternItems(spec: GarmentSpec): ArtworkItem[] {
  const pattern = spec.kitPattern;
  if (!pattern) return [];
  const from = (text: string) => textCell(text, pattern.provenance);
  const zero: LengthCell = { status: "set", value: formatCm(0), tenthsMm: 0, provenance: pattern.provenance };
  return [
    {
      id: "kit-pattern",
      name: from(`Kit pattern: ${KIT_PATTERN_LABELS[pattern.style]}`),
      panel: from(`${panelLabelOf(spec, "body-front")} and ${panelLabelOf(spec, "body-back")}`),
      anchor: from("Whole panel"),
      across: zero,
      down: zero,
      width: pattern.size === undefined ? TBC : { status: "set", value: formatCm(pattern.size), tenthsMm: pattern.size, provenance: pattern.provenance },
      height: TBC,
      rotation: numberCell(0, "degrees", "degrees", pattern.provenance),
      technique: pattern.technique === undefined ? TBC : from(TECHNIQUE_LABELS[pattern.technique]),
      content: { kind: "text", text: from(describeKitPattern(pattern)) },
    },
  ];
}

export const PLAYER_MARKS_NOTE =
  "Each player's own name and number come from the team order. The sample shows where they go and how they look. A height nobody has typed is still to be given.";

function markOf(spec: GarmentSpec, marks: NamesAndNumbers, entry: PlayerMarkPlacement): PlayerMarkItem {
  const from = (text: string) => textCell(text, marks.provenance);
  const place = PLACE_DEFINITIONS[entry.place];
  const anchor = getType(spec.typeId)
    ?.panels.find((panel) => panel.id === place.panelId)
    ?.anchors.find((found) => found.id === place.anchor)?.label;
  const height: LengthValue =
    entry.height === undefined ? TBC : { status: "set", value: formatCm(entry.height), tenthsMm: entry.height, provenance: marks.provenance };
  return {
    id: entry.place,
    place: from(place.label),
    panel: from(panelLabelOf(spec, place.panelId)),
    anchor: from(anchor ?? place.anchor),
    shows: from(`${place.shows === "name" ? "Name" : "Number"}, sample ${sampleFor(marks, entry.place)}`),
    height,
    style: marks.style === undefined ? TBC : from(LETTERING_LABELS[marks.style]),
    colour: from(marks.colour),
    screenColour: marks.swatch === undefined ? TBC : from(marks.swatch),
    technique: marks.technique === undefined ? TBC : from(TECHNIQUE_LABELS[marks.technique]),
  };
}

/**
 * Each piece of artwork with where it sits, how big it is, how it is made and what it shows,
 * then each place for player names and numbers. A design with an artwork stack is read from its
 * stack; only a design with none falls back to the older fields.
 */
export function buildArtwork(spec: GarmentSpec, stack: ArtworkStack | null = null): ArtworkSection {
  const marks = spec.namesAndNumbers;
  const { items, playerMarks } = stack
    ? stackItems(stack)
    : {
        items: [...kitPatternItems(spec), ...spec.artwork.map((art) => itemOf(spec, art))],
        playerMarks: marks ? marks.places.map((entry) => markOf(spec, marks, entry)) : [],
      };
  return {
    id: "artwork",
    title: SECTION_TITLES.artwork,
    note: items.length === 0 && playerMarks.length === 0 ? "No artwork has been added to this design." : null,
    items,
    playerMarks,
    playerMarksNote: playerMarks.length > 0 ? PLAYER_MARKS_NOTE : null,
  };
}
