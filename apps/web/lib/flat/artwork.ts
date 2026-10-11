import type { Artwork, GarmentSpec } from "@/lib/garment";
import { tidy } from "./chain";
import { TEXT_COLOUR } from "./colour";
import { BASELINE_SHIFT, playerMarkElements } from "./player-marks";
import type { FlatElement, Point, View } from "./model";
import { anchorPoint } from "./templates/anchors";
import type { Frame } from "./templates/pieces";

/** The panels whose artwork is drawn in each view. Sleeve artwork is drawn on the front only. */
export const ARTWORK_SHOWN: Readonly<Record<View, readonly string[]>> = {
  front: ["body-front", "sleeve-left", "sleeve-right", "legs-front"],
  back: ["body-back", "legs-back"],
};


/**
 * Artwork as drawing elements: a picture for an image, a line of text for text.
 * Artwork is NOT clipped to its panel. The SVG could clip it, but the PDF library cannot
 * clip a picture, and the two drawings must match, so neither does. A picture placed
 * partly off its panel is drawn as placed. Position, size and turn are from the anchor.
 */
export function artworkElements(spec: Decorated, frame: Frame): readonly FlatElement[] {
  return placedDecoration(spec, frame.view, (panelId, anchorId) => anchorPoint(frame, panelId, anchorId));
}

/** What a design puts on the garment: artwork, and player names and numbers. */
export type Decorated = Pick<GarmentSpec, "artwork" | "namesAndNumbers">;

/** Artwork, then names and numbers, placed from the anchors a family's drawing knows. */
export function placedDecoration(
  spec: Decorated,
  view: View,
  anchorOf: (panelId: string, anchorId: string) => Point | null,
): readonly FlatElement[] {
  return [...placedArtwork(spec.artwork, view, anchorOf), ...playerMarkElements(spec.namesAndNumbers, view, anchorOf)];
}

/** Artwork placed from the anchors a family's drawing knows. See `artworkElements`. */
export function placedArtwork(
  artwork: readonly Artwork[],
  view: View,
  anchorOf: (panelId: string, anchorId: string) => Point | null,
): readonly FlatElement[] {
  return artwork.flatMap((item): FlatElement[] => {
    if (!ARTWORK_SHOWN[view].includes(item.panelId)) return [];
    const anchor = anchorOf(item.panelId, item.anchor);
    if (!anchor) return [];
    const at = { x: tidy(anchor.x + item.offsetX), y: tidy(anchor.y + item.offsetY) };
    if (item.source.kind === "file") {
      return [{ kind: "image", fileId: item.source.fileId, at, width: item.width, height: item.height, rotation: item.rotationDegrees }];
    }
    return [
      {
        kind: "text",
        text: item.source.text,
        at: { x: at.x, y: tidy(at.y + item.height * BASELINE_SHIFT) },
        size: item.height,
        anchor: "middle",
        colour: TEXT_COLOUR,
        rotation: item.rotationDegrees,
      },
    ];
  });
}
