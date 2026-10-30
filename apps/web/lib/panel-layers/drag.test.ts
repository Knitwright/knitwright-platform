import { describe, expect, it } from "vitest";
import { DRAG_TYPE, dragPayload, itemFromDrag } from "./drag";
import { design } from "./fixtures/design";
import { libraryGroups, type LibraryItem } from "./library";

/**
 * Dragging a library item onto one panel (plan v5 Y3, decision 0076). The drag carries the item's
 * id and nothing else, and the 2D view reads it back out of the same design's own library, so a
 * drag can never deliver something that design does not offer.
 */

const all = (): readonly LibraryItem[] =>
  libraryGroups(design())
    .flatMap((group) => group.sections)
    .flatMap((section) => section.items);

describe("a library drag", () => {
  it("has a type of its own, so a file or a link dragged in from elsewhere is not read as an item", () => {
    expect(DRAG_TYPE).toBe("application/x-knitwright-library-item");
  });

  it("carries the item's id and nothing else", () => {
    const item = all()[0]!;
    expect(dragPayload(item)).toBe(item.id);
  });

  it("reads every one of this design's own items back", () => {
    const items = all();
    expect(items.length).toBeGreaterThan(10);
    for (const item of items) {
      expect(itemFromDrag(design(), dragPayload(item))).toEqual(item);
    }
  });

  it("delivers nothing for an id the design does not offer", () => {
    expect(itemFromDrag(design(), "fabric-F-NOT-A-FABRIC")).toBeNull();
  });

  it("delivers nothing for a drag that carries no id at all", () => {
    for (const payload of [null, undefined, ""]) {
      expect(itemFromDrag(design(), payload)).toBeNull();
    }
  });
});
