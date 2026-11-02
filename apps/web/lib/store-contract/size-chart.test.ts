import { describe, expect, it } from "vitest";
import { CHART_SOURCE, storeSizeChart } from "./size-chart";
import { pom } from "./fixtures/samples";

/**
 * The size chart. Seven of the eight base articles publish no measurement at all (decision 0090),
 * so the test that matters is the one that holds those to a gap rather than an empty table.
 */

const sizes = ["S", "M", "L"];

describe("the size chart of an article that has measurements", () => {
  it("carries each measured place across the size run, in millimetres", () => {
    const chart = storeSizeChart({ sizes, sampleSize: "M", poms: [pom()] });
    if (chart.status !== "held") throw new Error("held");

    expect(chart.sizes).toEqual(sizes);
    expect(chart.unit).toBe("mm");
    expect(chart.points[0]?.valuesMm).toEqual({ S: 500, M: 520, L: 540 });
    expect(chart.points[0]?.tolMinusMm).toBe(10);
  });

  it("says which kind of chart it is, so a garment figure is not read as a body figure", () => {
    const chart = storeSizeChart({ sizes, sampleSize: "M", poms: [pom()] });
    if (chart.status !== "held") throw new Error("held");

    expect(chart.source).toBe(CHART_SOURCE);
    expect(chart.source).toContain("points of measure");
  });

  it("names the size it was measured in, or says it holds none", () => {
    const named = storeSizeChart({ sizes, sampleSize: "M", poms: [pom()] });
    if (named.status !== "held") throw new Error("held");
    expect(named.sampleSize.status).toBe("held");

    const unnamed = storeSizeChart({ sizes, sampleSize: null, poms: [pom()] });
    if (unnamed.status !== "held") throw new Error("held");
    expect(unnamed.sampleSize.status).toBe("gap");
  });

  it("leaves out a place with no figure in any size rather than sending an empty row", () => {
    const chart = storeSizeChart({ sizes, sampleSize: "M", poms: [pom(), pom({ letter: "B", valuesMm: {} })] });
    if (chart.status !== "held") throw new Error("held");

    expect(chart.points.map((point) => point.letter)).toEqual(["A"]);
  });
});

describe("the size chart of the seven articles that publish nothing", () => {
  it("is a gap, not an empty table, because an empty table reads as one size", () => {
    const chart = storeSizeChart({ sizes, sampleSize: "M", poms: [] });

    expect(chart.status).toBe("gap");
    if (chart.status !== "gap") throw new Error("gap");
    expect(chart.missing).toEqual(["any point of measure for this article"]);
    expect(chart.because).toContain("must not offer one it has worked out itself");
  });

  it("is a gap for an article with no size run either", () => {
    expect(storeSizeChart({ sizes: [], sampleSize: null, poms: [pom()] }).status).toBe("gap");
  });
});
