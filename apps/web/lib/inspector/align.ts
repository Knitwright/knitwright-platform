import type { Point, Rect } from "@/lib/canvas";

/**
 * Alignment of a selection of boards (plan v6 E3, decision 0147; the group inspector, e24). Kittl's
 * six buttons: left edges, centres across, right edges, top edges, middles down, bottom edges, all
 * to the selection's own bounds. Pure: the inspector moves each board through the canvas's own
 * `moveBoard`, so a move is saved, undone and refused exactly as a drag is.
 */

export const ALIGNMENTS = ["left", "centre", "right", "top", "middle", "bottom"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export const ALIGNMENT_LABELS: Readonly<Record<Alignment, string>> = {
  left: "Align left edges",
  centre: "Align centres across",
  right: "Align right edges",
  top: "Align top edges",
  middle: "Align middles down",
  bottom: "Align bottom edges",
};

export type Boxed = Readonly<{ id: string; box: Rect }>;

/** The box round every box given, or null for none. */
export function boundsOfBoxes(boxes: readonly Boxed[]): Rect | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map(({ box }) => box.x));
  const minY = Math.min(...boxes.map(({ box }) => box.y));
  const maxX = Math.max(...boxes.map(({ box }) => box.x + box.width));
  const maxY = Math.max(...boxes.map(({ box }) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const placed = (box: Rect, bounds: Rect, how: Alignment): Point => {
  switch (how) {
    case "left":
      return { x: bounds.x, y: box.y };
    case "centre":
      return { x: Math.round(bounds.x + (bounds.width - box.width) / 2), y: box.y };
    case "right":
      return { x: bounds.x + bounds.width - box.width, y: box.y };
    case "top":
      return { x: box.x, y: bounds.y };
    case "middle":
      return { x: box.x, y: Math.round(bounds.y + (bounds.height - box.height) / 2) };
    case "bottom":
      return { x: box.x, y: bounds.y + bounds.height - box.height };
  }
};

/** Where each board goes, for the boards that move. A board already in place is left out. */
export function aligned(boxes: readonly Boxed[], how: Alignment): readonly Readonly<{ id: string; at: Point }>[] {
  const bounds = boundsOfBoxes(boxes);
  if (bounds === null || boxes.length < 2) return [];
  return boxes.flatMap(({ id, box }) => {
    const at = placed(box, bounds, how);
    return at.x === box.x && at.y === box.y ? [] : [{ id, at }];
  });
}
