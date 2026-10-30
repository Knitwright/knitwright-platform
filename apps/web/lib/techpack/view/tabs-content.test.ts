import { describe, expect, it } from "vitest";
import { GAP_RULE } from "@/lib/kpp/model";
import { buildCallouts, buildQc, CALLOUT_MODES, CALLOUT_MODE_LABELS } from "./callouts";
import { isNeedsInput } from "./fields";
import { article, bareArticle, design, emptyDesign, emptyHeader, header, mark } from "./fixtures/views";
import { buildMaterials } from "./materials";
import { buildBody, buildOverview, styleCode } from "./overview";
import { cellsOf, emptyCellsOf } from "./rows";
import { buildArtworks, buildColourwaysTab, buildLabels, buildPersonalisation } from "./surfaces";

/**
 * The ten content tabs of spec F-S6. The thread running through every test here is the same: a
 * value the data holds is shown with the chip that says where it came from, and a value the data
 * does not hold reads "Needs your input" with the rule that says who fills it. Nothing is worked
 * out from something else to make a tab look finished.
 */

describe("the Overview tab", () => {
  it("shows the header fields the person typed, from the design", () => {
    const view = buildOverview(header(), article());
    const fields = view.sections[0]?.fields ?? [];
    expect(fields.find((entry) => entry.id === "brand")?.text).toBe("Rovers FC");
    expect(fields.find((entry) => entry.id === "brand")?.provenance).toBe("from_design");
  });

  it("asks for every header field of a design that has none, and guesses none of them", () => {
    const fields = buildOverview(emptyHeader(), article()).sections[0]?.fields ?? [];
    expect(fields.every(isNeedsInput)).toBe(true);
    expect(fields.every((entry) => entry.text === null)).toBe(true);
  });

  it("builds the style code from the brand and the name, as the spec's <brand>_<name>", () => {
    expect(styleCode(header())).toBe("ROVERS-FC_ROVERS-HOME-SHIRT");
  });

  it("has no style code at all while either half of it is missing", () => {
    expect(styleCode(header({ brand: null }))).toBeNull();
    expect(styleCode(header({ styleName: "  " }))).toBeNull();
  });

  it("shows the base article's own facts from the base, locked", () => {
    const base = buildOverview(header(), article()).sections[1]?.fields ?? [];
    const code = base.find((entry) => entry.id === "base-article");
    expect(code?.text).toBe("JSY-SS-01");
    expect(code?.provenance).toBe("from_base");
    expect(code?.locked).toBe(true);
    expect(base.find((entry) => entry.id === "size-range")?.text).toBe("XS, S, M, L, XL, 2XL, 3XL");
    expect(base.find((entry) => entry.id === "sample-size")?.text).toBe("M");
  });

  it("says plainly that a design off the catalogue has no base fields, and asks for them", () => {
    const view = buildOverview(header(), null);
    expect(view.sections[1]?.note).toContain("not on a base article");
    expect((view.sections[1]?.fields ?? []).every(isNeedsInput)).toBe(true);
  });

  it("leads with the base's first construction steps as the key features", () => {
    const features = buildOverview(header(), article()).sections[1]?.tables[0];
    expect(features?.rows).toHaveLength(4);
    expect(features?.rows[0]?.label).toBe("Shoulder seams");
    expect(buildOverview(header(), null).sections[1]?.tables[0]?.rows).toEqual([]);
  });
});

describe("the Body tab", () => {
  it("says the body size chart is not on file, rather than working one out from the garment", () => {
    const view = buildBody(article());
    expect(view.sections[0]?.note).toContain("No body size chart is on file");
    const chart = view.sections[0]?.tables[0];
    expect(chart?.rows.map((row) => row.label)).toEqual(["Chest", "Waist", "Hip", "Height"]);
    for (const row of chart?.rows ?? []) expect(row.cells[1]?.text).toBeNull();
  });

  it("shows the size run and the sample size it grades from, which the base does hold", () => {
    const fields = buildBody(article()).sections[0]?.fields ?? [];
    expect(fields.find((entry) => entry.id === "body-sizes")?.text).toBe("XS, S, M, L, XL, 2XL, 3XL");
    expect(fields.find((entry) => entry.id === "body-sample")?.text).toBe("M");
  });

  it("asks for the size run too when there is no base article", () => {
    const fields = buildBody(null).sections[0]?.fields ?? [];
    expect(fields.every(isNeedsInput)).toBe(true);
    expect(buildBody(null).sections[0]?.tables[0]?.note).toContain("No body size chart is on file");
  });
});

describe("the Materials (BOM) tab", () => {
  const tables = (spec = design(), base = article()) => buildMaterials(spec, base).sections[0]?.tables ?? [];

  it("has the five sections the spec names, with the spec's six columns", () => {
    expect(tables().map((entry) => entry.title)).toEqual(["Fabrics", "Threads", "Trims", "Labels", "Packaging"]);
    for (const entry of tables()) {
      expect(entry.columns, entry.title).toEqual(["Description", "Print / colour", "Code", "Quantity", "Unit", "Notes"]);
    }
  });

  it("takes the fabrics and the threads from the base article, locked", () => {
    const fabrics = tables().find((entry) => entry.id === "fabrics");
    expect(fabrics?.rows.length).toBeGreaterThan(0);
    expect(fabrics?.rows[0]?.cells[2]?.text).toBe("F-POLY-INT");
    expect(fabrics?.rows[0]?.cells[2]?.provenance).toBe("from_base");
    const threads = tables().find((entry) => entry.id === "threads");
    expect(threads?.rows.map((row) => row.label)).toEqual(["Needle thread", "Looper thread"]);
    expect(threads?.rows[0]?.cells[0]?.locked).toBe(true);
  });

  it("says plainly that no packaging is on file, and offers none", () => {
    expect(tables().find((entry) => entry.id === "packaging")?.note).toContain("No packaging is on file");
    expect(tables().find((entry) => entry.id === "packaging")?.rows).toEqual([]);
  });

  it("shows a draft article's fabric code and nothing it does not carry", () => {
    const draft = tables(design(), bareArticle());
    const fabrics = draft.find((entry) => entry.id === "fabrics");
    expect(fabrics?.rows.length).toBeGreaterThan(0);
    expect(fabrics?.rows[0]?.cells[0]?.text).toBeNull();
    expect(draft.find((entry) => entry.id === "threads")?.rows).toEqual([]);
    expect(tables(design(), null).find((entry) => entry.id === "fabrics")?.rows).toEqual([]);
    expect(tables(design(), null).find((entry) => entry.id === "threads")?.rows).toEqual([]);
  });

  it("shows the design's own trims and labels, and asks for the parts of them nobody has given", () => {
    const trims = tables().find((entry) => entry.id === "trims");
    for (const row of trims?.rows ?? []) {
      expect(row.cells[2]?.text, row.label).toBeNull();
      expect(row.cells[4]?.text, row.label).toBeNull();
    }
  });
});

describe("the Callouts tab", () => {
  it("offers the Callout and References toggle the spec names", () => {
    expect(CALLOUT_MODES).toEqual(["callout", "references"]);
    expect(Object.values(CALLOUT_MODE_LABELS)).toEqual(["Callout", "References"]);
  });

  it("numbers a row for every step of the base's construction table, locked", () => {
    const rows = buildCallouts(article(), []).sections[0]?.tables[0]?.rows ?? [];
    expect(rows).toHaveLength(article().construction.length);
    expect(rows[0]?.label).toBe("1 Shoulder seams");
    expect(rows[0]?.cells.every((entry) => entry.locked || entry.text === null)).toBe(true);
    expect(rows[0]?.cells[1]?.provenance).toBe("from_base");
  });

  it("numbers a callout the Specs toolbar drew on from the base's own rows", () => {
    const rows = buildCallouts(article(), [mark({ tool: "callout", label: "Back neck", note: "Tape it" })]).sections[0]?.tables[0]?.rows ?? [];
    const last = rows.at(-1);
    expect(last?.label).toBe(`${article().construction.length + 1} Back neck`);
    expect(last?.cells[2]?.text).toBe("Tape it");
    expect(last?.cells[2]?.provenance).toBe("from_design");
  });

  it("leaves a measuring mark off the callouts, because it is a measurement, not a note", () => {
    const rows = buildCallouts(article(), [mark()]).sections[0]?.tables[0]?.rows ?? [];
    expect(rows).toHaveLength(article().construction.length);
  });

  it("says a draft article has no callouts yet", () => {
    expect(buildCallouts(bareArticle(), []).sections[0]?.note).toContain("No construction table is on file");
    expect(buildCallouts(null, []).sections[0]?.tables[0]?.rows).toEqual([]);
  });

  it("asks for a reference image for each callout the founder drew", () => {
    const view = buildCallouts(article(), [mark({ tool: "callout" })]);
    expect(view.sections[1]?.fields.map((entry) => entry.label)).toEqual(["Reference image for Pocket opening"]);
  });
});

describe("the QC tab", () => {
  it("names the four things the spec asks for and says each is not on file", () => {
    const view = buildQc(article());
    expect(view.sections[0]?.note).toContain("not on file");
    expect(view.sections[0]?.fields.map((entry) => entry.label)).toEqual([
      "Inspection plan",
      "Points of measure to check",
      "Colour check",
      "Photographs for every order",
    ]);
  });

  it("lists the base's own points of measure as the ones to check, because the base does hold those", () => {
    const measure = buildQc(article()).sections[0]?.fields[1];
    expect(measure?.text).toBe("A, B, C, D, E, F, G, H, I, J, K, L");
    expect(measure?.provenance).toBe("from_base");
    expect(measure?.ruleId).toBe("R-QC-001");
  });

  it("asks for them when the article has none", () => {
    expect(buildQc(bareArticle()).sections[0]?.fields[1]?.text).toBeNull();
    expect(buildQc(null).sections[0]?.fields[1]?.text).toBeNull();
  });
});

describe("the Artworks tab", () => {
  it("shows one row per graphic, with the columns the spec names", () => {
    const view = buildArtworks(design());
    const artwork = view.sections[0]?.tables[0];
    expect(artwork?.columns).toEqual(["Artwork", "Type", "Panel", "Width", "Height", "Across", "Down", "Angle"]);
    expect(artwork?.rows.length).toBeGreaterThan(0);
  });

  it("says plainly when a design has no graphic at all", () => {
    expect(buildArtworks(emptyDesign()).sections[0]?.note).toContain("no graphic");
  });
});

describe("the Colourways tab", () => {
  it("has one block per colourway, and marks the one the canvas is showing", () => {
    const spec = design();
    const view = buildColourwaysTab(spec, spec.colourways[0].id);
    expect(view.sections).toHaveLength(spec.colourways.length);
    expect(view.sections[0]?.title).toContain("shown on the canvas");
    expect(buildColourwaysTab(spec, "other").sections[0]?.title).not.toContain("shown on the canvas");
  });

  it("asks for the swatch id and the Delta-E tolerance, which the design does not hold", () => {
    const spec = design();
    const rows = buildColourwaysTab(spec, spec.colourways[0].id).sections[0]?.tables[0]?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.cells[3]?.text, row.label).toBeNull();
      expect(row.cells[4]?.ruleId, row.label).toBe("R-SUB-005");
    }
  });
});

describe("the Personalisation tab", () => {
  it("names the zones and says the base's own rules are not on file yet", () => {
    const view = buildPersonalisation(article());
    expect(view.sections[0]?.note).toContain("not on file");
    const rows = view.sections[0]?.tables[0]?.rows ?? [];
    expect(rows.map((row) => row.label)).toEqual(["Name on the back", "Number on the back", "Number on the front"]);
    expect(rows[0]?.cells[1]?.ruleId).toBe("R-PER-001");
    expect(rows[0]?.cells[3]?.ruleId).toBe("R-PER-003");
  });

  it("asks for every part of every zone, because none of them is in the data", () => {
    const rows = buildPersonalisation(null).sections[0]?.tables[0]?.rows ?? [];
    for (const row of rows) expect(row.cells.slice(1).every(isNeedsInput), row.label).toBe(true);
  });
});

describe("the Labels & packaging tab", () => {
  it("shows the five label fields the design holds, and asks for the market's own", () => {
    const view = buildLabels(design());
    expect(view.sections[0]?.fields).toHaveLength(5);
    expect(view.sections[1]?.note).toContain("No destination market");
    expect(emptyCellsOf(view).length).toBeGreaterThan(0);
  });

  it("asks for every label field of a design that has none", () => {
    const view = buildLabels(emptyDesign());
    expect(view.sections[0]?.fields.every(isNeedsInput)).toBe(true);
    expect(cellsOf(view).every((entry) => entry.ruleId.startsWith("R-"))).toBe(true);
  });
});

describe("every cell of every tab", () => {
  it("carries a rule id, so a person can always ask why", () => {
    const tabs = [
      buildOverview(header(), article()),
      buildBody(article()),
      buildMaterials(design(), article()),
      buildCallouts(article(), [mark({ tool: "callout" })]),
      buildArtworks(design()),
      buildColourwaysTab(design(), design().colourways[0].id),
      buildPersonalisation(article()),
      buildLabels(design()),
      buildQc(article()),
    ];
    for (const view of tabs) {
      for (const entry of cellsOf(view)) {
        expect(entry.ruleId, `${view.id}: ${entry.label}`).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
      }
    }
    expect(cellsOf(buildBody(null)).some((entry) => entry.ruleId === "R-FIT-001")).toBe(true);
    expect(GAP_RULE).toBe("R-GAP-000");
  });
});
