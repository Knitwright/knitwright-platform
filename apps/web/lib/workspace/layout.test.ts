import { describe, expect, it } from "vitest";
import { INITIAL_LAYOUT, fieldToFocus, hashTarget, idToScroll, layoutReducer } from "./layout";

describe("the layout of the design workspace", () => {
  it("starts with the assistant docked on wide screens and its sheet closed on narrow ones", () => {
    expect(INITIAL_LAYOUT).toEqual({ dockOpen: true, sheetOpen: false, pendingFocus: null, pendingScroll: null });
  });

  it("collapses the docked assistant and opens it again", () => {
    const collapsed = layoutReducer(INITIAL_LAYOUT, { type: "toggleDock" });
    expect(collapsed.dockOpen).toBe(false);
    expect(layoutReducer(collapsed, { type: "toggleDock" }).dockOpen).toBe(true);
  });

  it("opens and closes the assistant sheet", () => {
    const open = layoutReducer(INITIAL_LAYOUT, { type: "openSheet" });
    expect(open.sheetOpen).toBe(true);
    expect(layoutReducer(open, { type: "closeSheet" }).sheetOpen).toBe(false);
  });

  it("keeps the field to focus once its tool is shown, then forgets it", () => {
    const waiting = layoutReducer(INITIAL_LAYOUT, { type: "reveal", field: "measurement:chest", tool: "sizes" });
    expect(waiting.pendingFocus).toEqual({ field: "measurement:chest", tool: "sizes" });
    expect(layoutReducer(waiting, { type: "focused" }).pendingFocus).toBeNull();
  });

  it("focuses the waiting field only once the panel that holds it is shown", () => {
    const waiting = layoutReducer(INITIAL_LAYOUT, { type: "reveal", field: "measurement:chest", tool: "sizes" });
    expect(fieldToFocus(waiting, "garment")).toBeNull();
    expect(fieldToFocus(waiting, "sizes")).toBe("measurement:chest");
    expect(fieldToFocus(INITIAL_LAYOUT, "sizes")).toBeNull();
  });

  it("closes the sheet when a field in a panel has to be shown, so the field is not hidden behind it", () => {
    const open = layoutReducer(INITIAL_LAYOUT, { type: "openSheet" });
    expect(layoutReducer(open, { type: "reveal", field: "sizes:list", tool: "sizes" }).sheetOpen).toBe(false);
  });

  it("never changes the state it is given", () => {
    const before = { ...INITIAL_LAYOUT };
    layoutReducer(INITIAL_LAYOUT, { type: "toggleDock" });
    expect(INITIAL_LAYOUT).toEqual(before);
  });

  it("scrolls to the part an old #hash link names once its panel is shown, then forgets it", () => {
    const waiting = layoutReducer(INITIAL_LAYOUT, { type: "revealHash", id: "share-heading", tool: "share" });
    expect(idToScroll(waiting, "garment")).toBeNull();
    expect(idToScroll(waiting, "share")).toBe("share-heading");
    expect(idToScroll(layoutReducer(waiting, { type: "scrolled" }), "share")).toBeNull();
  });
});

describe("reading the #hash of an address", () => {
  it("gives the id it names", () => {
    expect(hashTarget("#share-heading")).toBe("share-heading");
    expect(hashTarget("quote-request")).toBe("quote-request");
    expect(hashTarget("#a%20b")).toBe("a b");
  });

  it("gives nothing for an empty or broken hash", () => {
    expect(hashTarget("")).toBeNull();
    expect(hashTarget("#")).toBeNull();
    expect(hashTarget("#%E0%A4%A")).toBeNull();
  });
});
