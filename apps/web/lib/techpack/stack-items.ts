import { resolveColour, type ArtworkStack, type Layer, type PlayerMarkLayer } from "@/lib/artwork-stack";
import { LETTERING_LABELS, PLACE_DEFINITIONS, TECHNIQUES, formatCm } from "@/lib/garment";
import { TBC, numberCell, textCell, type Cell, type LengthValue } from "./cell";
import { layerRows } from "./production/stack-layers";
import type { ArtworkItem, PlayerMarkItem } from "./types";

const TECHNIQUE_LABELS: Readonly<Record<(typeof TECHNIQUES)[number], string>> = {
  sublimation: "Sublimation",
  transfer: "Transfer",
  "screen-print": "Screen print",
  embroidery: "Embroidery",
};

const tenths = (mm: number): number => Math.round(mm * 10);

const lengthOf = (mm: number | undefined, layer: Layer): LengthValue =>
  mm === undefined ? TBC : { status: "set", value: formatCm(tenths(mm)), tenthsMm: tenths(mm), provenance: layer.provenance };

const techniqueOf = (layer: Layer): Cell => (layer.technique === undefined ? TBC : textCell(TECHNIQUE_LABELS[layer.technique], layer.provenance));

/** The size a pattern layer states for its dots or bands, in millimetres. */
function sizeOf(layer: Layer): number | undefined {
  if (layer.kind !== "pattern") return undefined;
  const size = layer.params.dotWidthMm ?? layer.params.bandWidthMm;
  return typeof size === "number" ? size : undefined;
}

function placeOf(layer: Layer, rows: ReturnType<typeof layerRows>): string {
  if (layer.kind === "pattern") return "Whole panel";
  if (layer.kind === "image-fill") return layer.mode === "tile" ? "Repeating picture" : "Whole panel";
  return rows.find((row) => row.id === layer.id)?.where ?? layer.id;
}

function itemOf(layer: Layer, rows: ReturnType<typeof layerRows>): ArtworkItem {
  const from = (text: string): Cell => textCell(text, layer.provenance);
  const row = rows.find((entry) => entry.id === layer.id);
  const offset = layer.kind === "graphic" || layer.kind === "text" ? layer.offsetMm : { x: 0, y: 0 };
  const width = layer.kind === "graphic" || layer.kind === "text" ? layer.widthMm : sizeOf(layer);
  const height = layer.kind === "graphic" ? layer.heightMm : layer.kind === "text" ? layer.heightMm : undefined;
  const turn = layer.kind === "graphic" || layer.kind === "text" ? layer.rotationDeg : 0;
  const content: ArtworkItem["content"] =
    layer.kind === "graphic" && layer.source.kind === "file"
      ? { kind: "file", fileId: layer.source.fileId, description: from(layer.name ?? "Picture") }
      : { kind: "text", text: from(layer.kind === "text" ? layer.text : (row?.detail ?? layer.id)) };
  return {
    id: layer.id,
    name: from(layer.name ?? row?.kind ?? layer.id),
    panel: from(row?.views ?? layer.views.join(" and ")),
    anchor: from(placeOf(layer, rows)),
    across: lengthOf(offset.x, layer),
    down: lengthOf(offset.y, layer),
    width: lengthOf(width, layer),
    height: lengthOf(height, layer),
    rotation: numberCell(turn, "degrees", turn === 1 ? "degree" : "degrees", layer.provenance),
    technique: techniqueOf(layer),
    content,
  };
}

function markOf(layer: PlayerMarkLayer, stack: ArtworkStack): PlayerMarkItem {
  const from = (text: string): Cell => textCell(text, layer.provenance);
  const place = PLACE_DEFINITIONS[layer.place];
  const colour = layer.colourId === undefined ? undefined : resolveColour(stack, undefined, layer.colourId);
  const named = layer.colourId === undefined ? "" : `${layer.colourId.charAt(0).toUpperCase()}${layer.colourId.slice(1).replaceAll("-", " ")}`;
  return {
    id: layer.place,
    place: from(place.label),
    panel: from(layer.views.join(" and ")),
    anchor: from(place.anchor.replaceAll("-", " ")),
    shows: from(`${place.shows === "name" ? "Name" : "Number"}${layer.sample === undefined ? "" : `, sample ${place.shows === "name" ? layer.sample.name : layer.sample.number}`}`),
    height: lengthOf(layer.heightMm, layer),
    style: layer.style === undefined ? TBC : from(LETTERING_LABELS[layer.style]),
    colour: from(named),
    screenColour: colour?.screen === undefined ? TBC : from(colour.screen),
    technique: techniqueOf(layer),
  };
}

/** The placed artwork and the player marks of a design, read from its artwork stack. */
export function stackItems(stack: ArtworkStack): { items: ArtworkItem[]; playerMarks: PlayerMarkItem[] } {
  const rows = layerRows(stack, {});
  return {
    items: stack.layers.filter((layer) => layer.kind !== "ground" && layer.kind !== "player-mark").map((layer) => itemOf(layer, rows)),
    playerMarks: stack.layers.filter((layer): layer is PlayerMarkLayer => layer.kind === "player-mark").map((layer) => markOf(layer, stack)),
  };
}
