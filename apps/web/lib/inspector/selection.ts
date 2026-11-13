import { isGarmentKind, type BoardView } from "@/lib/launch";

/**
 * Which inspector the right panel shows (plan v6 E3, decision 0147; `08` §5.3), from the canvas
 * store's selection. Pure, so every case is tested here and the component only draws the answer.
 *
 *   * one garment (or launch-era design) board → the garment inspector, or one of its elements when
 *     the inspector's layer list picked one;
 *   * one mockup board → the mockup inspector, in mockup edit mode after a double-click;
 *   * two or more boards → the group inspector (alignment of the selection);
 *   * anything else → `other`: the launch shell's own inspector and E2's and E4's panels answer it.
 *
 * An element or an edit mode only holds while its board is the one selected: a click elsewhere, which
 * changes the selection, finishes it (the prototype's "click outside to finish").
 */

export type InspectorTarget =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "garment"; boardId: string; designId: string | null }>
  | Readonly<{ kind: "element"; boardId: string; designId: string; elementId: string }>
  | Readonly<{ kind: "mockup"; boardId: string; editing: boolean }>
  | Readonly<{ kind: "group"; boardIds: readonly string[] }>
  | Readonly<{ kind: "other"; boardId: string }>;

export interface SelectionInput {
  readonly selection: readonly string[];
  readonly boards: readonly Pick<BoardView, "id" | "kind" | "settings">[];
  readonly element: Readonly<{ boardId: string; id: string }> | null;
  readonly editing: string | null;
}

/** The design a garment board points at, or null when it points at none (removed, or never set). */
export const designOfBoard = (board: Pick<BoardView, "kind" | "settings">): string | null => {
  const value = board.settings["designProjectId"];
  return isGarmentKind(board.kind) && typeof value === "string" && value.length > 0 ? value : null;
};

export function inspectorTarget({ selection, boards, element, editing }: SelectionInput): InspectorTarget {
  const chosen = selection.flatMap((id) => boards.filter((board) => board.id === id));
  if (chosen.length === 0) return { kind: "none" };
  if (chosen.length > 1) return { kind: "group", boardIds: chosen.map((board) => board.id) };
  const board = chosen[0];
  if (isGarmentKind(board.kind)) {
    const designId = designOfBoard(board);
    if (designId !== null && element !== null && element.boardId === board.id) return { kind: "element", boardId: board.id, designId, elementId: element.id };
    return { kind: "garment", boardId: board.id, designId };
  }
  if (board.kind === "mockup") return { kind: "mockup", boardId: board.id, editing: editing === board.id };
  return { kind: "other", boardId: board.id };
}

/** True when the store holds an element or an edit mode the selection no longer backs, so it should be cleared. */
export function staleFocus({ selection, element, editing }: Pick<SelectionInput, "selection" | "element" | "editing">): Readonly<{ element: boolean; editing: boolean }> {
  const only = selection.length === 1 ? selection[0] : null;
  return { element: element !== null && element.boardId !== only, editing: editing !== null && editing !== only };
}
