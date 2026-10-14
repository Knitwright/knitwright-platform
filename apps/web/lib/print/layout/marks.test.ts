import { describe, expect, it } from "vitest";
import { DEFAULT_DATUM, type ArtworkStack, type Layer } from "@/lib/artwork-stack";
import { squareLogo, vectorLogo } from "../fixtures/assets";
import { makeEnv } from "../fixtures/env";
import { GREEN_A, NAVY, RED, playerMarks, stackOf } from "../fixtures/stacks";
import { shapeBounds } from "../geometry/boolean";
import { buildPieceScene } from "./piece-scene";
import type { PieceScene, VectorLayer } from "./scene";

const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
const graphic = (over: Record<string, unknown>): Layer =>
  ({ ...common, kind: "graphic", id: "crest", name: "Club crest", views: ["front"], source: { kind: "asset", assetId: "logo" }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 60, rotationDeg: 0, clearSpaceMm: 0, knockOut: false, ...over }) as Layer;
const text = (over: Record<string, unknown>): Layer =>
  ({ ...common, kind: "text", id: "sponsor", views: ["front"], text: "ACME PLUMBING", placement: { kind: "zone", zoneId: "sponsor" }, offsetMm: { x: 0, y: 0 }, heightMm: 20, rotationDeg: 0, colourId: "navy", ...over }) as Layer;

const front = async (stack: ArtworkStack, assets: Parameters<typeof makeEnv>[1] = {}, size = "48"): Promise<PieceScene> => {
  const env = await makeEnv(stack, assets);
  return (await buildPieceScene(env, { view: "front", size }))!;
};
const codes = (s: PieceScene): string[] => s.issues.map((i) => i.code);
const layerOf = (s: PieceScene, id: string): VectorLayer => s.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === id)!;

describe("placed logos", () => {
  it("fits a zone without comment, and reports one that is bigger than its zone", async () => {
    const ok = await front(stackOf([graphic({ widthMm: 60 })], [], ["front"]), { assets: [vectorLogo("logo")] });
    expect(codes(ok)).toEqual([]);
    const big = await front(stackOf([graphic({ widthMm: 200 })], [], ["front"]), { assets: [vectorLogo("logo")] });
    expect(codes(big)).toEqual(["larger-than-zone"]);
  });
  it("reports a place that is not on the view, a missing zone and an unreadable vector without stopping", async () => {
    const stack = stackOf([graphic({ id: "a", placement: { kind: "anchor", anchorId: "nowhere" } }), graphic({ id: "b", placement: { kind: "zone", zoneId: "back-name" } })], [], ["front"]);
    const s = await front(stack, { assets: [vectorLogo("logo")] });
    expect(codes(s)).toEqual(["not-placed", "not-placed"]);
    const broken = { ...vectorLogo("logo"), bytes: new TextEncoder().encode("{}") };
    const t = await front(stackOf([graphic({})], [], ["front"]), { assets: [broken] });
    expect(t.issues[0].text).toMatch(/could not be read as a vector/);
  });
  it("puts a logo on a free anchor, offset, and reports it as outside the standard zones", async () => {
    const s = await front(stackOf([graphic({ placement: { kind: "anchor", anchorId: "centre-chest" }, offsetMm: { x: 40, y: 10 }, widthMm: 30, rotationDeg: 20 })], [], ["front"]), { assets: [vectorLogo("logo")] });
    expect(codes(s)).toEqual(["outside-zones"]);
    expect(s.issues[0].text).toBe("Club crest is outside the standard zones.");
    expect(layerOf(s, "crest").shapes).toHaveLength(1);
  });
  it("turns a logo's silhouette into a hole in what is beneath when its blend is knock-out", async () => {
    const stack = stackOf([graphic({ blend: "knock-out", widthMm: 60 }), graphic({ id: "other", placement: { kind: "zone", zoneId: "sponsor" }, widthMm: 40 })], [], ["front"]);
    const s = await front(stack, { assets: [vectorLogo("logo")] });
    expect(s.layers.find((l) => l.layerId === "crest")).toBeUndefined();
    const ground = layerOf(s, "ground");
    expect(ground.shapes[0].shape.length).toBeGreaterThanOrEqual(1);
  });
  it("sets a raster logo at the file's resolution and warns when it is too small for its size", async () => {
    const small = await squareLogo("logo", 100, null);
    const s = await front(stackOf([graphic({ widthMm: 80 })], [], ["front"]), { assets: [small] });
    expect(codes(s)).toContain("below-min-dpi");
    expect(s.notes.some((n) => /states no resolution/.test(n))).toBe(true);
    expect(s.lowestDpi).toBeLessThan(150);
    expect(s.layers.some((l) => l.kind === "raster" && l.layerId === "crest")).toBe(true);
    const sharp = await squareLogo("logo", 2000, 300);
    const fine = await front(stackOf([graphic({ widthMm: 80 })], [], ["front"]), { assets: [sharp] });
    expect(codes(fine)).toEqual([]);
    expect(fine.lowestDpi).toBeGreaterThan(150);
  });
  it("draws a logo stored as the intake's vector model, and says what it cannot draw", async () => {
    const none = { type: "none" } as const;
    const path = { kind: "path", opacity: 1, strokeWidth: 3, lineCap: "butt", lineJoin: "miter", miterLimit: 4, fillRule: "nonzero", stroke: { type: "colour", hex: "#000000", opacity: 1 }, fill: { type: "colour", hex: "#102a56", opacity: 1 }, segments: [["M", 0, 0], ["L", 100, 0], ["L", 100, 100], ["L", 0, 100], ["Z"]] };
    const model = { schemaVersion: 1, viewBox: { x: 0, y: 0, width: 100, height: 100 }, statedSizeMm: null, gradients: [], clips: [], nodes: [path, { ...path, stroke: none, strokeWidth: 0, opacity: 0.5 }] };
    const asset = { ...vectorLogo("logo"), bytes: new TextEncoder().encode(JSON.stringify(model)) };
    const s = await front(stackOf([graphic({ widthMm: 60 })], [], ["front"]), { assets: [asset] });
    expect(layerOf(s, "crest").shapes).toHaveLength(2);
    expect(layerOf(s, "crest").shapes[1].opacity).toBe(0.5);
    expect(s.issues.find((i) => i.code === "not-drawn")?.text).toMatch(/holds outline strokes, which the print files do not draw yet/);
  });
  it("accepts a logo kept the older way, by file", async () => {
    const stack = stackOf([graphic({ source: { kind: "file", fileId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f" } })], [], ["front"]);
    const s = await front(stack, { assets: [vectorLogo("6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f")] });
    expect(layerOf(s, "crest")).toBeDefined();
    const none = await front(stack, { assets: [] });
    expect(codes(none)).toEqual(["asset-missing"]);
  });
});

describe("text", () => {
  it("outlines text in the chosen colour on its zone and keeps clear of it", async () => {
    const stack = stackOf([text({})], [NAVY], ["front"]);
    const s = await front(stack);
    const t = layerOf(s, "sponsor");
    expect(t.shapes.length).toBe("ACME PLUMBING".replace(" ", "").length);
    expect(new Set(t.shapes.map((x) => x.fill))).toEqual(new Set(["#101c40"]));
    expect(codes(s)).toEqual([]);
  });
  it("reports text below the minimum height, text wider than it should be, a missing colour, missing letters and a free anchor", async () => {
    const rules = { minTextHeightMm: 30, minLineMm: null, coloursToAvoid: ["#101c40"], numberRules: null };
    const stack = stackOf([text({ widthMm: 40 }), text({ id: "free", placement: { kind: "anchor", anchorId: "centre-chest" }, colourId: undefined, text: "A中B" })], [NAVY], ["front"]);
    const s = await front(stack, { overrides: { rules } });
    const got = codes(s);
    for (const code of ["text-too-small", "larger-than-zone", "colour-avoid", "no-colour", "missing-glyph", "outside-zones"]) expect(got).toContain(code);
  });
  it("turns text a given number of degrees", async () => {
    const flat = layerOf(await front(stackOf([text({ text: "II" })], [NAVY], ["front"])), "sponsor");
    const turned = layerOf(await front(stackOf([text({ text: "II", rotationDeg: 90 })], [NAVY], ["front"])), "sponsor");
    const [a, b] = [shapeBounds(flat.shapes[0].shape), shapeBounds(turned.shapes[0].shape)];
    expect(a.maxX - a.minX).toBeCloseTo(b.maxY - b.minY, 0);
  });
});

describe("player marks", () => {
  const stack = stackOf([...playerMarks(), { ...common, kind: "player-mark", id: "mark-leg", views: ["front"], place: "leg-number" } as Layer], [NAVY, RED, GREEN_A], ["front", "back"]);
  it("uses the design's sample when no player is given, and says so", async () => {
    const env = await makeEnv(stack);
    const back = (await buildPieceScene(env, { view: "back", size: "48" }))!;
    expect(back.notes.some((n) => /shown is the design's sample/.test(n))).toBe(true);
    expect(layerOf(back, "mark-back-number").shapes).toHaveLength(1);
  });
  it("says a place the pattern does not have was not placed, and prints nothing for a mark with no text", async () => {
    const env = await makeEnv(stack);
    const f = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(f.issues.some((i) => i.code === "not-placed" && /leg number/.test(i.text))).toBe(true);
    const bare = stackOf([{ ...common, kind: "player-mark", id: "mark-back-name", views: ["back"], place: "back-name", colourId: "navy" } as Layer], [NAVY], ["back"]);
    const b = (await buildPieceScene(await makeEnv(bare), { view: "back", size: "48" }))!;
    expect(b.layers.find((l) => l.layerId === "mark-back-name")).toBeUndefined();
  });
  it("says when a height was not set and a default was used", async () => {
    const noHeight = stackOf([{ ...common, kind: "player-mark", id: "mark-back-number", views: ["back"], place: "back-number", colourId: "navy", sample: { name: "X", number: "9" } } as Layer], [NAVY], ["back"]);
    const b = (await buildPieceScene(await makeEnv(noHeight), { view: "back", size: "48" }))!;
    expect(b.notes.some((n) => /height was not set: 250 mm \(Knitwright default\)/.test(n))).toBe(true);
  });
  it("makes a transfer set of the name and number alone, with no ground", async () => {
    const env = await makeEnv(stack);
    const t = (await buildPieceScene(env, { view: "back", size: "48", player: { name: "OKAFOR", number: "7" }, transferOnly: true }))!;
    expect(t.layers.map((l) => l.layerId)).toEqual(["mark-back-name", "mark-back-number"]);
    expect(t.transferOnly).toBe(true);
    expect(t.notes[0]).toContain("name and number only");
  });
});

describe("a piece without what a layer needs", () => {
  it("leaves a piece unprinted when its ground has no colour, and says so", async () => {
    const stack: ArtworkStack = { ...stackOf([], [], ["front"]), colours: [{ id: "ground-colour", role: "ground", codes: [], provenance: "user-edited" }] };
    const s = await front(stack);
    expect(codes(s)).toContain("no-ground");
    expect(DEFAULT_DATUM.anchor).toBe("chest-line");
  });
});
