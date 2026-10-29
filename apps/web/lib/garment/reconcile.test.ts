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
  pointsOfMeasure: [{ id: "span", label: "Span", howToMeasure: "Lay flat.", group: "body", appliesWhen: [] }],
  panels: [
    { id: "wing-panel", label: "Wing panel", appliesWhen: [{ option: "wing", in: ["big"] }], anchors: [{ id: "tip", label: "Tip" }] },
  ],
  rules: [{ id: "no-big-wing", when: [{ option: "wing", in: ["big"] }], reason: "Wings are too big." }],
  seams: [],
  components: [],
  types: [
    { id: "test-wing", family: "tops", label: "Test wing", wearers: ["men"], options: [{ option: "wing" }], pointsOfMeasure: ["span"], panels: ["wing-panel"] },
  ],
};
const type = buildRegistry([family]).getType("test-wing");
if (!type) throw new Error("fixture type missing");

const spec: GarmentSpec = {
  schemaVersion: 7,
  typeId: "test-wing",
  wearer: "men",
  options: { wing: { choiceId: "none", provenance: "user-edited" } },
  sizing: null,
  measurements: [
    { pointId: "span", value: 1000, provenance: "user-edited" },
    { pointId: "gone", value: 1000, provenance: "user-edited" },
  ],
  fabrics: [
    { id: "main", name: "Main", composition: "", construction: "", weightGsm: null, finish: "", consumption: "", stretch: "not-set", provenance: "user-edited", sources: {} },
  ],
  panelFabrics: [{ panelId: "wing-panel", fabricId: "main" }],
  colourways: [{ id: "main", name: "Main", colours: [{ panelId: "wing-panel", colour: "red", provenance: "user-edited" }] }],
  artwork: [
    {
      id: "logo",
      name: "Logo",
      rotationDegrees: 0,
      provenance: "user-edited",
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
  components: [],
  construction: [],
  labelling: {},
};

describe("reconcile", () => {
  it("removes artwork, colours and measurements that no longer fit, and says so", () => {
    const result = reconcile(spec, type);
    expect(result.value.artwork).toEqual([]);
    expect(result.value.colourways[0]?.colours).toEqual([]);
    expect(result.value.measurements.map((entry) => entry.pointId)).toEqual(["span"]);
    expect(result.dropped).toEqual([
      { kind: "measurement", id: "gone", message: "The gone measurement was removed. Test wing does not have it." },
      {
        kind: "colour",
        id: "wing-panel",
        parentId: "main",
        message: "The colour for Wing panel was removed, because this garment no longer has that panel.",
      },
      {
        kind: "fabric-assignment",
        id: "wing-panel",
        message: "The fabric for Wing panel was removed, because this garment no longer has that panel.",
      },
      {
        kind: "artwork",
        id: "logo",
        message: 'Artwork "Logo" is on Wing panel, which this garment does not have. It was removed.',
      },
    ]);
    expect(result.value.panelFabrics).toEqual([]);
  });

  it("keeps everything that still fits and reports nothing", () => {
    const big = { ...spec, options: { wing: { choiceId: "big", provenance: "user-edited" as const } }, measurements: [spec.measurements[0]!] };
    const result = reconcile(big, type);
    expect(result.value).toEqual(big);
    expect(result.dropped).toEqual([]);
  });
});

describe("carryOptions", () => {
  const chose = (choiceId: string) => ({ choiceId, provenance: "ai-suggested" as const });

  it("keeps a choice with its provenance and removes options the type lacks", () => {
    const carried = carryOptions({ wing: chose("big"), spare: chose("x") }, type);
    expect(carried.value).toEqual({ wing: chose("big") });
    expect(carried.dropped).toEqual([
      { kind: "option", id: "spare", message: "The option spare was removed, because Test wing does not have it." },
    ]);
  });

  it("resets a choice that is not offered to the default, marked derived, naming it by its id if it has no label", () => {
    const odd = carryOptions({ wing: chose("huge") }, type);
    expect(odd.value).toEqual({ wing: { choiceId: "none", provenance: "derived" } });
    expect(odd.dropped[0]?.message).toBe("Wing was reset to No wing, because Test wing does not offer huge.");
  });
});

describe("repairClashes", () => {
  const chose = (choiceId: string) => ({ choiceId, provenance: "user-edited" as const });

  it("resets options named by a broken rule to the default, marked derived", () => {
    const repaired = repairClashes({ wing: chose("big") }, type);
    expect(repaired.value).toEqual({ wing: { choiceId: "none", provenance: "derived" } });
    expect(repaired.dropped).toEqual([
      { kind: "option", id: "wing", message: "Wing was reset to No wing. Wings are too big." },
    ]);
  });

  it("does nothing when no rule is broken", () => {
    const options = { wing: chose("none") };
    expect(repairClashes(options, type)).toEqual({ value: options, dropped: [] });
  });
});
