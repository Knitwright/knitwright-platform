import { describe, expect, it } from "vitest";
import { TEE_GRADED } from "./fixtures/patterns";
import { buildPanelLayout } from "./layout";
import { generatePlaceholder, type GltfModel } from "./placeholder";
import { readAccessor } from "./accessors";
import { validateModel } from "./validate";

const layout = buildPanelLayout(TEE_GRADED, "48");
const good = generatePlaceholder(layout);

/** A copy of the model whose UV data for one panel is changed by `change`. */
function withUvs(model: GltfModel, panelId: string, change: (uvs: number[]) => number[]): GltfModel {
  const node = model.nodes.find((n) => n.name === panelId);
  const prim = model.meshes[node?.mesh ?? -1]?.primitives[0];
  const accessor = model.accessors[prim?.attributes.TEXCOORD_0 ?? -1];
  const view = model.bufferViews[accessor?.bufferView ?? -1];
  const next = change([...readAccessor(model, prim?.attributes.TEXCOORD_0 ?? -1).values]);
  const bytes = new Uint8Array(new Float32Array(next).buffer);
  const raw = Uint8Array.from(atob(model.buffers[0]?.uri.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  raw.set(bytes, view?.byteOffset ?? 0);
  let text = "";
  for (const b of raw) text += String.fromCharCode(b);
  return { ...model, buffers: [{ ...model.buffers[0]!, uri: `data:application/octet-stream;base64,${btoa(text)}` }] };
}

describe("validateModel", () => {
  it("passes a model whose islands are the layout, with every error near zero", () => {
    const report = validateModel(good, layout);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.panels).toHaveLength(5);
    for (const p of report.panels) {
      expect(p.found).toBe(true);
      expect(p.errorPx).toBeLessThan(0.01);
      expect(p.ok).toBe(true);
    }
  });

  it("fails a panel whose island is shifted, and says which one and by how much", () => {
    const shifted = withUvs(good, "front", (uvs) => uvs.map((v, i) => (i % 2 === 0 ? v + 0.01 : v)));
    const report = validateModel(shifted, layout);
    expect(report.ok).toBe(false);
    const front = report.panels.find((p) => p.panelId === "front");
    expect(front?.ok).toBe(false);
    expect(front?.errorPx).toBeCloseTo(0.01 * 2048, 1);
    expect(report.panels.filter((p) => !p.ok).map((p) => p.panelId)).toEqual(["front"]);
    expect(report.issues.join(" ")).toMatch(/front/);
  });

  it("fails a panel whose island is scaled, even if its corner is right", () => {
    const scaled = withUvs(good, "back", (uvs) => {
      const us = uvs.filter((_, i) => i % 2 === 0);
      const u0 = Math.min(...us);
      return uvs.map((v, i) => (i % 2 === 0 ? u0 + (v - u0) * 0.9 : v));
    });
    expect(validateModel(scaled, layout).panels.find((p) => p.panelId === "back")?.ok).toBe(false);
  });

  it("accepts a wider tolerance and refuses a tighter one", () => {
    const off = withUvs(good, "collar", (uvs) => uvs.map((v, i) => (i % 2 === 0 ? v + 0.0005 : v)));
    expect(validateModel(off, layout).ok).toBe(false);
    expect(validateModel(off, layout, { tolerancePx: 2 }).ok).toBe(true);
  });

  it("fails a UV outside the picture", () => {
    const out = withUvs(good, "front", (uvs) => uvs.map((v, i) => (i === 0 ? -0.5 : v)));
    expect(validateModel(out, layout).ok).toBe(false);
  });

  it("fails a missing panel and reports a node that is not a panel", () => {
    const missing = { ...good, nodes: good.nodes.filter((n) => n.name !== "collar") };
    const report = validateModel(missing, layout);
    expect(report.ok).toBe(false);
    expect(report.panels.find((p) => p.panelId === "collar")).toMatchObject({ found: false, ok: false });
    const extra = { ...good, nodes: [...good.nodes, { name: "pocket", mesh: 0 }] };
    expect(validateModel(extra, layout).issues.join(" ")).toMatch(/pocket/);
  });

  it("fails a model with a wrong texture size or with materials not shared by group", () => {
    const small = { ...good, asset: { ...good.asset, extras: { knitwright: { ...good.asset.extras!.knitwright, textureSize: 1024 } } } };
    expect(validateModel(small, layout).issues.join(" ")).toMatch(/2048/);
    const prim = good.meshes[0]!.primitives[0]!;
    const other = { ...good, meshes: good.meshes.map((m, i) => (i === 0 ? { ...m, primitives: [{ ...prim, material: 2 }] } : m)) };
    expect(validateModel(other, layout).issues.join(" ")).toMatch(/material/);
  });

  it("fails a panel whose mesh is not centred on the node origin", () => {
    const moved = withPositions(good, "sleeve-left", 0.2);
    const report = validateModel(moved, layout);
    expect(report.panels.find((p) => p.panelId === "sleeve-left")?.originErrorMm).toBeGreaterThan(100);
    expect(report.ok).toBe(false);
  });

  it("fails a panel whose node has no mesh, and a model with no named nodes or no texture size", () => {
    const noMesh = { ...good, nodes: good.nodes.map((n) => (n.name === "back" ? { name: "back" } : n)) };
    expect(validateModel(noMesh, layout).panels.find((p) => p.panelId === "back")).toMatchObject({ found: true, ok: false, reason: "Panel back has no mesh." });
    const bare = { ...good, nodes: [{ mesh: 0 }], asset: { version: "2.0" } };
    const report = validateModel(bare, layout);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/states none/);
  });

  it("fails a panel with no material, and two groups sharing one", () => {
    const prim = good.meshes[0]!.primitives[0]!;
    const bare = { attributes: prim.attributes, indices: prim.indices };
    const none = { ...good, meshes: good.meshes.map((m, i) => (i === 0 ? { ...m, primitives: [bare] } : m)) };
    expect(validateModel(none, layout).issues.join(" ")).toMatch(/share one material/);
    const same = { ...good, meshes: good.meshes.map((m, i) => (i === 4 ? { ...m, primitives: [{ ...prim, material: 0 }] } : m)) };
    expect(validateModel(same, layout).issues.join(" ")).toMatch(/each panel group has its own material/);
  });

  it("names a non-Error failure plainly", () => {
    const odd = { ...good, accessors: [] };
    expect(validateModel(odd, layout).ok).toBe(false);
  });

  it("says so when a buffer cannot be read", () => {
    const broken = { ...good, buffers: [{ byteLength: 1, uri: "model.bin" }] };
    const report = validateModel(broken, layout);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/buffer/i);
    expect(validateModel(broken, layout, { buffers: [new Uint8Array(good.buffers[0]!.byteLength)] }).issues.join(" ")).not.toMatch(/cannot read/i);
  });
});

function withPositions(model: GltfModel, panelId: string, dx: number): GltfModel {
  const node = model.nodes.find((n) => n.name === panelId);
  const prim = model.meshes[node?.mesh ?? -1]?.primitives[0];
  const accessor = model.accessors[prim?.attributes.POSITION ?? -1];
  const view = model.bufferViews[accessor?.bufferView ?? -1];
  const next = readAccessor(model, prim?.attributes.POSITION ?? -1).values.map((v, i) => (i % 3 === 0 ? v + dx : v));
  const raw = Uint8Array.from(atob(model.buffers[0]?.uri.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  raw.set(new Uint8Array(new Float32Array(next).buffer), view?.byteOffset ?? 0);
  let text = "";
  for (const b of raw) text += String.fromCharCode(b);
  return { ...model, buffers: [{ ...model.buffers[0]!, uri: `data:application/octet-stream;base64,${btoa(text)}` }] };
}
