import { describe, expect, it } from "vitest";
import { CANVAS_VIEWS, EDITOR_SLOTS, RAIL_SEGMENTS, SUMMARY_SECTIONS } from "./index";

/**
 * The slot contract. Y3, Y4, Y5 and Y8 code against it, so this test is what catches a change to
 * it: a slot removed or renamed fails here before it fails in another workstream.
 */

describe("the slots the shell leaves for other workstreams", () => {
  it("is the seven panels of the wave, by name", () => {
    expect(EDITOR_SLOTS).toEqual(["library", "specs", "view-2d", "tech-pack", "export", "names-numbers", "repeat-maker"]);
  });

  // Every one of them is built and mounted now (code review v5, A7-A12), so there is no
  // placeholder left to name a workstream and no `editor-slot-*` box on the page.
  it("has no placeholder of its own any more", async () => {
    const contract: Record<string, unknown> = await import("./slots");
    expect(Object.keys(contract)).not.toContain("slotPlaceholder");
  });
});

describe("the words of the shell", () => {
  it("names the three toolbars and the three views", () => {
    expect(RAIL_SEGMENTS).toEqual(["form", "library", "specs"]);
    expect(CANVAS_VIEWS).toEqual(["2d", "3d", "tech-pack"]);
  });

  it("names the seven sections of the Design Summary, as the spec lists them", () => {
    expect(SUMMARY_SECTIONS).toEqual(["fabrics", "colours", "pattern-fills", "graphics", "names-numbers", "trims-labels", "stitches"]);
  });
});
