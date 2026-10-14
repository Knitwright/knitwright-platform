import { unzipSync } from "fflate";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { BUILT_IN_GENERATORS, createFakeAssetReader, type DisplayList, type PatternGenerator } from "@/lib/artwork-stack";
import type { PrintProfile } from "@/lib/production/contract";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { assetReader, crestAsset } from "../fixtures/assets";
import { gradedJersey } from "../fixtures/graded";
import { NO_RULES } from "../fixtures/setup";
import { polkaStack } from "../fixtures/stacks";
import { boundsOf } from "../geometry/polygon";
import { createPrintFileBuilder, type BuilderDeps } from "./file-builder";
import { makeFiles, manifestCsv, zipFiles } from "./package";
import { planPrintFiles } from "./plan";

const pattern = gradedJersey();
const profile: PrintProfile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };
const MM = 25.4 / 72;

const deps = (patch: Partial<BuilderDeps> = {}): BuilderDeps => ({
  pattern,
  stack: polkaStack(),
  colourwayId: "main",
  assets: createFakeAssetReader([]),
  rules: NO_RULES,
  roster: null,
  garment: "football-jersey",
  minDpi: 150,
  scaleNote: "Not scaled for shrink: this fabric has no shrink test.",
  defaultsNote: "Bleed and resolution are Knitwright defaults, not from your print house.",
  patternReviewed: false,
  ...patch,
});

const spec = (pieceId: string, size: string, format: "pdf" | "svg" | "tiff", extra: Record<string, unknown> = {}) => ({
  pieceId,
  size,
  format,
  bleedMm: 15,
  scaleX: 1,
  scaleY: 1,
  dpi: 150,
  profile,
  ...extra,
});

describe("case 1: the polka-dot jersey, every piece in every size", () => {
  const builder = createPrintFileBuilder(deps());

  it("makes a 1:1 PDF whose page is the piece bounds plus 2 x 15 mm, in every size", async () => {
    for (const size of pattern.sizes) {
      for (const placed of builder.mapper.placed(size)) {
        const file = await builder.build(spec(placed.instance.id, size, "pdf") as never);
        const facts = await readPdf(file.bytes);
        const box = boundsOf(placed.instance.opened);
        expect(Math.abs(facts.widthPoints * MM - (box.maxX - box.minX + 30)), `${size} ${placed.instance.id}`).toBeLessThan(0.1);
        expect(Math.abs(facts.heightPoints * MM - (box.maxY - box.minY + 30))).toBeLessThan(0.1);
        expect(file.pageWidthMm).toBeCloseTo(box.maxX - box.minX + 30, 1);
      }
    }
  }, 60_000);

  it("makes an SVG in millimetres and a TIFF of the right pixel size", async () => {
    const svg = await builder.build(spec("collar", "48", "svg") as never);
    const text = new TextDecoder().decode(svg.bytes);
    expect(text).toMatch(/width="[\d.]+mm"/);
    expect(text).not.toMatch(/<script|onload|href="http/);
    const tiff = await builder.build(spec("collar", "48", "tiff") as never);
    const meta = await sharp(tiff.bytes).metadata();
    expect(meta.width).toBe(Math.round((tiff.pageWidthMm / 25.4) * 150));
    expect(meta.height).toBe(Math.round((tiff.pageHeightMm / 25.4) * 150));
  }, 60_000);

  it("gives the same bytes on a second run and a different hash for a different size", async () => {
    const a = await createPrintFileBuilder(deps()).build(spec("back", "48", "pdf") as never);
    const b = await createPrintFileBuilder(deps()).build(spec("back", "48", "pdf") as never);
    const c = await createPrintFileBuilder(deps()).build(spec("back", "50", "pdf") as never);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).not.toBe(c.sha256);
  }, 30_000);

  it("refuses a piece that is not in the size", async () => {
    await expect(builder.build(spec("front", "99", "pdf") as never)).rejects.toThrow(RangeError);
  });
});

describe("shrink", () => {
  it("scales the page by the fabric's shrink and says so in the file", async () => {
    const plain = await createPrintFileBuilder(deps()).build(spec("collar", "48", "pdf") as never);
    const scaled = await createPrintFileBuilder(deps()).build(spec("collar", "48", "pdf", { scaleX: 1.0204, scaleY: 1.0152 }) as never);
    expect(scaled.pageWidthMm).toBeGreaterThan(plain.pageWidthMm);
    expect(scaled.sha256).not.toBe(plain.sha256);
  });
});

describe("case 7: the 22-player roster", () => {
  const stack = polkaStack();
  const roster = { ...ROSTER_22, rows: ROSTER_22.rows.map((row) => ({ ...row, sizeLabel: "48" })) };

  it("plans one back piece per player and one manifest line per file", async () => {
    const plan = planPrintFiles({ pattern, stack, sizes: ["48"], formats: ["pdf"], profile, roster });
    const backs = plan.entries.filter((e) => e.player && e.spec.pieceId === "back");
    expect(backs).toHaveLength(22);
    expect(plan.entries.filter((e) => e.player && e.spec.pieceId === "front")).toHaveLength(22);
    expect(plan.entries.filter((e) => e.spec.pieceId === "sleeve-left" && e.player)).toHaveLength(0);
    expect(new Set(plan.entries.map((e) => e.path)).size).toBe(plan.entries.length);
  });

  it("puts the right name and number on each back, and reports a name that does not fit instead of squeezing it", async () => {
    const builder = createPrintFileBuilder(deps({ stack, roster }));
    const fine = ROSTER_22.rows.find((r) => r.name === "RIVERA") ?? ROSTER_22.rows[0]!;
    const long = ROSTER_22.rows.find((r) => r.name.length >= 14)!;
    const a = await builder.buildFile(spec("back", "48", "pdf", { playerNumber: fine.number }) as never);
    expect(a.scene.scene.playerLabel).toContain(fine.number);
    expect(a.scene.scene.items.some((i) => i.layerId === "back-number")).toBe(true);
    const b = await builder.buildFile(spec("back", "48", "pdf", { playerNumber: long.number }) as never);
    expect(b.scene.scene.issues.some((i) => i.severity === "stop" && /does not fit/.test(i.text))).toBe(true);
    expect(b.scene.scene.items.some((i) => i.layerId === "back-name")).toBe(false);
    expect(b.warnings.some((w) => /does not fit/.test(w))).toBe(true);
  }, 30_000);

  it("skips a player whose size has no pattern size and says so", () => {
    const odd = { ...ROSTER_22, rows: [{ ...ROSTER_22.rows[0]!, sizeLabel: "ZZ" }] };
    const plan = planPrintFiles({ pattern, stack, sizes: ["48"], formats: ["pdf"], profile, roster: odd, sizeFor: () => null });
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]).toMatch(/has no pattern size/);
  });

  it("makes transfer-only files when the marks are transfers", () => {
    const transfer = polkaStack([], {});
    const marks = { ...transfer, layers: transfer.layers.map((l) => (l.kind === "player-mark" ? { ...l, technique: "transfer" as const } : l)) };
    const plan = planPrintFiles({ pattern, stack: marks, sizes: ["48"], formats: ["pdf"], profile, roster });
    expect(plan.entries.filter((e) => e.transferOnly)).toHaveLength(44);
    expect(plan.entries.find((e) => e.transferOnly)?.path).toMatch(/-transfer\.pdf$/);
  });
});

describe("any design: a generated field is continuous across the seam, and the seed matters", () => {
  /** A stand-in for a seeded camo: spots decided by a hash of the whole design plane, so it is a field. */
  const camo: PatternGenerator = {
    id: "fake-camo",
    label: "Fake camo",
    params: [],
    repeat: { kind: "field" },
    maxColours: 2,
    render(context): DisplayList {
      const shapes = [];
      const hash = (x: number, y: number): number => {
        let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(context.seed + 1, 83492791)) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      };
      for (let gx = Math.floor(context.bounds.minX / 40); gx * 40 < context.bounds.maxX; gx += 1) {
        for (let gy = Math.floor(context.bounds.minY / 40); gy * 40 < context.bounds.maxY; gy += 1) {
          if (hash(gx, gy) < 0.4) shapes.push({ kind: "circle" as const, centre: { x: gx * 40 + 20, y: gy * 40 + 20 }, radius: 14, fill: context.colours[0] ?? "#336633" });
        }
      }
      return { shapes };
    },
  };
  const stackWith = (seed: number) => {
    const base = polkaStack();
    return { ...base, layers: base.layers.map((l) => (l.kind === "pattern" ? { ...l, generatorId: "fake-camo", params: {}, seed } : l)) };
  };
  const make = (seed: number) => createPrintFileBuilder(deps({ stack: stackWith(seed), generators: [...BUILT_IN_GENERATORS, camo] }));

  it("gives the same bytes for the same seed and different bytes for another", async () => {
    const [a, b, c] = [await make(7).build(spec("front", "48", "svg") as never), await make(7).build(spec("front", "48", "svg") as never), await make(8).build(spec("front", "48", "svg") as never)];
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).not.toBe(c.sha256);
  }, 30_000);

  it("draws one field on the front and the back, so a spot on the seam is on both", async () => {
    const builder = make(7);
    const [front, back] = await Promise.all([builder.buildFile(spec("front", "48", "svg") as never), builder.buildFile(spec("back", "48", "svg") as never)]);
    const placed = builder.mapper.placed("48");
    const toDesign = (id: string) => placed.find((p) => p.instance.id === id)!.frame.toDesign;
    const spots = (file: typeof front, id: string) => {
      const m = toDesign(id);
      return new Set(
        file.scene.scene.items
          .filter((i) => i.kind === "fill" && i.layerId === "dots")
          .map((i) => {
            const b = boundsOf((i as unknown as { rings: [number, number][][] }).rings.flat());
            const x = (b.minX + b.maxX) / 2;
            const y = (b.minY + b.maxY) / 2;
            return `${Math.round(m[0] * x + m[2] * y + m[4])},${Math.round(m[1] * x + m[3] * y + m[5])}`;
          }),
      );
    };
    const [f, k] = [spots(front, "front"), spots(back, "back")];
    const shared = [...f].filter((s) => k.has(s));
    expect(shared.length).toBeGreaterThan(20);
  }, 30_000);
});

describe("package", () => {
  it("zips the files with a manifest, the same bytes every time, and makes player text safe for a spreadsheet", async () => {
    const stack = polkaStack([
      { opacity: 1, blend: "normal", provenance: "user-edited", id: "crest", kind: "graphic", views: ["front"], source: { kind: "asset", assetId: "crest" }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 50, rotationDeg: 0, clearSpaceMm: 10, knockOut: true },
    ]);
    const roster = { ...ROSTER_22, rows: [{ ...ROSTER_22.rows[0]!, name: "=CMD()", sizeLabel: "48" }] };
    const builder = createPrintFileBuilder(deps({ stack, roster, assets: assetReader([crestAsset()]) }));
    const plan = planPrintFiles({ pattern, stack, sizes: ["48"], formats: ["svg"], profile, roster });
    const first = await makeFiles(builder, plan.entries);
    const second = await makeFiles(builder, plan.entries);
    expect(Buffer.from(zipFiles(first)).equals(Buffer.from(zipFiles(second)))).toBe(true);
    const csv = manifestCsv(first);
    expect(csv).toContain("'=CMD()");
    const unzipped = unzipSync(zipFiles(first));
    expect(Object.keys(unzipped)).toContain("manifest.csv");
    expect(Object.keys(unzipped).filter((n) => n.startsWith("48/")).length).toBe(plan.entries.length);
    expect(Object.keys(unzipped).some((n) => /cmd/.test(n) && !/^48\/[a-z0-9-]+\.svg$/.test(n))).toBe(false);
  }, 60_000);
});
