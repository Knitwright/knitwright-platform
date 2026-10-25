import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rgbToLab } from "@/lib/design-import/colours";
import { deltaE2000 } from "./ciede2000";
import { checkGeneration } from "./check";
import { generatedPng, marksFor, panelsFor, referencePng, jerseySvg, toPng } from "./fixtures/synthetic";

const SIZE = 320;
const hex = (r: number, g: number, b: number): string => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
const channel = fc.integer({ min: 0, max: 255 });
const dark = fc.integer({ min: 10, max: 110 });
const grey = fc.integer({ min: 205, max: 245 });
const NAVY = rgbToLab([0x14, 0x21, 0x3d]);

const run = async (reference: Uint8Array, generated: Uint8Array) =>
  checkGeneration({ reference, generated, protectedRegions: marksFor(SIZE), panels: panelsFor(SIZE) });

describe("properties", () => {
  it("a copy always passes, whatever the garment colours and the plain background", async () => {
    await fc.assert(
      fc.asyncProperty(fc.tuple(dark, dark, dark), fc.tuple(dark, dark, dark), grey, async (base, sleeve, bg) => {
        const svg = (background?: string) => jerseySvg({ base: hex(...base), sleeve: hex(...sleeve), background });
        const report = await run(await toPng(svg(), SIZE), await toPng(svg(hex(bg, bg, bg)), SIZE));
        expect(report.findings).toEqual([]);
      }),
      { numRuns: 8 },
    );
  }, 60_000);

  it("a large colour change of the body always fails the colour check", async () => {
    const far = fc.tuple(channel, channel, channel).filter(([r, g, b]) => deltaE2000(NAVY, rgbToLab([r, g, b])) > 25);
    await fc.assert(
      fc.asyncProperty(far, async (base) => {
        const report = await run(await referencePng(SIZE), await generatedPng({ base: hex(...base) }, SIZE));
        expect(report.findings.map((f) => `${f.code}:${f.regionId}`)).toContain("colour_changed:body");
      }),
      { numRuns: 8 },
    );
  }, 60_000);
});
