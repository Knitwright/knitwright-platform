import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyAction } from "@/lib/garment";
import { completenessReport, confirmSentence } from "./completeness";
import { CHARTS, PROJECT, TOPS_IDS, fullDesign, packFor } from "./fixtures/designs";

describe("confirmSentence", () => {
  it("says nothing is left, one thing, or how many things", () => {
    expect(confirmSentence(0)).toBe("Nothing is left to confirm.");
    expect(confirmSentence(1)).toBe("1 thing to confirm.");
    expect(confirmSentence(12)).toBe("12 things to confirm.");
  });
});

describe("completenessReport", () => {
  const report = completenessReport(packFor(start("crew-tee")));

  it("counts what is still to be confirmed in a new crew tee, section by section", () => {
    expect(report.total).toBe(38);
    expect(report.sections.map((section) => [section.id, section.items.length])).toEqual([
      ["cover", 4],
      ["measurements", 11],
      ["components", 6],
      ["construction", 7],
      ["colourways", 5],
      ["labelling", 5],
    ]);
  });

  it("adds up: the total is the sum of the items", () => {
    expect(report.sections.reduce((sum, section) => sum + section.items.length, 0)).toBe(report.total);
  });

  it("names each thing and says what about it is missing", () => {
    const cover = report.sections.find((section) => section.id === "cover");
    expect(cover?.items.map((item) => item.label)).toEqual(["Style number", "Season", "Base size", "Size run"]);
    const measurements = report.sections.find((section) => section.id === "measurements");
    expect(measurements?.items[0]).toEqual({
      sectionId: "measurements",
      sectionTitle: "Measurement table",
      label: "Chest width",
      detail: "The value and the tolerance",
    });
    const components = report.sections.find((section) => section.id === "components");
    expect(components?.items[0]).toMatchObject({
      label: "Fabric for Body front, Body back, Left sleeve, Right sleeve and Neckband",
      detail: "Composition, construction, weight, finish, stretch and consumption",
    });
    expect(components?.items[1]).toMatchObject({ label: "Main thread", detail: "Name, details and quantity" });
    const construction = report.sections.find((section) => section.id === "construction");
    expect(construction?.items[0]).toMatchObject({ label: "Shoulder seam", detail: "Stitch density" });
    const colourways = report.sections.find((section) => section.id === "colourways");
    expect(colourways?.items[0]).toMatchObject({ label: "Main colourway: Body front", detail: "Colour code and screen colour" });
  });

  it("gives the section each item belongs to, so a screen can link to it", () => {
    for (const section of report.sections) {
      for (const item of section.items) expect(item.sectionId).toBe(section.id);
    }
  });

  it("does not count the sign-off, which is empty on purpose, or artwork there is none of", () => {
    expect(report.sections.some((section) => section.id === "sign-off" || section.id === "artwork")).toBe(false);
  });

  it("goes down by exactly one when one field is filled in", () => {
    const filled = completenessReport(packFor(start("crew-tee"), { project: { ...PROJECT, season: "SS27" } }));
    expect(filled.total).toBe(report.total - 1);
    expect(filled.sections[0]?.items.map((item) => item.label)).toEqual(["Style number", "Base size", "Size run"]);
  });

  it("goes down by exactly one when one label is filled in", () => {
    const spec = applyAction(start("crew-tee"), { type: "set-labelling", field: "care", text: "Wash cold", provenance: "user-edited" });
    if (!spec.ok) throw new Error(spec.reason);
    expect(completenessReport(packFor(spec.spec)).total).toBe(report.total - 1);
  });

  it("goes down by one, for the row, when a chest width is typed but the tolerance is still missing", () => {
    const spec = applyAction(start("crew-tee"), { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" });
    if (!spec.ok) throw new Error(spec.reason);
    const next = completenessReport(packFor(spec.spec));
    const chest = next.sections.find((section) => section.id === "measurements")?.items.find((item) => item.label === "Chest width");
    expect(chest?.detail).toBe("The tolerance");
    expect(next.total).toBe(report.total);
  });

  it("names the sizes that have no value", () => {
    const sized = applyAction(start("crew-tee"), { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } });
    if (!sized.ok) throw new Error(sized.reason);
    const typed = applyAction(sized.spec, { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" });
    if (!typed.ok) throw new Error(typed.reason);
    const item = completenessReport(packFor(typed.spec)).sections.find((section) => section.id === "measurements")?.items[0];
    expect(item?.detail).toBe("The value for sizes S and L, and the tolerance");
  });

  it("counts the values that are suggestions separately", () => {
    expect(report.suggested).toBe(0);
    const withChart = completenessReport(packFor(fullDesign("crew-tee"), { charts: CHARTS }));
    expect(withChart.suggested).toBeGreaterThan(0);
  });

  it("finds less to confirm in a full design than in a new one, for every tops type", () => {
    for (const typeId of TOPS_IDS) {
      const empty = completenessReport(packFor(start(typeId)));
      const full = completenessReport(packFor(fullDesign(typeId)));
      expect(full.total).toBeLessThan(empty.total);
    }
  });
});
