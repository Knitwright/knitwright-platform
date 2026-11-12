import { isGarmentKind, type BoardView } from "@/lib/launch";
import { OWN_GARMENT } from "./address";
import { GARMENT_BOX } from "./boards";
import type { Size } from "./viewport";

/**
 * THE MAPPING from the two old models to the one canvas (decision 0145), as plain functions. The
 * migration `20261224010000_one_canvas.sql` does the same thing in SQL to the rows that exist, and
 * `mapping.test.ts` reads it to hold the two to one another; the database test proves it on real
 * rows.
 *
 *   * A studio project → its home canvas: the design's own name, and one Garment board at the
 *     origin, `GARMENT_BOX` big, naming the design in its settings.
 *   * A launch Design board → the same board, now pointing at its design: its own
 *     `settings.designProjectId`, or failing that the launch project's `design_project_id`.
 */

export interface StudioProjectRow {
  readonly id: string;
  readonly name: string;
  readonly currentVersion: number;
}

export interface HomeCanvasPlan {
  readonly name: string;
  readonly studioProjectId: string;
  readonly board: Readonly<{
    kind: "garment";
    name: string;
    at: Readonly<{ x: number; y: number }>;
    size: Size;
    settings: Readonly<{ designProjectId: string }>;
    inputVersion: number;
  }>;
}

export const homeCanvasFor = (project: StudioProjectRow): HomeCanvasPlan => ({
  name: project.name,
  studioProjectId: project.id,
  board: {
    kind: "garment",
    name: project.name,
    at: { x: 0, y: 0 },
    size: GARMENT_BOX,
    settings: { designProjectId: project.id },
    inputVersion: project.currentVersion,
  },
});

const named = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/** The design a garment-kind board points at after the migration, or null for a board with none. */
export function designReference(board: BoardView, canvasDesignId: string | null): string | null {
  if (!isGarmentKind(board.kind)) return null;
  return named(board) ?? (board.kind === "design" ? canvasDesignId : null);
}

export interface FocusTarget {
  readonly boardId: string;
  readonly designProjectId: string;
}

/**
 * The garment board an address's `focus` opens in the editor, or null when it names nothing that
 * can be edited. `garment` is the home design's own board (or, on a launch canvas, its first
 * garment); a board id is that board, if it is a garment with a design behind it.
 */
export function focusTarget(boards: readonly BoardView[], studioProjectId: string | null, focus: string | null): FocusTarget | null {
  if (focus === null) return null;
  const garments = boards.flatMap((board) => {
    const design = isGarmentKind(board.kind) ? named(board) : null;
    return design === null ? [] : [{ boardId: board.id, designProjectId: design }];
  });
  if (focus === OWN_GARMENT) {
    return garments.find((one) => one.designProjectId === studioProjectId) ?? garments[0] ?? null;
  }
  return garments.find((one) => one.boardId === focus) ?? null;
}
