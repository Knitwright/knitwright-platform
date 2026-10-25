import { describe, expect, it } from "vitest";
import { inspectionFormSchema } from "./schemas";

const form = {
  orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  measurementsResult: "pass", colourResult: "pass", artworkResult: "pass", namesNumbersResult: "pass",
  measurements: "Chest width, 520, 522, 5",
  sampleSize: "5", defectCount: "0", photos: "", note: "",
};

describe("inspectionFormSchema", () => {
  it("reads a passing inspection and asks for nothing about a remake", () => {
    const out = inspectionFormSchema.parse(form);
    expect(out).toMatchObject({ sampleSize: 5, defectCount: 0, remake: null });
    expect(out.checklist.map((c) => c.key)).toEqual(["measurements", "colour", "artwork", "names_numbers"]);
    expect(out.measurements).toEqual([{ point: "Chest width", specMm: 520, measuredMm: 522, toleranceMm: 5 }]);
  });

  it("needs the pieces to make again, an owner and a due date when an item fails", () => {
    const failing = { ...form, artworkResult: "fail" };
    const issue = (over: Record<string, string>) => inspectionFormSchema.safeParse({ ...failing, ...over }).error?.issues[0];
    expect(issue({})?.path).toEqual(["remakeSizes"]);
    expect(issue({ remakeSizes: "M 2" })?.path).toEqual(["remakeOwner"]);
    expect(issue({ remakeSizes: "M 2", remakeOwner: "Sam" })?.path).toEqual(["remakeDueOn"]);
    expect(inspectionFormSchema.parse({ ...failing, remakeSizes: "M 2", remakeOwner: "Sam", remakeDueOn: "2026-11-05" }).remake).toEqual({ sizes: { M: 2 }, owner: "Sam", dueOn: "2026-11-05" });
  });

  it("is a fail when a measurement is out of tolerance even though every box says pass", () => {
    const out = inspectionFormSchema.safeParse({ ...form, measurements: "Chest width, 520, 540, 5" });
    expect(out.error?.issues[0]?.path).toEqual(["remakeSizes"]);
  });

  it("is a fail with no measurement or with a defective piece", () => {
    expect(inspectionFormSchema.safeParse({ ...form, measurements: "" }).success).toBe(false);
    expect(inspectionFormSchema.safeParse({ ...form, defectCount: "1" }).success).toBe(false);
  });

  it("refuses more defects than pieces inspected, unreadable measurements and bad photo ids", () => {
    expect(inspectionFormSchema.safeParse({ ...form, defectCount: "9" }).error?.issues[0]?.message).toMatch(/More defective/);
    expect(inspectionFormSchema.safeParse({ ...form, measurements: "Chest" }).error?.issues[0]?.path).toEqual(["measurements"]);
    expect(inspectionFormSchema.safeParse({ ...form, photos: "nope" }).error?.issues[0]?.path).toEqual(["photos"]);
  });

  it("refuses a sample of zero and an unknown answer", () => {
    expect(inspectionFormSchema.safeParse({ ...form, sampleSize: "0" }).success).toBe(false);
    expect(inspectionFormSchema.safeParse({ ...form, colourResult: "maybe" }).success).toBe(false);
  });

  it("keeps photo file ids, once each", () => {
    const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a22";
    expect(inspectionFormSchema.parse({ ...form, photos: `${id} ${id}` }).photoFileIds).toEqual([id]);
  });
});
