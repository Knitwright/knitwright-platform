import { formatCm, getType, TECHNIQUES, type Artwork, type GarmentSpec } from "@/lib/garment";
import { textCell, type LengthCell } from "./cell";
import { panelLabelOf } from "./labels";
import type { ArtworkItem, ArtworkSection } from "./types";
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
  const degrees = art.rotationDegrees === 1 ? "1 degree" : `${art.rotationDegrees} degrees`;
  return {
    id: art.id,
    name: from(art.name),
    panel: from(panelLabelOf(spec, art.panelId)),
    anchor: from(anchor ?? art.anchor),
    across: length(art.offsetX, art),
    down: length(art.offsetY, art),
    width: length(art.width, art),
    height: length(art.height, art),
    rotation: from(degrees),
    technique: from(TECHNIQUE_LABELS[art.technique]),
    content:
      art.source.kind === "file"
        ? { kind: "file", reference: from(art.source.fileId) }
        : { kind: "text", text: from(art.source.text) },
  };
}

/** Each piece of artwork with where it sits, how big it is, how it is made and what it shows. */
export function buildArtwork(spec: GarmentSpec): ArtworkSection {
  const items = spec.artwork.map((art) => itemOf(spec, art));
  return {
    id: "artwork",
    title: SECTION_TITLES.artwork,
    note: items.length === 0 ? "No artwork has been added to this design." : null,
    items,
  };
}
