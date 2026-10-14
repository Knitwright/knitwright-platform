import { describe, expect, it } from "vitest";
import { applyAll } from "../geometry/affine";
import { growRing, intersectRings } from "../geometry/clip";
import { areaOf, boundsOf } from "../geometry/polygon";
import { assetReader, crestAsset, testCardPng } from "../fixtures/assets";
import { NO_RULES, SETTINGS, rig } from "../fixtures/setup";
import { polkaStack } from "../fixtures/stacks";
import type { FillItem, ImageItem } from "../scene";

const r = rig();
const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;

const crestLayer = (extra: Record<string, unknown> = {}) => ({
  ...common,
  id: "crest",
  kind: "graphic",
  views: ["front"],
  source: { kind: "asset", assetId: "crest" },
  placement: { kind: "zone", zoneId: "crest" },
  offsetMm: { x: 0, y: 0 },
  widthMm: 60,
  rotationDeg: 0,
  clearSpaceMm: 10,
  knockOut: true,
  ...extra,
});

describe("placed vector logo", () => {
  it("keeps its width in every size, stays vector, and clears the pattern round it", async () => {
    const stack = polkaStack([crestLayer({ widthMm: 55 })]);
    for (const size of r.pattern.sizes) {
      const { scene, marks } = await r.scene(stack, size, "front", { assets: assetReader([crestAsset()]) });
      const logo = scene.items.filter((i): i is FillItem => i.kind === "fill" && i.layerId === "crest");
      expect(logo.length).toBe(2);
      const box = boundsOf(logo[0]!.rings.flat());
      expect([box.maxX - box.minX, box.maxY - box.minY].sort((a, b) => a - b).map((v) => Math.round(v * 10) / 10)).toEqual([55, 66]);
      expect(scene.items.some((i) => i.kind === "image" && i.layerId === "crest")).toBe(false);
      expect(marks.find((m) => m.layerId === "crest")?.inZone, size).toBe(true);
    }
  });

  it("knocks the dots out of its clear space", async () => {
    const stack = polkaStack([crestLayer({ widthMm: 70 })]);
    const { scene } = await r.scene(stack, "48", "front", { assets: assetReader([crestAsset()]) });
    const logo = scene.items.find((i): i is FillItem => i.kind === "fill" && i.layerId === "crest")!;
    const grown = growRing(logo.rings[0]!, 10, "miter");
    const dots = scene.items.filter((i): i is FillItem => i.kind === "fill" && i.layerId === "dots");
    expect(dots.length).toBeGreaterThan(50);
    const inside = dots.flatMap((d) => intersectRings(d.rings, [grown])).reduce((sum, ring) => sum + areaOf(ring), 0);
    expect(inside).toBeLessThan(0.5);
  });

  it("is left off with a sentence when the asset is missing, and a bad vector file is refused", async () => {
    const stack = polkaStack([crestLayer()]);
    const missing = await r.scene(stack, "48", "front");
    expect(missing.scene.issues.some((i) => i.severity === "stop" && /not available/.test(i.text))).toBe(true);
    const bad = { ...crestAsset(), print: new TextEncoder().encode("{}") };
    const refused = await r.scene(stack, "48", "front", { assets: assetReader([bad]) });
    expect(refused.scene.issues.some((i) => /could not be read as vector/.test(i.text))).toBe(true);
  });

  it("reports a mark placed on a free anchor as outside the standard places", async () => {
    const stack = polkaStack([crestLayer({ placement: { kind: "anchor", anchorId: "hps" }, knockOut: false })]);
    const { scene, marks } = await r.scene(stack, "48", "front", { assets: assetReader([crestAsset()]) });
    expect(marks.find((m) => m.layerId === "crest")?.zoneId).toBeNull();
    expect(scene.issues.some((i) => /outside the standard places/.test(i.text))).toBe(true);
    const unknown = polkaStack([crestLayer({ placement: { kind: "anchor", anchorId: "nowhere" } })]);
    expect((await r.scene(unknown, "48", "front", { assets: assetReader([crestAsset()]) })).scene.issues.some((i) => /not one this garment has/.test(i.text))).toBe(true);
  });
});

describe("pictures", () => {
  const card = async (w: number, h: number) => ({ id: "card", kind: "raster" as const, widthPx: w, heightPx: h, dpiMeta: 300, print: await testCardPng(w, h) });
  const panel = (extra: Record<string, unknown> = {}) => ({
    ...common,
    id: "art",
    kind: "image-fill",
    views: ["front"],
    assetId: "card",
    mode: "panel",
    scale: 1,
    rotationDeg: 0,
    offsetMm: { x: 0, y: 0 },
    halfDrop: false,
    fit: "cover",
    ...extra,
  });

  it("places a full panel picture over the piece and the bleed, and reports its dpi", async () => {
    const stack = polkaStack([panel()]);
    const { scene, lowestDpi } = await r.scene(stack, "48", "front", { assets: assetReader([await card(1200, 1600)]) });
    const image = scene.items.find((i): i is ImageItem => i.kind === "image")!;
    expect(image).toBeDefined();
    const corners = applyAll(image.matrix, [[0, 0], [image.widthPx, image.heightPx]]);
    const box = boundsOf(corners);
    expect(box.minX).toBeLessThanOrEqual(boundsOf(scene.bleed).minX + 0.5);
    expect(box.maxX).toBeGreaterThanOrEqual(boundsOf(scene.bleed).maxX - 0.5);
    expect(lowestDpi).not.toBeNull();
  });

  it("warns, in the margin and the result, when a picture is too small for the print house", async () => {
    const stack = polkaStack([panel()]);
    const { scene } = await r.scene(stack, "48", "front", { assets: assetReader([await card(300, 400)]) });
    expect(scene.issues.some((i) => /would print at about \d+ dpi/.test(i.text) && /up to about \d+ cm wide/.test(i.text))).toBe(true);
    expect(scene.noteLines.some((l) => l.includes("dpi"))).toBe(true);
  });

  it("repeats a tile on the datum, with half drop, and refuses a repeat too small to be sensible", async () => {
    const tile = (id: string) => ({ ...common, id, kind: "image-fill", views: ["front"], assetId: "card", mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: true, fit: "cover" });
    const asset = await card(300, 300);
    const ok = await r.scene(polkaStack([tile("tile")]), "48", "front", { assets: assetReader([asset]) });
    const tiles = ok.scene.items.filter((i): i is ImageItem => i.kind === "image");
    expect(tiles.length).toBeGreaterThan(4);
    expect(new Set(tiles.map((t) => t.imageId)).size).toBe(1);
    const tiny = await r.scene(polkaStack([{ ...tile("tiny"), scale: 0.02 }]), "48", "front", { assets: assetReader([asset]) });
    expect(tiny.scene.issues.some((i) => i.severity === "stop" && /more than 2500 tiles/.test(i.text))).toBe(true);
  });

  it("leaves a layer off when its picture is not there or not a picture", async () => {
    const stack = polkaStack([panel()]);
    expect((await r.scene(stack, "48", "front")).scene.issues.some((i) => /not available/.test(i.text))).toBe(true);
    const junk = { id: "card", kind: "raster" as const, widthPx: 10, heightPx: 10, print: new Uint8Array([1, 2, 3]) };
    expect((await r.scene(stack, "48", "front", { assets: assetReader([junk]) })).scene.issues.some((i) => /could not be read/.test(i.text))).toBe(true);
  });
});

describe("shrink, blend and rules", () => {
  it("scales art and cut line by the shrink and says so", async () => {
    const plain = (await r.scene(polkaStack(), "48", "back")).scene;
    const scaled = (await r.scene(polkaStack(), "48", "back", { settings: { ...SETTINGS, scaleX: 1.0204, scaleY: 1.0152, scaleNote: null } })).scene;
    const w = (s: typeof plain) => boundsOf(s.cut).maxX - boundsOf(s.cut).minX;
    const h = (s: typeof plain) => boundsOf(s.cut).maxY - boundsOf(s.cut).minY;
    expect(w(scaled) / w(plain)).toBeCloseTo(1.0204, 4);
    expect(h(scaled) / h(plain)).toBeCloseTo(1.0152, 4);
    expect(scaled.noteLines.some((l) => l.includes("Scaled 1.0204 x 1.0152"))).toBe(true);
    expect(plain.noteLines.some((l) => l.includes("Not scaled for shrink"))).toBe(true);
  });

  it("builds a piece that uses multiply as a raster and leaves the others alone", async () => {
    const mult = { ...common, id: "shade", kind: "graphic", views: ["front"], blend: "multiply", source: { kind: "asset", assetId: "crest" }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 50, rotationDeg: 0, clearSpaceMm: 0, knockOut: false };
    const stack = polkaStack([mult]);
    const front = await r.scene(stack, "48", "front", { assets: assetReader([crestAsset()]) });
    const back = await r.scene(stack, "48", "back", { assets: assetReader([crestAsset()]) });
    expect(front.scene.raster?.reason).toMatch(/shade/);
    expect(front.scene.noteLines.some((l) => /one picture/.test(l))).toBe(true);
    expect(back.scene.raster).toBeNull();
  });

  it("turns a knock-out layer into holes in the pattern and draws nothing for it", async () => {
    const hole = { ...common, id: "hole", kind: "graphic", views: ["front"], blend: "knock-out", source: { kind: "asset", assetId: "crest" }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 70, rotationDeg: 0, clearSpaceMm: 0, knockOut: false };
    const { scene } = await r.scene(polkaStack([hole]), "48", "front", { assets: assetReader([crestAsset()]) });
    expect(scene.items.some((i) => i.layerId === "hole")).toBe(false);
  });

  it("checks colours against the avoid list and says when the list is empty", async () => {
    const stack = polkaStack();
    const none = await r.scene(stack, "48", "front");
    expect(none.scene.issues.some((i) => /No colours to avoid are set/.test(i.text))).toBe(true);
    const set = await r.scene(stack, "48", "front", { rules: { ...NO_RULES, coloursToAvoid: ["#cc2222"] } });
    expect(set.scene.issues.some((i) => /#cc2222/.test(i.text))).toBe(true);
  });

  it("names the pattern in the margin when it is not available, and notes a design read from a picture", async () => {
    const unknown = polkaStack([], {});
    const edited = { ...unknown, layers: unknown.layers.map((l) => (l.id === "dots" ? { ...l, generatorId: "kit-unknown", provenance: "read-from-image" as const } : l)) };
    const { scene } = await r.scene(edited, "48", "front");
    expect(scene.issues.some((i) => /not available/.test(i.text))).toBe(true);
    expect(scene.noteLines).toContain("Read from a picture. Compare with the picture before printing.");
    expect(scene.noteLines).toContain("Draft pattern, not reviewed.");
  });
});
