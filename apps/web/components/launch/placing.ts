import { CARD_SIZE } from "@/lib/flows";
import type { BoardView, Point } from "@/lib/launch";

/**
 * WHERE A NEW BOARD GOES (the wiring of decisions 0091 and 0096).
 *
 * L1's canvas laid the boards out in a wrapping row, so the place a panel asked for did not matter
 * and most of them asked for the origin: the inspector's Tools list, the marketing panels' own
 * "add a marketing board" and the task bar all do. L6's canvas draws every board **where it was
 * put**, so three boards at the origin are three cards on top of one another, and the one
 * underneath cannot be read or pressed.
 *
 * So the shell moves a place another board already holds down by one row of the canvas's own grid
 * until it is free. A panel that does know where its board belongs -- the mockup library puts one
 * beside the Design board -- is left alone, because its place is already free.
 */

/** A row of the canvas's grid, with the gap the canvas leaves between cards. */
export const ROW = CARD_SIZE.height + 32;

/** The asked-for place, or the first free one below it. */
export function freePlace(boards: readonly BoardView[], at: Point): Point {
  let place = at;
  // Bounded by the number of boards: each pass clears at most one of them.
  for (let step = 0; step <= boards.length; step += 1) {
    if (!boards.some((one) => one.at.x === place.x && one.at.y === place.y)) return place;
    place = { x: place.x, y: place.y + ROW };
  }
  return place;
}
