import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import { start } from "@/lib/garment/fixtures/specs";
import { withBrandCharts, type ChartSet } from "@/lib/sizing";
import { madeUpChart } from "@/lib/sizing/fixtures/made-up-charts";
import { buildCover } from "./cover";
import { buildMeasurements } from "./measurements";

/** A brand's own chart, built from made-up numbers. */
const brandSet: ChartSet = withBrandCharts({ runs: [], charts: [] }, [
  {
    run: { id: "brand-women-crew-tee-any", wearer: "women", sizes: ["U1", "U2", "U3", "U4"] },
    chart: { ...madeUpChart("crew-tee", "women"), sizeRunId: "brand-women-crew-tee-any", supplier: "brand" },
  },
  {
    run: { id: "brand-men-polo-any", wearer: "men", sizes: ["T1", "T2", "T3", "T4", "T5"] },
    chart: { ...madeUpChart("polo", "men"), sizeRunId: "brand-men-polo-any", supplier: "brand" },
  },
]);

describe("the tech pack with a brand's own chart", () => {
  it("marks every value and tolerance from it as supplied by the brand", () => {
    const section = buildMeasurements(designWith("crew-tee", {}), brandSet);
    const rows = section.groups.flatMap((group) => group.rows);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tolerance).toMatchObject({ status: "set", provenance: "brand-supplied" });
      for (const value of row.values) expect(value).toMatchObject({ status: "set", provenance: "brand-supplied" });
    }
  });

  it("says the sizes on the cover come from the brand when the design has none of its own", () => {
    const cover = buildCover({
      project: { name: "Club shirt", styleNumber: "CP-7", season: "SS27", brandName: "Test Brand" },
      version: 1,
      versionDate: "29 Sep 2026",
      versionDateIso: "2026-09-29",
      printedOn: "30 Sep 2026",
      printedOnIso: "2026-09-30",
      history: [],
      spec: start("polo", "men"),
      flats: { front: null, back: null },
      charts: brandSet,
    });
    expect(cover.sizeRun).toMatchObject({ status: "set", provenance: "brand-supplied" });
    expect(cover.baseSize).toMatchObject({ status: "set", provenance: "brand-supplied" });
  });
});
