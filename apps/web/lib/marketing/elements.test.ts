import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/rulebook/constants";
import { ELEMENTS, ELEMENT_KINDS, ELEMENT_KIND_LABELS, NO_LIBRARY_NOTE, elementById, elementTransform, elementsOfKind } from "./elements";
import { COLOUR_ROLES } from "./templates/types";

describe("the elements the panel offers", () => {
  it("is drawn by the platform: every one is a path, and none is a file", () => {
    for (const one of ELEMENTS) {
      expect(one.path, one.id).toMatch(/^[MLQAZ\d.,\s-]+$/i);
      expect(JSON.stringify(one)).not.toMatch(/https?:|\.png|\.svg|\.jpg/);
    }
  });

  it("stays on the unit square, so one shape works in any slot", () => {
    for (const one of ELEMENTS) {
      for (const number of one.path.match(/[\d.]+/g) ?? []) {
        expect(Number(number), `${one.id}: ${number}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("names a colour role and never a colour", () => {
    for (const one of ELEMENTS) {
      expect(COLOUR_ROLES, one.id).toContain(one.colourRole);
      expect(JSON.stringify(one)).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("gives every element an id of its own, a label and a rule id", () => {
    expect(new Set(ELEMENTS.map((one) => one.id)).size).toBe(ELEMENTS.length);
    for (const one of ELEMENTS) {
      expect(one.label.length).toBeGreaterThan(2);
      expect(one.ruleId).toMatch(RULE_ID);
    }
  });

  it("has some of each kind, each kind with words for a heading", () => {
    for (const kind of ELEMENT_KINDS) {
      expect(elementsOfKind(kind).length, kind).toBeGreaterThan(0);
      expect(ELEMENT_KIND_LABELS[kind].length).toBeGreaterThan(2);
    }
  });

  it("finds one by id, and nothing by an id that is not there", () => {
    expect(elementById("sash")!.label).toBe("Sash");
    expect(elementById("nope")).toBeNull();
  });

  it("says plainly that no licensed graphics library is on file", () => {
    expect(NO_LIBRARY_NOTE).toContain("No licensed graphics library is on file yet");
  });
});

describe("putting an element on an artboard", () => {
  it("scales the unit square onto the rectangle, whatever curves the shape has", () => {
    expect(elementTransform({ x: 100, y: 200, width: 300, height: 400 })).toBe("translate(100 200) scale(300 400)");
  });
});
