import { describe, expect, it } from "vitest";
import { article, design } from "../view/fixtures/views";
import { editorAddress, headerOfDesign, sheetDate, sheetsOfDesign, viewOfDesign } from "./from-project";

const stored = (patch: Partial<{ name: string; season: string }> = {}) => ({ name: "Home shirt", season: "2026/27", spec: design(), ...patch });

describe("the editor's inputs from a stored design", () => {
  it("fills the header only from what the design and the brand hold", () => {
    expect(headerOfDesign(stored(), "Lions FC")).toEqual({
      styleName: "Home shirt",
      formName: null,
      brand: "Lions FC",
      collection: null,
      season: "2026/27",
      factory: null,
    });
    expect(headerOfDesign(stored({ name: " ", season: "" }), "")).toMatchObject({ styleName: null, brand: null, season: null });
  });

  it("builds the view in centimetres at the sample size by default", () => {
    const view = viewOfDesign({ design: stored(), brandName: "Lions FC", article: article() });
    expect(view.unit).toBe("cm");
    expect(view.size).toBe("M");
    expect(viewOfDesign({ design: stored(), brandName: "", article: null }).size).toBe("");
  });

  it("writes the day and the address the sheets carry", () => {
    expect(sheetDate(new Date("2026-11-09T23:30:00.000Z"))).toBe("9 Nov 2026");
    expect(editorAddress("https://kw.test/", "abc")).toBe("https://kw.test/studio/abc/tech-pack");
    const sheets = sheetsOfDesign({ design: stored(), brandName: "Lions FC", article: article(), now: new Date("2026-11-09T00:00:00Z"), openIn: "x" });
    expect(sheets.header.rows).toContainEqual(["Date", "9 Nov 2026"]);
    expect(sheets.sheets).toHaveLength(8);
  });
});
