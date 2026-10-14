import { describe, expect, it } from "vitest";
import { boundsOf } from "../geometry/vec";
import { loadBundledFont, textShapes, textWidth, type Font } from "./font";

let font: Font;
const load = async () => (font ??= await loadBundledFont());

describe("font outlines", () => {
  it("reads the bundled font", async () => {
    const f = await load();
    expect(f.unitsPerEm).toBeGreaterThan(0);
    expect(f.capHeight).toBeGreaterThan(f.unitsPerEm * 0.6);
  });
  it("sets capital height to the height asked for", async () => {
    const f = await load();
    const { shapes } = textShapes(f, "H", { heightMm: 100 });
    const b = boundsOf(shapes.flat(2));
    expect(b.maxY - b.minY).toBeCloseTo(100, 0);
  });
  it("makes a zero as an outer ring with a hole, and a one as one ring", async () => {
    const f = await load();
    expect(textShapes(f, "0", { heightMm: 50 }).shapes[0]).toHaveLength(2);
    expect(textShapes(f, "1", { heightMm: 50 }).shapes[0]).toHaveLength(1);
  });
  it("measures width, which grows with more letters and with height", async () => {
    const f = await load();
    expect(textWidth(f, "10", 100)).toBeGreaterThan(textWidth(f, "1", 100));
    expect(textWidth(f, "10", 200)).toBeCloseTo(2 * textWidth(f, "10", 100), 6);
    expect(textWidth(f, "", 100)).toBe(0);
  });
  it("is the same every time", async () => {
    const f = await load();
    expect(JSON.stringify(textShapes(f, "RIVERA 10", { heightMm: 60 }))).toBe(JSON.stringify(textShapes(f, "RIVERA 10", { heightMm: 60 })));
  });
  it("centres on the origin when asked, with the baseline at zero (y up)", async () => {
    const f = await load();
    const { shapes, width } = textShapes(f, "OK", { heightMm: 40, align: "centre" });
    const b = boundsOf(shapes.flat(2));
    // The advance box is centred; the ink sits within a side bearing of that.
    expect(Math.abs((b.minX + b.maxX) / 2)).toBeLessThan(2);
    expect(width).toBeCloseTo(textWidth(f, "OK", 40), 6);
    expect(b.minY).toBeGreaterThanOrEqual(-1);
  });
  it("names the letters the font does not have instead of drawing a stand-in silently", async () => {
    const f = await load();
    const r = textShapes(f, "A中B", { heightMm: 40 });
    expect(r.missing).toEqual(["中"]);
  });
  it("draws accented letters, which the font builds from two parts", async () => {
    const f = await load();
    const plain = textShapes(f, "E", { heightMm: 40 }).shapes.length;
    const accented = textShapes(f, "É", { heightMm: 40 });
    expect(accented.missing).toEqual([]);
    expect(accented.shapes.flat().length).toBeGreaterThan(plain);
  });
  it("lets a space move the next letter on without a shape", async () => {
    const f = await load();
    expect(textShapes(f, "A B", { heightMm: 40 }).shapes).toHaveLength(2);
  });
});
