import { describe, expect, it } from "vitest";
import type { FabricTest } from "./profile";
import { EMPTY_PROFILE } from "./profile";
import type { StoredFabric } from "./rows";
import { profileFromSheet } from "./sheet";
import { FABRIC_SOURCE_LABELS, fabricView } from "./view";

const fabric = (over: Partial<StoredFabric> = {}): StoredFabric => ({
  id: "f1",
  name: "Interlock",
  composition: "100 % polyester",
  construction: "Interlock",
  notes: "",
  sheet: EMPTY_PROFILE,
  tests: [],
  createdAt: "2026-10-01T00:00:00Z",
  ...over,
});
const test = (over: Partial<FabricTest>): FabricTest => ({
  id: "t1", fabricId: "f1", testedBy: "Priya Nair", testedOn: "2026-10-01", method: "Pressed.", loadNewtons: null,
  stretchLengthPct: null, stretchWidthPct: null, recoveryPct: null, shrinkLengthPct: null, shrinkWidthPct: null,
  pressTempC: null, pressSeconds: null, reductionPct: null, photoFileIds: [], createdAt: "2026-10-01T00:00:00Z", ...over,
});

describe("fabricView", () => {
  it("shows every value as not set for an untested fabric, and says the artwork is not scaled", () => {
    const v = fabricView(fabric());
    expect(v.values.every((r) => r.value === "Not set" && r.source === "Not set")).toBe(true);
    expect(v.printScale).toMatch(/^Not scaled for shrink/);
    expect(v.detail).toBe("100 % polyester, Interlock");
    expect(v.testCount).toBe(0);
  });

  it("shows tested values with their source and the day of the test", () => {
    const v = fabricView(fabric({ tests: [test({ shrinkLengthPct: 2, shrinkWidthPct: 1.5, pressTempC: 200, pressSeconds: 40, photoFileIds: ["p"] })] }));
    const row = v.values.find((r) => r.id === "shrinkLengthPct");
    expect(row).toMatchObject({ value: "2%", source: "From a fabric test", testedOn: "2026-10-01" });
    expect(v.printScale).toMatch(/1\.0204/);
    expect(v.tests[0]).toMatchObject({ photos: 1 });
    expect(v.tests[0]?.line).toMatch(/shrink 2 \/ 1.5 % after 40 s at 200 °C/);
  });

  it("shows the width in centimetres from the supplier's sheet", () => {
    const v = fabricView(fabric({ sheet: profileFromSheet({ usableWidthMm: 1600, gsm: 140 }) }));
    expect(v.values.find((r) => r.id === "usableWidthMm")).toMatchObject({ value: "160 cm", source: "From the supplier's sheet", testedOn: null });
    expect(v.values.find((r) => r.id === "gsm")?.value).toBe("140 gsm");
  });

  it("describes stretch, recovery and reduction in a test line, newest test first", () => {
    const v = fabricView(fabric({ tests: [test({ id: "a", testedOn: "2026-01-01", stretchWidthPct: 20, loadNewtons: 10, recoveryPct: 95, reductionPct: 3 }), test({ id: "b", testedOn: "2026-05-01", shrinkWidthPct: 1, pressTempC: 190, pressSeconds: 30 })] }));
    expect(v.tests.map((t) => t.id)).toEqual(["b", "a"]);
    expect(v.tests[1]?.line).toMatch(/stretch - \/ 20 % at 10 N; recovery 95 %; stretch reduction 3 %/);
  });

  it("never uses the words that read as settled", () => {
    const all = Object.values(FABRIC_SOURCE_LABELS).join(" ");
    expect(all).not.toMatch(/\b(checked|verified|approved|confirmed|final|passed|validated|certified)\b/i);
  });
});
