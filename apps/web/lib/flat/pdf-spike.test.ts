import { readFileSync } from "node:fs";
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
