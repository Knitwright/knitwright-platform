import { describe, expect, it } from "vitest";
import { canvasHref, garmentEditorHref, isUuid, movedHref, OWN_GARMENT, projectHref, readFocus } from "./address";

const ID = "11111111-1111-4111-8111-111111111111";

describe("the one canvas's address", () => {
  it("opens a design or a launch canvas at /project/<id>", () => {
    expect(projectHref(ID)).toBe(`/project/${ID}`);
    expect(canvasHref(ID)).toBe(`/project/${ID}`);
  });

  it("opens a design's garment in the editor in place, with the editor's own query", () => {
    expect(garmentEditorHref(ID)).toBe(`/project/${ID}?focus=garment`);
    expect(garmentEditorHref(ID, { view: "pattern" })).toBe(`/project/${ID}?focus=garment&view=pattern`);
  });

  it("reads a focus of the design's own garment or of one board, and nothing else", () => {
    expect(readFocus({ focus: OWN_GARMENT })).toBe("garment");
    expect(readFocus({ focus: [ID, "x"] })).toBe(ID);
    expect(readFocus({ focus: "<script>" })).toBeNull();
    expect(readFocus({})).toBeNull();
  });

  it("moves an old address to the canvas with its whole query", () => {
    expect(movedHref(ID, { view: "pattern", opt: ["a:1", "b:2"], none: undefined }, true)).toBe(`/project/${ID}?focus=garment&view=pattern&opt=a%3A1&opt=b%3A2`);
    expect(movedHref(ID, { focus: "x" }, true)).toBe(`/project/${ID}?focus=garment`);
    expect(movedHref(ID, { panel: "mockups" }, false)).toBe(`/project/${ID}?panel=mockups`);
    expect(movedHref(ID, {}, false)).toBe(`/project/${ID}`);
  });

  it("knows an id when it sees one", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("studio")).toBe(false);
  });
});
