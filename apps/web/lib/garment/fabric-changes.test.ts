import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { fabricFor } from "./fabric";
import { accepted, fabric, rejected, start } from "./fixtures/specs";
import type { GarmentSpec } from "./spec";

const assign = (panelId: string, fabricId: string) => ({ type: "assign-fabric", panelId, fabricId });

function withThreeFabrics(): GarmentSpec {
  let spec = start("polo");
  for (const action of [
    { type: "add-fabric", fabric: fabric("mesh") },
    { type: "add-fabric", fabric: fabric("rib") },
    assign("sleeve-left", "rib"),
    assign("collar", "mesh"),
  ]) {
    spec = accepted(applyAction(spec, action)).spec;
  }
  return spec;
}

const fabricIdFor = (spec: GarmentSpec, panelId: string): string => fabricFor(spec, panelId).id;

describe("removing a fabric", () => {
  it("removes the first fabric, keeps the others, and reports every panel that changed", () => {
    const before = withThreeFabrics();
    const result = accepted(applyAction(before, { type: "remove-fabric", id: "main" }));
    expect(result.spec.fabrics.map((entry) => entry.id)).toEqual(["mesh", "rib"]);
    expect(fabricIdFor(result.spec, "sleeve-left")).toBe("rib");
    expect(fabricIdFor(result.spec, "collar")).toBe("mesh");
    expect(fabricIdFor(result.spec, "body-front")).toBe("mesh");
    const changed = result.dropped.filter((item) => item.kind === "fabric-change").map((item) => item.id);
    expect(changed).toEqual(["body-front", "body-back", "sleeve-right", "placket"]);
    expect(result.dropped.find((item) => item.id === "body-front")?.message).toBe(
      "Body front now uses Fabric mesh instead of Main fabric.",
    );
  });

  it("removes the middle fabric and reports the panel that used it", () => {
    const result = accepted(applyAction(withThreeFabrics(), { type: "remove-fabric", id: "mesh" }));
    expect(result.spec.fabrics.map((entry) => entry.id)).toEqual(["main", "rib"]);
    expect(fabricIdFor(result.spec, "sleeve-left")).toBe("rib");
    expect(fabricIdFor(result.spec, "collar")).toBe("main");
    expect(fabricIdFor(result.spec, "body-front")).toBe("main");
    expect(result.dropped).toEqual([
      {
        kind: "fabric-assignment",
        id: "collar",
        message: "Collar now uses Main fabric, because Fabric mesh was removed.",
      },
    ]);
  });

  it("removes the last of three fabrics without touching the others", () => {
    const result = accepted(applyAction(withThreeFabrics(), { type: "remove-fabric", id: "rib" }));
    expect(result.spec.fabrics.map((entry) => entry.id)).toEqual(["main", "mesh"]);
    expect(fabricIdFor(result.spec, "collar")).toBe("mesh");
    expect(result.dropped.map((item) => item.id)).toEqual(["sleeve-left"]);
  });

  it("keeps at least one fabric", () => {
    expect(rejected(applyAction(start("polo"), { type: "remove-fabric", id: "main" }))).toBe(
      "Keep at least one fabric.",
    );
  });
});

describe("structured reports", () => {
  it("names the kind, the id and a sentence for each thing that was dropped", () => {
    let spec = accepted(applyAction(start("team-jersey"), { type: "set-measurement", pointId: "shoulder-width", value: 4000, provenance: "user-edited" })).spec;
    spec = accepted(applyAction(spec, { type: "add-fabric", fabric: fabric("mesh") })).spec;
    spec = accepted(applyAction(spec, assign("neckband", "mesh"))).spec;
    const result = accepted(
      applyAction(spec, { type: "set-option", optionId: "sleeve-type", choiceId: "raglan", provenance: "user-edited" }),
    );
    expect(result.dropped).toEqual([
      { kind: "measurement", id: "shoulder-width", message: expect.stringMatching(/no shoulder seam/) },
    ]);
    const collar = accepted(
      applyAction(spec, { type: "set-option", optionId: "collar", choiceId: "band-collar", provenance: "user-edited" }),
    );
    expect(collar.dropped).toEqual([
      { kind: "fabric-assignment", id: "neckband", message: expect.stringMatching(/Neckband/) },
    ]);
  });
});
