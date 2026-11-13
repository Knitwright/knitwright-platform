import { describe, expect, it } from "vitest";
import { article, bareArticle } from "../view/fixtures/views";
import { checkFit } from "./fit";
import { isQcOnly, QC_FILLS } from "./qc-only";
import { toleranceText } from "./tolerance";

describe("Check fit", () => {
  it("reads JSY-SS-01's size run as in order, every point graded with a tolerance", () => {
    const report = checkFit(article());
    expect(report.attention).toBe(0);
    expect(report.lines).toHaveLength(article().poms.length);
    expect(report.summary).toContain("XS–3XL");
    expect(report.summary).toContain("sample size M");
  });

  it("flags a missing size, a shrinking linear point, a moving fixed point and a missing tolerance", () => {
    const base = article();
    const [first, second, ...rest] = base.poms;
    if (!first || !second) throw new Error("JSY-SS-01 has points");
    const broken = {
      ...base,
      poms: [
        { ...first, valuesMm: { ...first.valuesMm, M: 1 }, tolMinusMm: Number.NaN },
        { ...second, gradeType: "fixed" as const },
        ...rest,
      ],
    };
    const report = checkFit(broken, ["XS", "S", "M", "4XL"]);
    expect(report.attention).toBeGreaterThanOrEqual(2);
    expect(report.lines[0]?.detail).toContain("no value at 4XL");
    expect(report.lines[0]?.detail).toContain("does not grow");
    expect(report.lines[0]?.detail).toContain("ask the factory");
    expect(report.lines[1]?.detail).toContain("fixed");
    expect(report.summary).toContain("need attention");
  });

  it("says so when there is no article or no points", () => {
    expect(checkFit(null).summary).toContain("not on a base article");
    expect(checkFit(bareArticle()).summary).toContain("no points of measure");
    expect(checkFit({ ...article(), sizeRange: [] }, []).summary).toContain("no sizes");
  });
});

describe("🔒 rows and the tolerance column", () => {
  it("marks the sample size, the factory and the whole QC tab as Knitwright QC's", () => {
    expect(isQcOnly({ id: "sample-size" }, "overview")).toBe(true);
    expect(isQcOnly({ id: "factory" }, "overview")).toBe(true);
    expect(isQcOnly({ id: "qc-aql" }, "qc")).toBe(true);
    expect(isQcOnly({ id: "style-name" }, "overview")).toBe(false);
    expect(QC_FILLS).toContain("Knitwright QC");
  });

  it("reads one number for an even tolerance and both ends otherwise, never inventing one", () => {
    expect(toleranceText({ tolMinus: "-1.0", tolPlus: "+1.0" })).toBe("1.0");
    expect(toleranceText({ tolMinus: "-1.0", tolPlus: "+2.0" })).toBe("−1.0 / +2.0");
    expect(toleranceText({ tolMinus: null, tolPlus: "+2.0" })).toBe("−? / +2.0");
    expect(toleranceText({ tolMinus: "-2.0", tolPlus: null })).toBe("−2.0 / +?");
    expect(toleranceText({ tolMinus: null, tolPlus: null })).toBeNull();
  });
});
