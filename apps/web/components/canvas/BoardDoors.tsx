import Link from "next/link";
import type { Route } from "next";
import { isGarmentKind, type BoardView, type Graph } from "@/lib/launch";

/**
 * The doors a board of the one canvas opens (decision 0145), on the board's own card:
 *
 *   * a Garment board (or a launch-era Design board with a design behind it) opens the editor in
 *     place -- focused mode, on this canvas, not another page;
 *   * a Tech pack and an Order board carry their doors in their own body
 *     (`components/order-boards/LinkedBoardBody.tsx`, decision 0148).
 */

const DOOR = "chip-btn inline-flex min-h-9 items-center rounded-full border border-border px-3 text-caption text-text";

const designOf = (board: BoardView | undefined): string | null => {
  const value = board?.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function BoardDoors({ board, canvasId }: Readonly<{ board: BoardView; graph: Graph; canvasId: string }>) {
  const name = board.name || "this board";
  if (isGarmentKind(board.kind)) {
    if (designOf(board) === null) return null;
    return (
      <Link href={`/project/${canvasId}?focus=${board.id}` as Route} className={DOOR} aria-label={`Open in editor, ${name}`} data-testid={`canvas-open-editor-${board.id}`}>
        Open in editor
      </Link>
    );
  }
  // A tech pack or an order board draws its own doors above its card (E4, decision 0148).
  return null;
}
