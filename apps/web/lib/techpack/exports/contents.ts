import { sourceLabel } from "../cell";
import type { Cell } from "../types";

/**
 * The source of a cell in words, or null for a cell that is to be confirmed. A proposal says it
 * is a proposal, as the screen does, and never reads as a specification. An option nobody chose
 * is the standard choice.
 */
export function sourceWords(cell: Cell): string | null {
  return cell.status === "set" ? sourceLabel(cell) : null;
}
