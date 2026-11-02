import { describe, expect, it } from "vitest";
import { MADE_UP_CHART_SET, madeUpChart } from "@/lib/sizing/fixtures/made-up-charts";
import { MADE_UP_RUNS } from "@/lib/sizing/fixtures/made-up-size-runs";
import { NO_CHART_SET } from "@/lib/sizing/fixtures/no-charts";
import type { ChartSet } from "@/lib/sizing";
import { WEARER_NOTE, buildSizeGuide, guideForWearer } from "./size-guide";

describe("buildSizeGuide", () => {
  it("has a row for every size of the run and a measurement in each", () => {
    const guide = buildSizeGuide(MADE_UP_CHART_SET, "crew-tee", "mens");

    expect(guide.notice).toBeNull();
    expect(guide.rows.map((row) => row.sizeLabel)).toEqual(guide.sizes);
    expect(guide.points.length).toBeGreaterThan(0);
    expect(guide.rows[0]?.cells[0]?.value).toMatch(/^\d/);
  });

  it("shows a handful of measurements, not a whole tech pack", () => {
    expect(buildSizeGuide(MADE_UP_CHART_SET, "crew-tee", "mens").points.length).toBeLessThanOrEqual(4);
  });

  it("says where the numbers came from, and that they are the garment and not a body", () => {
    const guide = buildSizeGuide(MADE_UP_CHART_SET, "crew-tee", "mens");

    expect(guide.source).toContain("Test Person");
    expect(guide.source).toContain("The garment, not your body.");
    expect(guide.source).toContain("a Knitwright starter chart, not your club's own");
  });

  it("says plainly when it is the club's own chart", () => {
    const own: ChartSet = { runs: MADE_UP_RUNS, charts: [{ ...madeUpChart("crew-tee", "men"), supplier: "brand" }] };

    expect(buildSizeGuide(own, "crew-tee", "mens").source).toContain("your club's own size chart");
  });

  it("says a unisex kit is being shown the men's numbers rather than letting it pass as its own", () => {
    expect(buildSizeGuide(MADE_UP_CHART_SET, "crew-tee", "unisex").source).toContain(WEARER_NOTE);
    expect(buildSizeGuide(MADE_UP_CHART_SET, "crew-tee", "mens").source).not.toContain(WEARER_NOTE);
  });

  it("has a plain notice and no made-up numbers when the club has no chart", () => {
    const guide = buildSizeGuide(NO_CHART_SET, "crew-tee", "mens");

    expect(guide.rows).toEqual([]);
    expect(guide.notice).toContain("has not put its size chart in yet");
  });

  it("has a notice for a wearer the club keeps no chart for, rather than another wearer's numbers", () => {
    const menOnly: ChartSet = { runs: MADE_UP_RUNS, charts: [madeUpChart("crew-tee", "men")] };

    expect(buildSizeGuide(menOnly, "crew-tee", "womens").notice).not.toBeNull();
  });

  it("has a notice for a chart whose run is missing, rather than half a table", () => {
    const noRun: ChartSet = { runs: [], charts: [madeUpChart("crew-tee", "men")] };

    expect(buildSizeGuide(noRun, "crew-tee", "mens").notice).not.toBeNull();
  });

  it("has a notice for a garment the registry does not know, whose points have no names", () => {
    const strange: ChartSet = { runs: MADE_UP_RUNS, charts: [{ ...madeUpChart("crew-tee", "men"), garmentType: "not-a-garment" }] };

    expect(buildSizeGuide(strange, "not-a-garment", "mens").notice).not.toBeNull();
  });
});

describe("guideForWearer", () => {
  it("picks a chart for the cut without a design to go by, because a link belongs to a season", () => {
    expect(guideForWearer(MADE_UP_CHART_SET, "womens").notice).toBeNull();
  });

  it("prefers the club's own chart over a Knitwright starter one", () => {
    const both: ChartSet = {
      runs: MADE_UP_RUNS,
      charts: [madeUpChart("crew-tee", "men"), { ...madeUpChart("crew-tee", "men"), garmentType: "polo", supplier: "brand" }],
    };

    expect(guideForWearer(both, "mens").source).toContain("your club's own size chart");
  });

  it("has a plain notice where the club keeps no chart for that cut at all", () => {
    expect(guideForWearer(NO_CHART_SET, "junior").notice).not.toBeNull();
  });
});
