import { TEXT_COLOUR } from "./colour";
import type { FlatModel, FlatText } from "./model";

const NOTE_SIZE = 110;
const NOTE_ROOM = 220;
const AVERAGE_LETTER_WIDTH = 0.62;

/**
 * A copy of the drawing with one visible line of text added above it, in a layer of its
 * own. The snapshot images for the owner use it to say the sizes are made up.
 * If the line is wider than the drawing, the box grows to hold it.
 */
export function withReviewNote(model: FlatModel, line: string): FlatModel {
  const { bounds } = model;
  const width = line.length * NOTE_SIZE * AVERAGE_LETTER_WIDTH;
  const text: FlatText = {
    kind: "text",
    text: line,
    at: { x: bounds.minX + NOTE_SIZE, y: bounds.minY + NOTE_ROOM * 0.6 },
    size: NOTE_SIZE,
    anchor: "start",
    colour: TEXT_COLOUR,
    rotation: 0,
  };
  return {
    ...model,
    layers: [...model.layers, { id: "note", label: "Review note", elements: [text] }],
    bounds: {
      ...bounds,
      minY: bounds.minY - NOTE_ROOM,
      maxX: Math.max(bounds.maxX, bounds.minX + NOTE_SIZE + width + NOTE_SIZE),
    },
  };
}
