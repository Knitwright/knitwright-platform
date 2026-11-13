import Link from "next/link";
import type { Route } from "next";
import { inputsOf, isGarmentKind, type BoardView, type Graph } from "@/lib/launch";

/**
 * The doors a board of the one canvas opens (decision 0145), on the board's own card:
 *
 *   * a Garment board (or a launch-era Design board with a design behind it) opens the editor in
 *     place -- focused mode, on this canvas, not another page;
 *   * a Tech pack board opens the design's tech pack, and an Order board its Make page, until E4
 *     builds them into the boards themselves.
 *
 * A tech pack or an order with no garment connected says so instead of linking nowhere.
 */

const DOOR = "chip-btn inline-flex min-h-9 items-center rounded-full border border-border px-3 text-caption text-text";

const designOf = (board: BoardView | undefined): string | null => {
  const value = board?.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/** The design behind a tech pack or an order: the garment board connected into it. */
export function linkedDesign(graph: Graph, board: BoardView): string | null {
  for (const edge of inputsOf(graph, board.id)) {
    const from = graph.boards.find((one) => one.id === edge.fromBoardId);
    if (from && isGarmentKind(from.kind)) return designOf(from);
  }
  return null;
}

export function BoardDoors({ board, graph, canvasId }: Readonly<{ board: BoardView; graph: Graph; canvasId: string }>) {
  const name = board.name || "this board";
  if (isGarmentKind(board.kind)) {
    if (designOf(board) === null) return null;
    return (
      <Link href={`/project/${canvasId}?focus=${board.id}` as Route} className={DOOR} aria-label={`Open in editor, ${name}`} data-testid={`canvas-open-editor-${board.id}`}>
        Open in editor
      </Link>
    );
  }
  if (board.kind !== "tech_pack" && board.kind !== "order") return null;
  const design = linkedDesign(graph, board);
  if (design === null) {
    return (
      <span className="text-micro text-muted" data-testid={`canvas-linked-none-${board.id}`}>
        Connect a garment board into this one.
      </span>
    );
  }
  const tech = board.kind === "tech_pack";
  return (
    <Link
      href={(tech ? `/studio/${design}/tech-pack` : `/studio/${design}/make`) as Route}
      className={DOOR}
      aria-label={`${tech ? "Open tech pack" : "Open order"}, ${name}`}
      data-testid={`canvas-open-${board.kind}-${board.id}`}
    >
      {tech ? "Open tech pack" : "Open order"}
    </Link>
  );
}
