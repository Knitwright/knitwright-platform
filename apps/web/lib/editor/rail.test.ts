import { describe, expect, it } from "vitest";
import { DEFAULT_SEGMENT, parseSegment, RAIL_SEGMENTS, SEGMENTS, segmentKeyTarget, segmentPanelId, segmentTabId } from "./index";

describe("the left rail's segments", () => {
  it("is Form, Library and Specs, in that order", () => {
    expect(RAIL_SEGMENTS).toEqual(["form", "library", "specs"]);
    expect(RAIL_SEGMENTS.map((id) => SEGMENTS[id].label)).toEqual(["Form", "Library", "Specs"]);
  });

  it("gives every segment a heading and a sentence of its own", () => {
    for (const id of RAIL_SEGMENTS) {
      expect(SEGMENTS[id].title.length).toBeGreaterThan(0);
      expect(SEGMENTS[id].lead.length).toBeGreaterThan(10);
    }
  });

  it("joins each tab to its panel by id", () => {
    expect(segmentTabId("library")).toBe("rail-tab-library");
    expect(segmentPanelId("library")).toBe("rail-panel-library");
  });
});

describe("parseSegment", () => {
  it("takes the segment the address names", () => {
    expect(parseSegment("specs")).toBe("specs");
    expect(parseSegment(["library", "specs"])).toBe("library");
  });

  it("opens Form for anything else", () => {
    for (const value of [null, undefined, "", "pattern", []]) expect(parseSegment(value)).toBe(DEFAULT_SEGMENT);
  });
});

describe("the arrow keys", () => {
  it("step through the segments and wrap at both ends", () => {
    expect(segmentKeyTarget("form", "ArrowRight")).toBe("library");
    expect(segmentKeyTarget("specs", "ArrowDown")).toBe("form");
    expect(segmentKeyTarget("form", "ArrowLeft")).toBe("specs");
    expect(segmentKeyTarget("library", "ArrowUp")).toBe("form");
  });

  it("jump to the ends with Home and End", () => {
    expect(segmentKeyTarget("specs", "Home")).toBe("form");
    expect(segmentKeyTarget("form", "End")).toBe("specs");
  });

  it("leave every other key alone", () => {
    expect(segmentKeyTarget("form", "a")).toBeNull();
  });
});
