import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createBudget } from "./budget";
import { CLEANUP_FAILED, CLEANUP_PROMPT, createCleanUp } from "./cleanup";
import { renderTee } from "./fixtures/synthetic";
import { pixelAt } from "./raster";
import { ProviderError, type ImageProvider } from "@/lib/providers/image-provider";
import { PATTERN_NOT_READ_YET, dpiWarning, effectiveDpi, pendingPatternStage } from "./pattern";

const wide = async (): Promise<Uint8Array> =>
  new Uint8Array(await sharp({ create: { width: 600, height: 300, channels: 3, background: "#c8102e" } }).png().toBuffer());

describe("createCleanUp", () => {
  it("pads the picture to a square for the edit model and crops the answer back", async () => {
    const seen: { reference: Uint8Array; prompt: string }[] = [];
    const provider: ImageProvider = {
      name: "fake",
      generate: async (request) => {
        seen.push(request);
        return { bytes: request.reference, contentType: "image/png" };
      },
    };
    const budget = createBudget();
    const outcome = await createCleanUp(provider, budget).run(await wide());
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.generated).toBe(true);
    expect(outcome.raster.width / outcome.raster.height).toBeCloseTo(2, 1);
    expect(pixelAt(outcome.raster, 100, 100)).toEqual([200, 16, 46]);
    expect((await sharp(seen[0].reference).metadata()).width).toBe(1024);
    expect(seen[0].prompt).toBe(CLEANUP_PROMPT);
    expect(budget.spent().imageEdits).toBe(1);
  });

  it("refuses after the budget of two edits, and when the provider fails", async () => {
    const failing: ImageProvider = { name: "x", generate: async () => { throw new ProviderError("no", false); } };
    const budget = createBudget({ visionCalls: 3, imageEdits: 1 });
    const cleanup = createCleanUp(failing, budget);
    const { png } = await renderTee();
    expect(await cleanup.run(png)).toEqual({ ok: false, reason: CLEANUP_FAILED });
    expect(await cleanup.run(png)).toEqual({ ok: false, reason: CLEANUP_FAILED });
    expect(budget.spent().imageEdits).toBe(1);
  });

  it("says the picture could not be opened when the answer is not a picture", async () => {
    const odd: ImageProvider = { name: "x", generate: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }) };
    const outcome = await createCleanUp(odd, createBudget()).run(await wide());
    expect(outcome.ok).toBe(false);
  });
});

describe("pattern stage", () => {
  it("reads nothing until phase B, and says so", async () => {
    expect(pendingPatternStage.reads).toBe(false);
    expect(await pendingPatternStage.find({ view: "front", flat: { width: 1, height: 1, data: new Uint8ClampedArray(4) }, stepMm: 3, colours: [] })).toBeNull();
    expect(PATTERN_NOT_READ_YET).toMatch(/not read yet/);
  });
  it("warns under the default dpi and not above", () => {
    expect(effectiveDpi(300, 25.4)).toBe(300);
    expect(dpiWarning(72)).toMatch(/Knitwright default, not from your print house/);
    expect(dpiWarning(300)).toBeNull();
  });
});
