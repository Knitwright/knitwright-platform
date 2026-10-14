import { describe, expect, it } from "vitest";
import { createFakeAssetReader } from "@/lib/artwork-stack";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { assetReader, crestAsset, testCardPng } from "./fixtures/assets";
import { gradedJersey } from "./fixtures/graded";
import { DEFAULT_PRINT_PROFILE } from "./profiles";
import { NO_RULES, rig } from "./fixtures/setup";
import { polkaStack } from "./fixtures/stacks";
import { anchorsFromInstances, frameFor } from "./frames/frame";
import { instancesOf } from "./frames/instances";
import { createPrintFileBuilder } from "./build/file-builder";
import { planPrintFiles } from "./build/plan";
import { servePrintFiles, printQuerySchema } from "./service";
import { outlineText } from "./text/outline";
import type { TrueTypeFont } from "./text/truetype";
import { buildZones } from "./zones/build";
import { JERSEY_ZONES } from "./zones/templates";

const pt = (x: number, y: number, onCurve: boolean) => ({ x, y, onCurve });
const fake = (contours: ReturnType<typeof pt>[][]): TrueTypeFont => ({
  unitsPerEm: 1000,
  capHeight: 700,
  glyphIndex: () => 1,
  advance: () => 600,
  contours: () => contours,
});

describe("outlines of unusual glyphs", () => {
  it("handles a contour of control points only, runs of control points, and leaves out a one-point contour", () => {
    const round = [pt(0, 0, false), pt(700, 0, false), pt(700, 700, false), pt(0, 700, false)];
    expect(outlineText("o", 70, fake([round])).rings).toHaveLength(1);
    const mixed = [pt(0, 0, true), pt(300, 0, false), pt(600, 0, false), pt(700, 300, true), pt(0, 300, true)];
    expect(outlineText("o", 70, fake([mixed])).rings[0]!.length).toBeGreaterThan(8);
    const closing = [pt(0, 0, true), pt(700, 0, true), pt(700, 700, false)];
    expect(outlineText("o", 70, fake([closing])).rings).toHaveLength(1);
    expect(outlineText("o", 70, fake([[pt(1, 1, true)]])).rings).toEqual([]);
  });
});

describe("planning", () => {
  const pattern = gradedJersey(["48", "50"]);
  const profile = { ...DEFAULT_PRINT_PROFILE };
  it("names a nameless player by number when skipped, and leaves out players of sizes not asked for", () => {
    const rows = [{ ...ROSTER_22.rows[0]!, name: "", sizeLabel: "ZZ" }, { ...ROSTER_22.rows[1]!, sizeLabel: "50" }];
    const plan = planPrintFiles({ pattern, stack: polkaStack(), sizes: ["48"], formats: ["pdf"], profile, roster: { ...ROSTER_22, rows }, sizeFor: (r) => (r.sizeLabel === "ZZ" ? null : r.sizeLabel) });
    expect(plan.skipped[0]).toMatch(/^Number /);
    expect(plan.entries.every((e) => e.player === null)).toBe(true);
  });
});

describe("frames and zones with a partial pattern", () => {
  it("lays a collar out without a fold line, skips a view the pattern lacks, and finds no anchors for it", () => {
    const { instances } = instancesOf(gradedJersey(["48"]).piecesBySize["48"]!, "48");
    const collar = instances.find((i) => i.id === "collar")!;
    const flat = { ...collar, piece: { ...collar.piece, foldLine: null } };
    expect(frameFor(flat, {}).basis).toBe("bounds");
    const sleeveless = instances.filter((i) => !i.id.startsWith("sleeve"));
    expect(anchorsFromInstances(sleeveless)["sleeve-left"]).toBeUndefined();
    const bare = { ...instances.find((i) => i.id === "sleeve-left")!, piece: { ...instances.find((i) => i.id === "sleeve-left")!.piece, landmarks: {} } };
    expect(frameFor(bare, {}).basis).toBe("bounds");
    const zones = buildZones(JERSEY_ZONES, gradedJersey(["48"]), anchorsFromInstances(instances), { roles: { front: ["front"] } });
    expect(zones.map((z) => z.id).sort()).toEqual(["crest", "front-number", "sponsor"]);
  });
});

describe("builder options", () => {
  const pattern = gradedJersey(["48"]);
  const base = {
    pattern,
    stack: polkaStack(),
    colourwayId: "main",
    assets: createFakeAssetReader([]),
    rules: NO_RULES,
    roster: null,
    garment: "football-jersey",
    minDpi: 150,
    scaleNote: null,
    defaultsNote: null,
    patternReviewed: true,
  } as const;
  const spec = { pieceId: "collar", size: "48", format: "tiff", bleedMm: 15, scaleX: 1, scaleY: 1, dpi: 72, profile: DEFAULT_PRINT_PROFILE } as const;

  it("ignores a player number nobody has, and omits the draft note when reviewed", async () => {
    const builder = createPrintFileBuilder({ ...base, roster: ROSTER_22 });
    const file = await builder.buildFile({ ...spec, playerNumber: "999" } as never, { transferOnly: true });
    expect(file.scene.scene.playerLabel).toBeNull();
    expect(file.scene.scene.noteLines).not.toContain("Draft pattern, not reviewed.");
  });
});

describe("service options", () => {
  it("says the profile is the print house's own when it is, and names a colourway", async () => {
    const profile = { ...DEFAULT_PRINT_PROFILE, source: "print-house" as const };
    const response = await servePrintFiles({ project: { name: "###", version: 1, spec: jersey() }, profile, rules: NO_RULES, icc: null }, printQuerySchema.parse({ formats: "svg", size: "48", colourway: "away" }));
    expect(response.headers.get("content-disposition")).toContain('filename="design-v1-print-files.zip"');
  }, 60_000);
});

describe("graphics from the older logo path", () => {
  it("reads a file source through the asset reader, and a vector shape with no fill", async () => {
    const r = rig(["48"]);
    const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
    const layer = { ...common, id: "old", kind: "graphic", views: ["front"], source: { kind: "file", fileId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f" }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 40, rotationDeg: 0, clearSpaceMm: 0, knockOut: false };
    const outline = { ...crestAsset(), id: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f", print: new TextEncoder().encode(JSON.stringify({ version: 1, width: 10, height: 10, shapes: [{ fill: null, stroke: { colour: "#000000", widthMm: 0.1 }, closed: true, rings: [[[0, 0], [10, 0], [10, 10]]] }] })) };
    const { scene } = await r.scene(polkaStack([layer]), "48", "front", { assets: assetReader([outline]), rules: { ...NO_RULES, minLineMm: 0.5 } });
    expect(scene.items.some((i) => i.kind === "stroke")).toBe(true);
    expect(scene.issues.some((i) => /thinner than/.test(i.text))).toBe(true);
    const raster = { ...layer, id: "pic", source: { kind: "asset", assetId: "card" }, widthMm: 400 };
    const card = { id: "card", kind: "raster" as const, widthPx: 100, heightPx: 100, dpiMeta: 300, print: await testCardPng(100, 100) };
    const soft = await r.scene(polkaStack([raster]), "48", "front", { assets: assetReader([card]) });
    expect(soft.scene.issues.some((i) => /would print at about/.test(i.text))).toBe(true);
    const junk = await r.scene(polkaStack([raster]), "48", "front", { assets: assetReader([{ ...card, print: new Uint8Array([1]) }]) });
    expect(junk.scene.issues.some((i) => /could not be read/.test(i.text))).toBe(true);
  });
});
