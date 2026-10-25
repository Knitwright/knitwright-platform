import { describe, expect, it } from "vitest";
import { JERSEY_GRADED, TEE_GRADED } from "./fixtures/patterns";
import { buildPanelLayout } from "./layout";
import { PLACEHOLDER_LABEL, generatePlaceholder } from "./placeholder";
import { readAccessor } from "./accessors";
import { validateModel } from "./validate";

describe("generatePlaceholder", () => {
  const layout = buildPanelLayout(TEE_GRADED, "48");
  const model = generatePlaceholder(layout);

  it("says plainly that it is not an artist model", () => {
    expect(PLACEHOLDER_LABEL).toBe("placeholder, not an artist model");
    expect(model.asset.extras?.knitwright.label).toBe(PLACEHOLDER_LABEL);
    expect(model.asset.extras?.knitwright.placeholder).toBe(true);
  });

  it("is a glTF 2.0 file with a node and a mesh for each panel", () => {
    expect(model.asset.version).toBe("2.0");
    expect(model.nodes.map((n) => n.name)).toEqual(layout.panels.map((p) => p.id));
    expect(model.meshes).toHaveLength(layout.panels.length);
  });

  it("has one material for each panel group", () => {
    expect(model.materials.map((m) => m.name)).toEqual(["material-body", "material-sleeve", "material-collar"]);
  });

  it("states its units and texture size", () => {
    expect(model.asset.extras?.knitwright).toMatchObject({ units: "glTF positions in metres; panel layout in millimetres", textureSize: 2048 });
  });

  it("passes its own validation, for a tee and a jersey", () => {
    expect(validateModel(model, layout).ok).toBe(true);
    const jersey = buildPanelLayout(JERSEY_GRADED, "3XL");
    expect(validateModel(generatePlaceholder(jersey), jersey).ok).toBe(true);
  });

  it("is deterministic and carries no date", () => {
    expect(JSON.stringify(generatePlaceholder(layout))).toBe(JSON.stringify(model));
    expect(JSON.stringify(model)).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it("builds triangles that index real vertices and stand 4 mm thick", () => {
    for (const mesh of model.meshes) {
      const prim = mesh.primitives[0];
      const pos = readAccessor(model, prim?.attributes.POSITION ?? -1);
      const idx = readAccessor(model, prim?.indices ?? -1);
      expect(idx.values.length % 3).toBe(0);
      expect(Math.max(...idx.values)).toBeLessThan(pos.values.length / 3);
      const zs = pos.values.filter((_, i) => i % 3 === 2);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(0.004, 6);
    }
  });
});
