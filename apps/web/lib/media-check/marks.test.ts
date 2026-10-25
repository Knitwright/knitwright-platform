import { describe, expect, it } from "vitest";
import { alignment, generatedMask, overlap } from "./alignment";
import type { Frame } from "./frame";
import { matchMark } from "./protected";
import { SAMPLE_STEP, pixelsIn, toAnalysis, without } from "./regions";

const W = 40;
function frame(paint: (x: number, y: number) => number, mask?: (x: number, y: number) => boolean): Frame {
  const n = W * W;
  const [r, g, b] = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y] = [i % W, Math.floor(i / W)];
    r[i] = g[i] = b[i] = paint(x, y);
    m[i] = (mask ? mask(x, y) : true) ? 1 : 0;
  }
  return { width: W, height: W, r, g, b, mask: m };
}
const mark = (x: number, y: number): number => (x > 12 && x < 28 && y > 12 && y < 28 && (x + y) % 5 < 2 ? 220 : 40);
const RECT = { x: 8, y: 8, width: 24, height: 24 };

describe("matchMark", () => {
  it("matches the same mark and finds one that sits two pixels off", () => {
    const ref = frame(mark);
    expect(matchMark(ref, ref, RECT)).toMatchObject({ correlation: expect.closeTo(1, 5), offset: 0, blank: false });
    const off = frame((x, y) => mark(x - 2, y - 1));
    const m = matchMark(ref, off, RECT);
    expect(m.correlation).toBeGreaterThan(0.99);
    expect(m.offset).toBe(W + 2);
  });

  it("calls a blank crop blank and a flat reference unmeasurable", () => {
    expect(matchMark(frame(mark), frame(() => 40), RECT)).toMatchObject({ blank: true, correlation: expect.any(Number) });
    expect(matchMark(frame(() => 40), frame(mark), RECT).correlation).toBeNull();
  });

  it("skips shifts that fall off the picture", () => {
    const edge = { x: 0, y: 0, width: 20, height: 20 };
    expect(matchMark(frame(mark), frame(mark), edge).correlation).not.toBeNull();
  });
});

describe("alignment", () => {
  const garment = (x: number, y: number): boolean => x > 8 && x < 32 && y > 8 && y < 32;
  const ref = frame(() => 0, garment);

  it("is high for the same place and low for a moved garment", () => {
    const same = frame((x, y) => (garment(x, y) ? 40 : 220));
    const moved = frame((x, y) => (garment(x - 12, y) ? 40 : 220));
    expect(alignment(ref, same)).toBeGreaterThan(0.95);
    expect(alignment(ref, moved)).toBeLessThan(0.5);
  });

  it("follows a tilted background instead of calling it garment", () => {
    const tilted = frame((x, y) => (garment(x, y) ? 20 : 150 + x * 1.5));
    expect(alignment(ref, tilted)).toBeGreaterThan(0.9);
    const mask = generatedMask(ref, tilted, Array.from({ length: W }, (_, i) => i));
    expect(mask).toHaveLength(W * W);
  });

  it("cannot be measured when the garment fills the canvas", () => {
    expect(alignment(frame(() => 0), frame(() => 100))).toBeNull();
  });

  it("scores two empty masks as no overlap", () => {
    expect(overlap(new Uint8Array(4), new Uint8Array(4))).toBe(0);
  });
});

describe("regions", () => {
  it("scales and clips rectangles, and drops one that is off the picture", () => {
    expect(toAnalysis({ x: 100, y: 100, width: 200, height: 200 }, { width: 1000, height: 1000 }, { width: 500, height: 500 })).toEqual({ x: 50, y: 50, width: 100, height: 100 });
    expect(toAnalysis({ x: -50, y: 0, width: 100, height: 10 }, { width: 100, height: 100 }, { width: 100, height: 100 })).toEqual({ x: 0, y: 0, width: 50, height: 10 });
    expect(toAnalysis({ x: 500, y: 0, width: 10, height: 10 }, { width: 100, height: 100 }, { width: 100, height: 100 })).toBeNull();
  });

  it("lists allowed pixels at a step and clears rectangles with a margin", () => {
    const all = new Uint8Array(100).fill(1);
    expect(pixelsIn({ x: 0, y: 0, width: 10, height: 10 }, all, 10, SAMPLE_STEP)).toHaveLength(25);
    const cleared = without(all, [{ x: 4, y: 4, width: 2, height: 2 }, { x: 8, y: 8, width: 5, height: 5 }], { width: 10, height: 10 }, 1);
    expect(cleared.reduce((s, v) => s + v, 0)).toBe(100 - 16 - 9);
    expect(all.reduce((s, v) => s + v, 0)).toBe(100);
  });
});
