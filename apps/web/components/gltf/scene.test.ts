import { describe, expect, it } from "vitest";
import { MeshStandardMaterial, Mesh } from "three";
import { TEE_GRADED } from "@/lib/gltf/fixtures/patterns";
import { buildPanelLayout, generatePlaceholder } from "@/lib/gltf";
import { boxOf, buildModelScene, parseModel } from "./scene";

/** A render smoke test: builds the scene from the placeholder with no graphics card and no browser. */
// three.js builds a ProgressEvent when a load fails; node has none.
globalThis.ProgressEvent ??= class ProgressEvent extends Event {} as typeof globalThis.ProgressEvent;

describe("the glTF scene", () => {
  const layout = buildPanelLayout(TEE_GRADED, "48");

  it("loads the placeholder into one mesh per panel with one material per group", async () => {
    const root = await parseModel(generatePlaceholder(layout));
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    expect(meshes.map((m) => m.name)).toEqual(["front", "back", "sleeve-left", "sleeve-right", "collar"]);
    expect(meshes).toHaveLength(5);
    const { scene, materials, texture } = buildModelScene(root, null);
    expect(materials).toHaveLength(3);
    expect(texture).toBeNull();
    expect(scene.children.length).toBeGreaterThanOrEqual(3);
  });

  it("puts one picture on every material and keeps glTF's top-down texture coordinates", async () => {
    const root = await parseModel(generatePlaceholder(layout));
    const fake = { width: 2048, height: 2048 } as unknown as HTMLCanvasElement;
    const { materials, texture } = buildModelScene(root, fake);
    expect(texture?.flipY).toBe(false);
    for (const m of materials) expect(m instanceof MeshStandardMaterial && m.map === texture).toBe(true);
  });

  it("measures a box that holds every panel", async () => {
    const box = boxOf(await parseModel(generatePlaceholder(layout)));
    expect(box.size.every((v) => v > 0)).toBe(true);
    expect(box.size[0]).toBeGreaterThan(0.8);
  });
});
