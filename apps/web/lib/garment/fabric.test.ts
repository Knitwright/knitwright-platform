import { describe, expect, it } from "vitest";
import { fabricFor } from "./fabric";
import { createSpec, type GarmentSpec } from "./spec";

function start(): GarmentSpec {
  const result = createSpec("crew-tee", "men");
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
}

describe("fabricFor", () => {
  const first = start().fabrics[0]!;
  const mesh = { ...first, id: "mesh", name: "Mesh" };
  const spec: GarmentSpec = {
    ...start(),
    fabrics: [first, mesh],
    panelFabrics: [{ panelId: "sleeve-left", fabricId: "mesh" }],
  };

  it("gives a panel with no entry the first fabric", () => {
    expect(fabricFor(spec, "body-front")).toBe(first);
  });

  it("gives a panel the fabric it is assigned", () => {
    expect(fabricFor(spec, "sleeve-left")).toBe(mesh);
  });

  it("falls back to the first fabric when the assigned fabric is missing", () => {
    const broken = { ...spec, panelFabrics: [{ panelId: "sleeve-left", fabricId: "gone" }] };
    expect(fabricFor(broken, "sleeve-left")).toBe(first);
  });
});
