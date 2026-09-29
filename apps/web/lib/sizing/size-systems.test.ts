import { describe, expect, it } from "vitest";
import { createSpec } from "@/lib/garment";
import { madeUpChart } from "./fixtures/made-up-charts";
import { MADE_UP_RUNS, MADE_UP_WOMEN_RUN } from "./fixtures/made-up-size-runs";
import { parseChartsCsv } from "./parse-charts";
import { runSuits, systemOfRun } from "./run-system";
import { selectChart } from "./select-chart";
import { buildChartSet } from "./validate";

const braRun = MADE_UP_RUNS.find((run) => run.wearer === "women" && run.system === "sports-bra");

const specFor = (typeId: string, wearer: "men" | "women" | "youth") => {
  const made = createSpec(typeId, wearer);
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
};

describe("size systems of size runs", () => {
  it("treats a run with no system as the usual sizes of its wearer", () => {
    expect(systemOfRun(MADE_UP_WOMEN_RUN)).toBe("adult");
    expect(systemOfRun({ id: "kids", wearer: "youth", sizes: ["A", "B"] })).toBe("youth");
    expect(braRun && systemOfRun(braRun)).toBe("sports-bra");
  });

  it("matches a run to a type and wearer only when wearer and size system agree", () => {
    expect(runSuits(MADE_UP_WOMEN_RUN, "singlet", "women")).toBe(true);
    expect(runSuits(MADE_UP_WOMEN_RUN, "sports-bra", "women")).toBe(false);
    expect(braRun && runSuits(braRun, "sports-bra", "women")).toBe(true);
    expect(braRun && runSuits(braRun, "singlet", "women")).toBe(false);
    expect(runSuits(MADE_UP_WOMEN_RUN, "singlet", "men")).toBe(false);
  });

  it("gives a sports bra its own made-up run, and other women's garments the usual one", () => {
    expect(madeUpChart("sports-bra", "women").sizeRunId).toBe(braRun?.id);
    expect(madeUpChart("singlet", "women").sizeRunId).toBe(MADE_UP_WOMEN_RUN.id);
  });

  it("refuses a sports bra chart that uses a run of the usual sizes", () => {
    const wrong = { ...madeUpChart("sports-bra", "women"), sizeRunId: MADE_UP_WOMEN_RUN.id, baseSize: "U2" };
    const built = buildChartSet(MADE_UP_RUNS, [wrong]);
    expect(built.ok).toBe(false);
    expect(built.ok ? "" : built.problems.join(" ")).toContain("Sports bra sizes");
    const choice = selectChart({ runs: MADE_UP_RUNS, charts: [wrong] }, specFor("sports-bra", "women"));
    expect(choice.kind).toBe("none");
    expect(choice.kind === "none" ? choice.message : "").toContain("Sports bra sizes");
  });

  it("reads a CSV row for a sports bra into the sports bra run, and a singlet into the usual run", () => {
    const header = "wearer,garment_type,fit,point_of_measure,base_size,base_value_cm,grade_cm,tolerance_cm,source";
    const bra = `women,sports-bra,,underbust,W2,30,2,1,"Test Person, 2000-01-01"`;
    const singlet = `women,singlet,,chest-width,U2,40,2,1,"Test Person, 2000-01-01"`;
    const parsed = parseChartsCsv([header, bra, singlet].join("\n"), MADE_UP_RUNS);
    expect(parsed.ok ? parsed.charts.map((chart) => [chart.garmentType, chart.sizeRunId]) : parsed.problems).toEqual([
      ["sports-bra", braRun?.id],
      ["singlet", MADE_UP_WOMEN_RUN.id],
    ]);
  });

  it("says which size system is missing when a CSV names a sports bra and there is no such run", () => {
    const header = "wearer,garment_type,fit,point_of_measure,base_size,base_value_cm,grade_cm,tolerance_cm,source";
    const bra = `women,sports-bra,,underbust,U2,30,2,1,"Test Person, 2000-01-01"`;
    const parsed = parseChartsCsv([header, bra].join("\n"), [MADE_UP_WOMEN_RUN]);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? "" : parsed.problems.map((problem) => problem.message).join(" ")).toContain("Sports bra sizes");
  });
});
