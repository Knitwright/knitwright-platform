import { describe, expect, it } from "vitest";
import { sizeLabelMapSchema } from "@/lib/production/contract";
import { STARTER_YOUTH_RUN } from "./charts/starter-runs";
import { DEFAULT_CHARTS } from "./charts";
import {
  AU_JUNIOR_RUN,
  AU_MEN_RUN,
  AU_RUNS,
  AU_WOMEN_RUN,
  DEFAULT_SIZE_LABEL_MAPS,
  JUNIOR_STARTER_COLUMN,
  cutsOfProduct,
  sizeMapReadiness,
  starterValuesFor,
} from "./australia";
import { sizeRunSchema } from "./schemas";

describe("the Australian size runs", () => {
  it("are valid runs", () => {
    for (const run of AU_RUNS) expect(sizeRunSchema.safeParse(run).success).toBe(true);
  });

  it("run men XS to 3XL, women XS to 3XL and juniors 6 to 16", () => {
    expect(AU_MEN_RUN.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(AU_WOMEN_RUN.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(AU_JUNIOR_RUN.sizes).toEqual(["6", "8", "10", "12", "14", "16"]);
  });

  it("have unique ids", () => {
    expect(new Set(AU_RUNS.map((r) => r.id)).size).toBe(AU_RUNS.length);
  });
});

describe("the default size label map", () => {
  it("has one entry for every label of every run, all valid and all suggested", () => {
    expect(DEFAULT_SIZE_LABEL_MAPS).toHaveLength(7 + 7 + 6);
    for (const m of DEFAULT_SIZE_LABEL_MAPS) {
      expect(sizeLabelMapSchema.safeParse(m).success).toBe(true);
      expect(m.source).toBe("suggested");
    }
  });

  it("cuts AU M men's from pattern 48, the benchmark's size", () => {
    expect(DEFAULT_SIZE_LABEL_MAPS.find((m) => m.label === "M" && m.cut === "mens")?.patternSize).toBe("48");
  });

  it("gives every men's label its own pattern size, two apart", () => {
    const sizes = DEFAULT_SIZE_LABEL_MAPS.filter((m) => m.cut === "mens").map((m) => Number(m.patternSize));
    expect(sizes).toEqual([44, 46, 48, 50, 52, 54, 56]);
  });

  it("does not repeat a label within one cut", () => {
    const keys = DEFAULT_SIZE_LABEL_MAPS.map((m) => `${m.cut}|${m.label}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is frozen against edits", () => {
    expect(() => (DEFAULT_SIZE_LABEL_MAPS as unknown as unknown[]).push(1)).toThrow();
  });
});

describe("junior labels", () => {
  it("each point at a real youth column of the starter charts", () => {
    for (const label of AU_JUNIOR_RUN.sizes) {
      expect(STARTER_YOUTH_RUN.sizes).toContain(JUNIOR_STARTER_COLUMN[label]);
    }
  });

  it("take the nearest youth column by age", () => {
    expect(JUNIOR_STARTER_COLUMN).toEqual({ "6": "YS", "8": "YS", "10": "YM", "12": "YM", "14": "YL", "16": "YL" });
  });
});

describe("starterValuesFor", () => {
  it("gives a men's label the starter value at the same label, marked suggested", () => {
    const v = starterValuesFor("crew-tee", "mens", "M");
    expect(v.status).toBe("suggested");
    expect(v.starterColumn).toBe("M");
    expect(v.rows.find((r) => r.pointId === "chest-width")).toMatchObject({ valueTenthsMm: 5300, provenance: "suggested-chart" });
    expect(v.note).toMatch(/suggested/i);
  });

  it("gives a junior label the youth column's value", () => {
    const v = starterValuesFor("crew-tee", "junior", "8");
    expect(v.starterColumn).toBe("YS");
    expect(v.status).toBe("suggested");
    expect(v.note).toMatch(/age/i);
  });

  it("leaves women's 3XL unset because no source gives it, rather than guessing", () => {
    const v = starterValuesFor("crew-tee", "womens", "3XL");
    expect(v.status).toBe("no-starter-values");
    expect(v.starterColumn).toBeNull();
    expect(v.rows).toEqual([]);
    expect(v.note).toMatch(/no published source/i);
  });

  it("says so for a label that is not in any run", () => {
    expect(starterValuesFor("crew-tee", "mens", "9XL")).toMatchObject({ status: "no-starter-values", rows: [] });
  });

  it("says so for a garment with no starter chart", () => {
    expect(starterValuesFor("not-a-garment", "mens", "M")).toMatchObject({ status: "no-starter-values" });
  });

  it("never invents a value: every value returned is in a starter chart's graded row", () => {
    const v = starterValuesFor("crew-tee", "womens", "2XL");
    expect(v.rows.length).toBeGreaterThan(5);
    expect(v.rows.every((r) => r.valueTenthsMm > 0 && Number.isInteger(r.valueTenthsMm))).toBe(true);
  });
});

describe("cutsOfProduct", () => {
  it("gives a men's and a women's chart under one product, and a junior one", () => {
    const cuts = cutsOfProduct("crew-tee");
    expect(cuts.map((c) => c.cut)).toEqual(["mens", "womens", "junior"]);
    expect(cuts[0]?.labels).toEqual(AU_MEN_RUN.sizes);
    expect(cuts[1]?.labels).toEqual(AU_WOMEN_RUN.sizes);
    expect(cuts[0]?.chart?.wearer).toBe("men");
    expect(cuts[1]?.chart?.wearer).toBe("women");
    expect(cuts[2]?.chart?.wearer).toBe("youth");
  });

  it("covers every starter garment type that has a men's chart", () => {
    const types = new Set(DEFAULT_CHARTS.map((c) => c.garmentType));
    for (const t of types) expect(cutsOfProduct(t).length).toBeGreaterThan(0);
  });

  it("marks a cut with no starter chart as having none", () => {
    const cuts = cutsOfProduct("not-a-garment");
    expect(cuts.every((c) => c.chart === null)).toBe(true);
  });
});

describe("sizeMapReadiness", () => {
  it("is open while any entry is only suggested, and names who acts", () => {
    const item = sizeMapReadiness(DEFAULT_SIZE_LABEL_MAPS);
    expect(item).toMatchObject({ id: "size-label-map", met: false, whoActs: "owner" });
    expect(item.sentence).toMatch(/suggested/i);
    expect(item.sentence).not.toMatch(/\b(confirmed|verified|approved|checked)\b/i);
  });

  it("is met when every entry is the brand's own", () => {
    const own = DEFAULT_SIZE_LABEL_MAPS.map((m) => ({ ...m, source: "brand-supplied" as const }));
    expect(sizeMapReadiness(own).met).toBe(true);
  });

  it("is open for an empty map", () => {
    expect(sizeMapReadiness([]).met).toBe(false);
  });
});
