import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPdf } from "./fixtures/pdf-read";
import { SPIKE_CALLOUT, SPIKE_FONT_FILE, renderSpikePdf } from "./pdf-spike";

const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;

describe("drawing a flat as PDF primitives", () => {
  it("makes a valid A4 PDF with the callout text, a dashed line and a raster logo", async () => {
    const bytes = await renderSpikePdf();
    const facts = await readPdf(new Uint8Array(bytes));

    expect(facts.startsAsPdf).toBe(true);
    expect(facts.pageCount).toBe(1);
    expect(facts.widthPoints).toBeCloseTo(A4_WIDTH_POINTS, 1);
    expect(facts.heightPoints).toBeCloseTo(A4_HEIGHT_POINTS, 1);
    expect(facts.text).toContain(SPIKE_CALLOUT);
    expect(Buffer.from(bytes).toString("latin1")).toMatch(/Geist/);
    expect(readFileSync(SPIKE_FONT_FILE).byteLength).toBeGreaterThan(50_000);
  });
});

describe("the spike leaves nothing running in the app", () => {
  it("has no route of its own and no font entry for one; the real export route arrives in step 9", () => {
    expect(existsSync(join(process.cwd(), "app", "api", "flat-spike"))).toBe(false);
    expect(readFileSync(join(process.cwd(), "next.config.ts"), "utf8")).not.toContain("flat-spike");
  });
});
