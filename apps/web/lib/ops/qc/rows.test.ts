import { describe, expect, it } from "vitest";
import { latestInspection, toInspection } from "./rows";

const row = (over: Record<string, unknown> = {}) => ({
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12", factory_profile_id: "f1", result: "pass",
  checklist: [{ key: "colour", result: "pass" }], measurements: [{ point: "Chest", specMm: 520, measuredMm: 521, toleranceMm: 5 }],
  sample_size: 5, defect_count: 0, photo_file_ids: [], note: "", exception_id: null, at: "2026-10-26T10:00:00+00:00", ...over,
});

describe("toInspection", () => {
  it("reads a row and gives checklist notes a default", () => {
    const i = toInspection(row());
    expect(i).toMatchObject({ result: "pass", sampleSize: 5, factoryProfileId: "f1", at: "2026-10-26T10:00:00.000Z" });
    expect(i.checklist).toEqual([{ key: "colour", result: "pass", note: "" }]);
  });
  it("refuses a row of the wrong shape", () => {
    expect(() => toInspection(row({ result: "maybe" }))).toThrow();
  });
});

describe("latestInspection", () => {
  it("is the newest, and null for none", () => {
    const [a, b] = [toInspection(row({ at: "2026-10-26T10:00:00Z" })), toInspection(row({ id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a13", result: "fail", at: "2026-10-27T10:00:00Z" }))];
    expect(latestInspection([a, b])?.result).toBe("fail");
    expect(latestInspection([b, a])?.result).toBe("fail");
    expect(latestInspection([])).toBeNull();
  });
});
