import { describe, expect, it } from "vitest";
import { CHECKLIST_KEYS, evaluateInspection, withinTolerance, type ChecklistItem, type ChecklistResult, type Measurement } from "./checklist";

const items = (over: Partial<Record<(typeof CHECKLIST_KEYS)[number], ChecklistResult>> = {}): ChecklistItem[] =>
  CHECKLIST_KEYS.map((key) => ({ key, result: over[key] ?? "pass", note: "" }));
const chest: Measurement = { point: "Chest width", specMm: 520, measuredMm: 522, toleranceMm: 5 };

describe("withinTolerance", () => {
  it("allows the edge of the tolerance and nothing past it", () => {
    expect(withinTolerance({ ...chest, measuredMm: 525 })).toBe(true);
    expect(withinTolerance({ ...chest, measuredMm: 515 })).toBe(true);
    expect(withinTolerance({ ...chest, measuredMm: 525.001 })).toBe(false);
    expect(withinTolerance({ ...chest, measuredMm: 514.9 })).toBe(false);
  });

  it("is not fooled by floating point at the edge", () => {
    expect(withinTolerance({ point: "x", specMm: 520, measuredMm: 520.1, toleranceMm: 0.1 })).toBe(true);
  });
});

describe("evaluateInspection", () => {
  it("passes when every item passes, a measurement is inside its tolerance and no piece is defective", () => {
    expect(evaluateInspection({ checklist: items(), measurements: [chest], defectCount: 0 })).toEqual({ result: "pass", reasons: [] });
  });

  it.each(CHECKLIST_KEYS)("fails when %s fails", (key) => {
    const out = evaluateInspection({ checklist: items({ [key]: "fail" }), measurements: [chest], defectCount: 0 });
    expect(out.result).toBe("fail");
    expect(out.reasons).toHaveLength(1);
  });

  it.each(CHECKLIST_KEYS)("fails when %s was not inspected", (key) => {
    expect(evaluateInspection({ checklist: items({ [key]: "not_inspected" }), measurements: [chest], defectCount: 0 }).result).toBe("fail");
  });

  it("fails on a missing checklist item", () => {
    expect(evaluateInspection({ checklist: items().slice(1), measurements: [chest], defectCount: 0 }).result).toBe("fail");
  });

  it("fails with no measurement, even when the box says pass", () => {
    expect(evaluateInspection({ checklist: items(), measurements: [], defectCount: 0 }).reasons).toEqual(["No measurement was recorded."]);
  });

  it("fails when a measurement is outside its tolerance, even when the box says pass, and names it", () => {
    const out = evaluateInspection({ checklist: items(), measurements: [chest, { ...chest, point: "Length", measuredMm: 540 }], defectCount: 0 });
    expect(out.result).toBe("fail");
    expect(out.reasons).toEqual(["Length: measured 540 mm, spec 520 mm, tolerance 5 mm."]);
  });

  it("fails on any defective piece and says how many", () => {
    expect(evaluateInspection({ checklist: items(), measurements: [chest], defectCount: 1 }).reasons).toEqual(["1 defective piece in the sample."]);
    expect(evaluateInspection({ checklist: items(), measurements: [chest], defectCount: 3 }).reasons).toEqual(["3 defective pieces in the sample."]);
  });
});
