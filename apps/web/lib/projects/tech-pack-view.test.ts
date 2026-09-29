import { describe, expect, it } from "vitest";
import { TBC } from "@/lib/techpack";
import { cellView, classView, sectionLink, toleranceView } from "./tech-pack-view";

describe("cellView", () => {
  it("shows a missing value as To be confirmed in the attention style, with no source", () => {
    expect(cellView(TBC)).toEqual({ text: "To be confirmed", source: null, tone: "missing" });
  });

  it("shows a value with where it came from in plain words", () => {
    expect(cellView({ status: "set", value: "Navy", provenance: "user-edited" })).toEqual({
      text: "Navy",
      source: "Typed in by you",
      tone: "person",
    });
  });

  it("styles a suggestion in the attention style, and says what kind of suggestion it is", () => {
    expect(cellView({ status: "set", value: "Slim", provenance: "ai-suggested" })).toEqual({
      text: "Slim",
      source: "Suggested by the assistant",
      tone: "suggested",
    });
    expect(cellView({ status: "set", value: "20.0", provenance: "suggested-chart" }).source).toBe("Suggested from a size chart");
    expect(cellView({ status: "set", value: "Red", provenance: "read-from-image" }).source).toBe("Read from a picture");
  });

  it("styles a value worked out from other values quietly", () => {
    expect(cellView({ status: "set", value: "Polo collar", provenance: "derived" }).tone).toBe("derived");
  });

  it("adds a unit after a value but never after to be confirmed", () => {
    expect(cellView({ status: "set", value: "52.0", provenance: "user-edited" }, "cm").text).toBe("52.0 cm");
    expect(cellView(TBC, "cm").text).toBe("To be confirmed");
  });

  it("never uses a word that means checked", () => {
    for (const provenance of ["brand-supplied", "user-edited", "suggested-chart", "ai-suggested", "read-from-image", "derived"] as const) {
      const view = cellView({ status: "set", value: "x", provenance });
      expect(view.source).not.toMatch(/checked|verified|approved/i);
    }
  });
});

describe("toleranceView", () => {
  it("shows a tolerance in centimetres with its source", () => {
    expect(toleranceView({ status: "set", value: "±1.0", tenthsMm: 100, provenance: "suggested-chart" })).toEqual({
      text: "±1.0 cm",
      source: "Suggested from a size chart",
      tone: "suggested",
    });
  });

  it("shows a missing tolerance as To be confirmed", () => {
    expect(toleranceView(TBC).text).toBe("To be confirmed");
  });
});

describe("classView", () => {
  it("shows the name of the stitch or seam, its ISO number, and its source", () => {
    expect(
      classView({ status: "set", value: "Four thread overedge", provenance: "derived", iso: "514", explanation: "A stitch." }),
    ).toEqual({
      text: "Four thread overedge",
      iso: "ISO 514",
      explanation: "A stitch.",
      source: "Worked out from other values",
      tone: "derived",
    });
  });
});

describe("sectionLink", () => {
  it("is the address of a section on the tech pack page", () => {
    expect(sectionLink("measurements")).toBe("#measurements");
  });
});
