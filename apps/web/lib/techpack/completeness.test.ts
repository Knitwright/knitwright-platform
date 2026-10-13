import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyAction } from "@/lib/garment";
import { completenessReport, confirmSentence } from "./completeness";
import { CHARTS, PROJECT, TOPS_IDS, fullDesign, packFor } from "./fixtures/designs";

describe("confirmSentence", () => {
  const report = (total: number, suggested = 0, proposed = 0) => ({ total, suggested, proposed });

  it("says one thing, or how many things, while a field is empty", () => {
    expect(confirmSentence(report(1))).toBe("1 thing to confirm.");
    expect(confirmSentence(report(12, 3, 4))).toBe("12 things to confirm.");
  });

  it("never says that nothing is left when suggestions or proposals remain", () => {
    expect(confirmSentence(report(0, 2, 0))).toBe(
      "No empty fields. Suggestions and proposed stitching are still not confirmed by anyone.",
    );
    expect(confirmSentence(report(0, 0, 5))).toBe(
      "No empty fields. Suggestions and proposed stitching are still not confirmed by anyone.",
    );
  });

  it("says only that no field is empty when there is nothing else to confirm", () => {
    expect(confirmSentence(report(0))).toBe("No empty fields.");
  });

  it("never says the design is confirmed, whatever the counts", () => {
    for (const total of [0, 1, 5]) {
      for (const other of [0, 3]) {
        expect(confirmSentence(report(total, other, other))).not.toMatch(/nothing is left|all confirmed|complete/i);
      }
    }
  });
});

describe("completenessReport", () => {
  const report = completenessReport(packFor(start("crew-tee")));

  it("counts what is still to be confirmed in a new crew tee, section by section", () => {
    expect(report.total).toBe(39);
    expect(report.sections.map((section) => [section.id, section.items.length])).toEqual([
      ["cover", 4],
      ["measurements", 11],
      ["components", 7],
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
      target: "chest-width",
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

  it("counts the proposals by the platform apart from the empty fields and the suggestions", () => {
    expect(report.proposed).toBe(8);
    expect(report.suggested).toBe(0);
    const total = report.total;
    const overridden = packFor(
      (() => {
        const result = applyAction(start("crew-tee"), {
          type: "set-construction",
          entry: { seamId: "body-hem", seamClass: "bound", stitchClass: "lockstitch", stitchDensity: "", provenance: "user-edited" },
        });
        if (!result.ok) throw new Error(result.reason);
        return result.spec;
      })(),
    );
    expect(completenessReport(overridden).proposed).toBe(7);
    expect(completenessReport(overridden).total).toBe(total);
  });

  it("counts the values that are suggestions separately", () => {
    expect(report.suggested).toBe(0);
    const withChart = completenessReport(packFor(fullDesign("crew-tee"), { charts: CHARTS }));
    expect(withChart.suggested).toBeGreaterThan(0);
  });

  it("names the thing each item is about, so a screen can go to its field", () => {
    const targets = Object.fromEntries(report.sections.map((section) => [section.id, section.items.map((item) => item.target)]));
    expect(targets.cover).toEqual(["styleNumber", "season", "baseSize", "sizeRun"]);
    expect(targets.measurements?.[0]).toBe("chest-width");
    expect(targets.components?.slice(0, 2)).toEqual(["fabric:main", "main-thread"]);
    expect(targets.construction?.[0]).toBe("shoulder-seam");
    expect(targets.colourways?.[0]).toBe("main:body-front");
    expect(targets.labelling?.[0]).toBe("care");
  });

  it("is filled for every size and the tolerance when a person types them, with no chart", () => {
    const steps = [
      { type: "set-sizing", sizing: { sizes: ["S", "M"], baseSize: "M" } },
      { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" },
      { type: "set-size-measurement", entry: { pointId: "chest-width", size: "S", value: 5000, provenance: "user-edited" } },
      { type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: "user-edited" } },
    ];
    const spec = steps.reduce((current, step) => {
      const result = applyAction(current, step);
      if (!result.ok) throw new Error(result.reason);
      return result.spec;
    }, start("crew-tee"));
    const pack = packFor(spec);
    const row = pack.measurements.groups.flatMap((group) => group.rows).find((entry) => entry.pointId === "chest-width");
    expect(row?.tolerance).toMatchObject({ status: "set", value: "±1.0", provenance: "user-edited" });
    expect(row?.values.map((value) => value.status === "set" && value.provenance)).toEqual(["user-edited", "user-edited"]);
    const items = completenessReport(pack).sections.find((section) => section.id === "measurements")?.items ?? [];
    expect(items.some((item) => item.target === "chest-width")).toBe(false);
  });

  it("finds less to confirm in a full design than in a new one, for every tops type", () => {
    for (const typeId of TOPS_IDS) {
      const empty = completenessReport(packFor(start(typeId)));
      const full = completenessReport(packFor(fullDesign(typeId)));
      expect(full.total).toBeLessThan(empty.total);
    }
  });
});
