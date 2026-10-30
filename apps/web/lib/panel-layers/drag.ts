import type { EditorDesign } from "@/lib/editor/slots";
import { libraryGroups, type LibraryItem } from "./library";

/**
 * Dragging a library item onto one pattern panel (spec F-S4: "click to apply to all pieces, or drag
 * onto a single panel"), from plan v5 Y3, decision 0076.
 *
 * The Library toolbar and the 2D view are two separate slot panels, and neither can hold the
 * other's state. What travels between them is only the item's id, in the drag's own data. The 2D
 * view then looks the id up in the same library the toolbar built from the same design, so a drag
 * can only ever carry something that design really offers.
 *
 * A drag is never the only way to do anything: the toolbar has a panel picker and a button beside
 * it, because a drag is not keyboard-reachable (decision 0064).
 */

/** Our own drag type, so a file or a link dragged in from somewhere else is not read as a library item. */
export const DRAG_TYPE = "application/x-knitwright-library-item";

/** What a drag carries: nothing but the id. */
export const dragPayload = (item: LibraryItem): string => item.id;

/** The item a drag names, looked up in this design's own library. Null for anything else. */
export function itemFromDrag(design: EditorDesign, id: string | null | undefined): LibraryItem | null {
  if (id === null || id === undefined || id === "") return null;
  return (
    libraryGroups(design)
      .flatMap((group) => group.sections)
      .flatMap((section) => section.items)
      .find((item) => item.id === id) ?? null
  );
}
