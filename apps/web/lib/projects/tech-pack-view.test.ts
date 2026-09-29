import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TBC } from "@/lib/techpack";
import { cellView, classView, sectionHasForms, sectionLink, summaryTone, toleranceView } from "./tech-pack-view";

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
      classView({ status: "set", value: "Four thread overedge", provenance: "derived", iso: "514", explanation: "A stitch.", proposal: false }),
    ).toEqual({
      text: "Four thread overedge",
      iso: "ISO 514",
      explanation: "A stitch.",
      source: "Worked out from other values",
      tone: "derived",
    });
  });

  it("says a class that comes from the registry rule is only proposed, in the attention style", () => {
    const view = classView({
      status: "set",
      value: "Four thread overedge",
      provenance: "derived",
      iso: "514",
      explanation: "A stitch.",
      proposal: true,
    });
    expect(view.source).toBe("Proposed by Knitwright. Not confirmed by anyone.");
    expect(view.tone).toBe("suggested");
  });
});

describe("sectionLink", () => {
  it("is the address of a section on the tech pack page", () => {
    expect(sectionLink("measurements")).toBe("#measurements");
  });
});

describe("sectionHasForms", () => {
  it("is true for the sections whose forms are kept closed, so a link can open them", () => {
    expect(sectionHasForms("components")).toBe(true);
    expect(sectionHasForms("construction")).toBe(true);
    expect(sectionHasForms("labelling")).toBe(true);
  });

  it("is false for the sections that are always open, and for those filled in in the editor", () => {
    for (const id of ["cover", "flats", "measurements", "how-to-measure", "colourways", "artwork", "suggested", "sign-off"] as const) {
      expect(sectionHasForms(id)).toBe(false);
    }
  });
});

describe("summaryTone", () => {
  it("is never the tone kept for values signed by a named person", () => {
    for (const total of [0, 1, 40]) {
      for (const suggested of [0, 2]) {
        for (const proposed of [0, 3]) {
          expect(["warn", "info"]).toContain(summaryTone({ total, suggested, proposed }));
        }
      }
    }
  });

  it("uses the attention style while anything is empty, suggested or proposed", () => {
    expect(summaryTone({ total: 1, suggested: 0, proposed: 0 })).toBe("warn");
    expect(summaryTone({ total: 0, suggested: 1, proposed: 0 })).toBe("warn");
    expect(summaryTone({ total: 0, suggested: 0, proposed: 1 })).toBe("warn");
    expect(summaryTone({ total: 0, suggested: 0, proposed: 0 })).toBe("info");
  });
});

describe("the green style", () => {
  const ROOT = join(__dirname, "..", "..");
  const files = (dir: string, pattern: RegExp): string[] =>
    readdirSync(join(ROOT, dir)).filter((name) => pattern.test(name) && !/\.test\./.test(name)).map((name) => join(ROOT, dir, name));
  const sources = [
    ...files("components/techpack", /\.tsx?$/),
    ...files("lib/projects", /^tech-pack-.*\.ts$/),
    ...files("lib/techpack", /\.ts$/),
  ];

  it("finds the files it checks", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it("is not used by the tech pack page or its view models: no ok tone and none of its colour classes", () => {
    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/tone=["{]+ok|["']ok["']|(bg|text|border)-ok|-ok-wash/);
    }
  });
});

