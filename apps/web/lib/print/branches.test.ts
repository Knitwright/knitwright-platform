import { describe, expect, it } from "vitest";
import { BUILT_IN_GENERATORS, DEFAULT_DATUM, currentStack, type GeneratorContext, type PatternGenerator } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { makeEnv } from "./fixtures/env";
import { withoutLandmarks, TEST_GRADED_JERSEY } from "./fixtures/graded";
import { RED, BLUE, camoStack, stackOf } from "./fixtures/stacks";
import { createLayoutMapper } from "./layout/mapper";
import { agreementNotes } from "./layout/seam-notes";
import { scaleNote } from "./layout/notes";
import { buildPieceScene } from "./layout/piece-scene";
import { SHAPE_BUDGET, circlePoints } from "./layout/pattern";
import { buildZones, anchorPoint, bodyMeasures, sleevePoint, zoneCentre, zoneRectangle, ZONE_TEMPLATES } from "./zones";
import { buildSvg } from "./render/svg";
import { createPrintSpace, NO_SCALE } from "./layout/print-space";
import { rasteriseImageSet } from "./layout/images";
import { svgToRaw } from "./raster/rasterise";
import { canonicalPdf } from "./render/pdf-canonical";
import { openPiece } from "./layout/open-piece";
import { parseVectorCopy } from "./layout/vector-asset";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS }));

describe("notes about where a repeat agrees", () => {
  it("speak of the side seam on a body piece and of the shoulder point on a sleeve, and say nothing for a collar or a plain design", async () => {
    const env = await makeEnv(stack);
    const layers = stack.layers;
    expect(agreementNotes(env, layers, { view: "front", size: "48" })[0]).toMatch(/side seam at the chest line/);
    expect(agreementNotes(env, layers, { view: "sleeve-left", size: "48" })[0]).toMatch(/shoulder point.*underarm, because a sleeve cap is curved/);
    expect(agreementNotes(env, layers, { view: "collar", size: "48" })).toEqual([]);
    expect(agreementNotes(env, [layers[0]], { view: "front", size: "48" })).toEqual([]);
  });
  it("says when only one direction of the shrink is tested", async () => {
    const env = await makeEnv(stack);
    const half = { ...env, scale: { length: 1.0204, width: 1, note: "Not scaled for shrink: this fabric has no shrink test." }, scaleSource: null };
    expect(scaleNote(half)).toBe("Not scaled for shrink: this fabric has no shrink test. Scale applied: 1.0204 along the length and 1.0000 across.");
  });
});

describe("a pattern short of landmarks", () => {
  it("has no frame for a body without its underarm, and no zones for it", () => {
    const m = createLayoutMapper({ pattern: withoutLandmarks("front", ["underarm"]), baseSize: "48" });
    expect(m.frame("front", "48")).toBeNull();
    expect(m.views("48")).not.toContain("front");
    expect(bodyMeasures(m, "front", "48")).toBeNull();
    expect(buildZones(m, ["48"]).some((z) => z.pieceId === "front")).toBe(false);
    expect(anchorPoint(m, "front", "centre-chest", "48")).toBeNull();
  });
  it("lays out what it can: a sleeve without its hem points has no frame", () => {
    const m = createLayoutMapper({ pattern: withoutLandmarks("sleeve", ["hem-a"]), baseSize: "48" });
    expect(m.frame("sleeve-left", "48")).toBeNull();
    expect(sleevePoint(m, "sleeve-left", "48", 0, 0.5)).toBeNull();
    expect(m.rowAgreement("48").sleeveShoulderMm).toBe(0);
  });
  it("finds nothing for a collar with no fold, and zones that need landmarks the view does not have", () => {
    const m = createLayoutMapper({ pattern: TEST_GRADED_JERSEY, baseSize: "48" });
    const collar = ZONE_TEMPLATES.find((t) => t.view === "sleeve-left")!;
    expect(zoneCentre(m, { ...collar, view: "collar" }, "48")).toBeNull();
    expect(zoneRectangle(m, { ...collar, view: "collar" }, "48")).toBeNull();
    const noHem = createLayoutMapper({ pattern: withoutLandmarks("sleeve", ["hem-a", "hem-b"]), baseSize: "48" });
    expect(zoneCentre(noHem, ZONE_TEMPLATES.find((t) => t.id === "sleeve-band-left")!, "48")).toBeNull();
  });
  it("refuses a pair opened as a whole, and a mirror without the points to mirror about", () => {
    const sleeve = TEST_GRADED_JERSEY.piecesBySize["48"].find((p) => p.id === "sleeve")!;
    expect(() => openPiece({ ...sleeve, landmarks: {} }, "left")).toThrow(/needs a cap top/);
    const bare = Object.fromEntries(Object.entries(sleeve.landmarks).filter(([id]) => !id.startsWith("hem")));
    const noHem = openPiece({ ...sleeve, landmarks: bare }, "left");
    expect(noHem.outline.length).toBe(sleeve.cutOutline.length);
  });
});

describe("pattern budget and colours", () => {
  const manyShapes: PatternGenerator = {
    id: "many",
    label: "Many",
    params: [],
    repeat: { kind: "field" },
    maxColours: 1,
    render: (_c: GeneratorContext) => ({
      // A lattice well inside the body, so the cut to the outline keeps almost all of it.
      shapes: Array.from({ length: 128 * 165 }, (_, i) => ({ kind: "circle" as const, centre: { x: -160 + (i % 128) * 2.5, y: -60 + Math.floor(i / 128) * 2.5 }, radius: 0.8, fill: "#00ff00" })),
      note: "The generator drew a great deal.",
    }),
  };
  it("stops at the shape budget and says detail was left out", async () => {
    const s = stackOf([{ opacity: 1, blend: "normal", provenance: "user-edited", kind: "pattern", id: "many", views: ["front"], generatorId: "many", params: {}, datum: DEFAULT_DATUM, colourIds: ["red"] }], [RED], ["front"]);
    const env = await makeEnv(s, { generators: [...BUILT_IN_GENERATORS, manyShapes] });
    const scene = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(scene.issues.some((i) => i.code === "shape-budget")).toBe(true);
    expect(scene.notes.some((n) => /more than 20000 shapes/.test(n))).toBe(true);
    const layer = scene.layers.find((l) => l.layerId === "many")!;
    expect(layer.kind === "vector" && layer.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
  }, 120_000);
  it("prints a pattern colour that has no screen colour in black and says so", async () => {
    const s = stackOf([{ opacity: 1, blend: "normal", provenance: "user-edited", kind: "pattern", id: "dots", views: ["front"], generatorId: "kit-dots", params: { dotWidthMm: 30 }, datum: DEFAULT_DATUM, colourIds: ["plain"] }], [{ id: "plain", role: "x", codes: [], provenance: "user-edited" }, BLUE], ["front"]);
    const scene = (await buildPieceScene(await makeEnv(s), { view: "front", size: "48" }))!;
    expect(scene.issues.some((i) => i.code === "no-colour")).toBe(true);
  }, 60_000);
  it("makes round dots from many short chords", () => {
    expect(circlePoints({ x: 0, y: 0 }, 15).length).toBeGreaterThan(50);
    expect(circlePoints({ x: 0, y: 0 }, 0.001).length).toBe(16);
  });
});

describe("renderers at the edges", () => {
  it("writes layer opacity and blend into the SVG, draws a region, and leaves out what is skipped", async () => {
    const env = await makeEnv(stack);
    const scene = (await buildPieceScene(env, { view: "collar", size: "48" }))!;
    const faint = { ...scene, layers: scene.layers.map((l) => ({ ...l, opacity: 0.5, blend: "multiply" as const })) };
    const full = buildSvg(faint, { guides: false, slug: [], background: null });
    expect(full).toContain('opacity="0.5"');
    expect(full).toContain("mix-blend-mode:multiply");
    const cropped = buildSvg(scene, { region: { minX: scene.box.minX, maxX: scene.box.minX + 10, minY: scene.box.minY, maxY: scene.box.minY + 10 }, pixels: { widthPx: 20, heightPx: 20 }, guides: true, slug: [], background: "#fff", skipLayers: new Set(scene.layers.map((l) => l.layerId)) });
    expect(cropped).toContain('width="20" height="20"');
    expect(cropped).not.toContain("<g id=\"layer-");
  });
  it("refuses a strip that comes out at another size than asked", async () => {
    await expect(svgToRaw('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>', 11, 10)).rejects.toThrow(/different size/);
  });
  it("draws nothing for a picture set with nothing to paint", async () => {
    const env = await makeEnv(camoStack(1));
    const space = createPrintSpace(env.mapper, "front", "48", NO_SCALE)!;
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(await rasteriseImageSet({ tiles: [], instances: [] }, [], box, { widthPx: 10, heightPx: 10, pxPerMmX: 1, pxPerMmY: 1, dpi: 25.4 })).toEqual([]);
    expect(space.outline.length).toBeGreaterThan(3);
  });
  it("leaves a PDF alone when its pieces are not numbered from one, or point at something missing", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    const noTrailer = text("%PDF-1.7\n1 0 obj\n<< /A 1 >>\nendobj\n");
    expect(canonicalPdf(noTrailer)).toBe(noTrailer);
    const dangling = text("%PDF-1.7\n1 0 obj\n<< /Root 9 0 R >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n9\n%%EOF");
    expect(canonicalPdf(dangling)).toBe(dangling);
    const noRoot = text("%PDF-1.7\n1 0 obj\n<< /A 1 >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 >>\nstartxref\n9\n%%EOF");
    expect(canonicalPdf(noRoot)).toBe(noRoot);
    const noEnd = text("%PDF-1.7\n1 0 obj\n<< /Length 3 >>\nstream\nabc\nendobj\n");
    expect(canonicalPdf(noEnd)).toBe(noEnd);
    const unclosed = text("%PDF-1.7\n1 0 obj\n<< /A 1 >>\n");
    expect(canonicalPdf(unclosed)).toBe(unclosed);
  });
  it("reads a vector logo only when it has the shape", () => {
    expect(parseVectorCopy(new TextEncoder().encode("not json"))).toBeNull();
    expect(parseVectorCopy(new TextEncoder().encode('{"kind":"vector"}'))).toBeNull();
  });
});
