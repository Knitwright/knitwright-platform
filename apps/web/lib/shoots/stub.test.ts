import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isLabelledAi, readTextChunks } from "@/lib/media/lifestyle/label";
import { marksFor, panelsFor, referencePng } from "@/lib/media-check/fixtures/synthetic";
import { checkShootResult } from "./check";
import type { ShootRequest } from "./provider";
import { failingShootProvider, stubShade, stubShootImage, stubShootProvider } from "./stub";

/**
 * The deterministic stub. Two things are being proved here, and the second is the one that makes a
 * shoot work today: the stub calls nothing and costs nothing, and the picture it gives back **passes
 * through the real checker**, because the garment in it is the garment it was handed.
 */

const SIZE = 320;

const ask = async (over: Partial<ShootRequest> = {}): Promise<ShootRequest> => ({
  garment: await referencePng(SIZE),
  extraGarments: [],
  modelPhoto: null,
  background: null,
  prompt: "A shoot",
  crop: "1:1",
  sceneSlug: "floodlit-pitch",
  seed: 12,
  ...over,
});

describe("the stub picture", () => {
  it("is the garment it was given, on a plain shade, at the same size", async () => {
    const request = await ask();
    const png = await stubShootImage(request);
    const before = await sharp(Buffer.from(request.garment)).metadata();
    const after = await sharp(Buffer.from(png)).metadata();
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
  });

  it("is marked as AI generated in the file itself, with the same function the existing pictures use", async () => {
    const png = await stubShootImage(await ask());
    expect(isLabelledAi(png)).toBe(true);
    expect(readTextChunks(png).Description).toMatch(/Scene: floodlit-pitch/);
  });

  it("gives the same bytes for the same request, and different ones for another attempt's seed", async () => {
    const one = await stubShootImage(await ask({ seed: 1 }));
    const same = await stubShootImage(await ask({ seed: 1 }));
    const other = await stubShootImage(await ask({ seed: 2 }));
    expect(Buffer.from(one).equals(Buffer.from(same))).toBe(true);
    expect(Buffer.from(one).equals(Buffer.from(other))).toBe(false);
  });

  it("chooses its shade from the seed, and has one for every seed", () => {
    expect(stubShade(0)).toBe(stubShade(0));
    expect(stubShade(-7)).toMatch(/^#[0-9a-f]{6}$/);
    expect(stubShade(1_000_003)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is kept by the real garment checker, which is what makes a shoot work without a paid call", async () => {
    const request = await ask();
    const png = await stubShootImage(request);
    const report = await checkShootResult({
      reference: request.garment,
      generated: png,
      protectedRegions: marksFor(SIZE),
      panels: panelsFor(SIZE),
    });
    expect(report.verdict).toBe("kept");
    expect(report.findings).toEqual([]);
  });

  it("costs nothing and is named as a stub, so a record of a run cannot read as a paid one", async () => {
    const provider = stubShootProvider();
    expect(provider.costPerImageMicrodollars).toBe(0);
    expect(provider.name).toBe("stub-shoot");
    const made = await provider.generate(await ask(), new AbortController().signal);
    expect(made.ok).toBe(true);
  });
});

describe("the stub that fails", () => {
  it("gives back the message it was made with, so the refund path has something real to fail on", async () => {
    const made = await failingShootProvider("the model refused").generate(await ask(), new AbortController().signal);
    expect(made).toEqual({ ok: false, message: "the model refused" });
  });
});
