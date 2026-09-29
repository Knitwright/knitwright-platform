import { describe, expect, it } from "vitest";
import type { FamilyData } from "./definitions";
import { carryOptions, reconcile, repairClashes } from "./reconcile";
import { buildRegistry } from "./registry";
import type { GarmentSpec } from "./spec";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";

/** A made up family where a panel with anchors can disappear, which no real tops type allows. */
const family: FamilyData = {
  id: "tops",
  label: "Test tops",
  options: [
    {
      id: "wing",
      label: "Wing",
      choices: [
        { id: "none", label: "No wing" },
        { id: "big", label: "Big wing" },
      ],
      defaultChoice: "none",
    },
  ],
  pointsOfMeasure: [{ id: "span", label: "Span", howToMeasure: "Lay flat.", appliesWhen: [] }],
  panels: [
    { id: "wing-panel", label: "Wing panel", appliesWhen: [{ option: "wing", in: ["big"] }], anchors: [{ id: "tip", label: "Tip" }] },
  ],
  rules: [{ id: "no-big-wing", when: [{ option: "wing", in: ["big"] }], reason: "Wings are too big." }],
  types: [
    { id: "test-wing", family: "tops", label: "Test wing", wearers: ["men"], options: [{ option: "wing" }], pointsOfMeasure: ["span"], panels: ["wing-panel"] },
  ],
};
const type = buildRegistry([family]).getType("test-wing");
if (!type) throw new Error("fixture type missing");

const spec: GarmentSpec = {
  schemaVersion: 2,
  typeId: "test-wing",
  wearer: "men",
  options: { wing: "none" },
  measurements: [
    { pointId: "span", value: 1000, provenance: "user-edited" },
    { pointId: "gone", value: 1000, provenance: "user-edited" },
  ],
  fabrics: [
    { id: "main", name: "Main", composition: "", construction: "", weightGsm: null, finish: "", stretch: "not-set", provenance: "user-edited" },
  ],
  panelFabrics: [{ panelId: "wing-panel", fabricId: "main" }],
  colourways: [{ id: "main", name: "Main", colours: [{ panelId: "wing-panel", colour: "red" }] }],
  artwork: [
    {
      id: "logo",
      source: { kind: "file", fileId: FILE_ID },
      panelId: "wing-panel",
      anchor: "tip",
      offsetX: 0,
      offsetY: 0,
      width: 100,
      height: 100,
      technique: "transfer",
    },
  ],
};

describe("reconcile", () => {
  it("removes artwork, colours and measurements that no longer fit, and says so", () => {
    const result = reconcile(spec, type);
    expect(result.value.artwork).toEqual([]);
    expect(result.value.colourways[0]?.colours).toEqual([]);
    expect(result.value.measurements.map((entry) => entry.pointId)).toEqual(["span"]);
    expect(result.dropped).toEqual([
      "The gone measurement was removed. Test wing does not have it.",
      "The colour for wing-panel was removed from Main, because this garment no longer has that panel.",
      "The fabric for wing-panel was removed, because this garment no longer has that panel.",
      "Artwork logo is on wing-panel, which this garment does not have. It was removed.",
    ]);
    expect(result.value.panelFabrics).toEqual([]);
  });

  it("keeps everything that still fits and reports nothing", () => {
    const big = { ...spec, options: { wing: "big" }, measurements: [spec.measurements[0]!] };
    const result = reconcile(big, type);
    expect(result.value).toEqual(big);
    expect(result.dropped).toEqual([]);
  });
});

describe("carryOptions", () => {
  it("names choices in the report, and falls back to the id when it has no label", () => {
    const carried = carryOptions({ wing: "big", spare: "x" }, type);
    expect(carried.value).toEqual({ wing: "big" });
    expect(carried.dropped).toEqual(["The option spare was removed, because Test wing does not have it."]);
    const odd = carryOptions({ wing: "huge" }, type);
    expect(odd.value).toEqual({ wing: "none" });
    expect(odd.dropped[0]).toBe("Wing was reset to No wing, because Test wing does not offer huge.");
  });
});

describe("repairClashes", () => {
  it("resets options named by a broken rule, and leaves others alone", () => {
    const repaired = repairClashes({ wing: "big" }, type);
    expect(repaired.value).toEqual({ wing: "none" });
    expect(repaired.dropped).toEqual(["Wing was reset to No wing. Wings are too big."]);
  });

  it("does nothing when no rule is broken", () => {
    const repaired = repairClashes({ wing: "none" }, type);
    expect(repaired).toEqual({ value: { wing: "none" }, dropped: [] });
  });
});
