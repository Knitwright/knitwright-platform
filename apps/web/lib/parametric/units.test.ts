import { describe, expect, it } from "vitest";
import { f2, g15 } from "./format";
import { at, bbox, notch, offsetOutline, unit, type Pt } from "./geometry";
import { MAX_LOOP_EDGES, trimLoops } from "./loops";
import { outlineProblems, segmentsTouch, selfIntersections, signedArea } from "./validate";

describe("the reference number formats", () => {
  it.each([
    [0, "0"],
    [12, "12"],
    [1.5, "1.5"],
    [117.194, "117.19"],
    [0.125, "0.13"],
    [-0.125, "-0.13"],
    [-0.004, "0"],
    [1e-9, "0"],
    [-346.34, "-346.34"],
    [99.995, "100"],
    [2.675, "2.68"],
  ])("f2(%d) is %s", (v, text) => expect(f2(v)).toBe(text));

  it("refuses a number that is not finite", () => {
    expect(() => f2(Number.NaN)).toThrow(/finite/);
  });

  it("refuses a magnitude no millimetre coordinate can have", () => {
    expect(() => f2(1e15)).toThrow(/Out of range/);
    expect(f2(-999999999999999)).toBe("-999999999999999");
  });

  it("g15 keeps fifteen significant digits", () => {
    expect(g15(1968.83294080600123)).toBe("1968.832940806");
    expect(g15(30)).toBe("30");
    expect(g15(0.85)).toBe("0.85");
  });
});

describe("the geometry helpers", () => {
  it("gives a zero direction for a zero-length step", () => {
    expect(unit(0, 0)).toEqual([0, 0]);
  });

  it("returns the last point and direction past the end of a polyline", () => {
    expect(at([[0, 0], [10, 0]], 50)).toEqual({ p: [10, 0], d: [1, 0] });
  });

  it("cuts a notch 5 mm into the allowance, square to the edge", () => {
    const [cut, inner] = notch([[0, 0], [100, 0]], 50, 6);
    expect(cut).toEqual([50, -6]);
    expect(inner).toEqual([50, -1]);
  });

  it("offsets a square outward by each edge's own allowance", () => {
    const square: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(offsetOutline(square, [1, 2, 3, 4])).toEqual([[-4, -1], [12, -1], [12, 13], [-4, 13]]);
  });

  it("uses the plain offset where an edge runs straight on, or where a mitre would overshoot", () => {
    const straight: Pt[] = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
    expect(offsetOutline(straight, [1, 1, 1, 1, 1])[1]).toEqual([5, -1]);
    const spike: Pt[] = [[0, 0], [100, 0], [0, 1]];
    const corner = offsetOutline(spike, [1, 1, 1])[1];
    expect(corner[0]).toBeCloseTo(100 + 1 / Math.hypot(100, 1), 9);
    expect(corner[1]).toBeCloseTo(100 / Math.hypot(100, 1), 9);
  });

  it("measures a box", () => {
    expect(bbox([[1, 5], [-2, 3], [4, -1]])).toEqual({ x0: -2, x1: 4, y0: -1, y1: 5 });
  });
});

describe("outline validation", () => {
  const square: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it("accepts a simple outline", () => {
    expect(outlineProblems(square)).toEqual([]);
    expect(signedArea(square)).toBe(100);
  });

  it("names each problem", () => {
    expect(outlineProblems([[0, 0], [1, 1]])).toEqual(["too-few-points"]);
    expect(outlineProblems([[0, 0], [1, Number.NaN], [2, 0]])).toEqual(["not-finite"]);
    expect(outlineProblems([[0, 0], [1, 0], [2, 0]])).toEqual(["no-area"]);
    expect(outlineProblems([[0, 0], [10, 0], [10, 0], [10, 10]])).toContain("repeated-point");
    expect(outlineProblems([[0, 0], [10, 10], [10, 0], [0, 10]])).toEqual(["no-area", "self-intersecting"]);
  });

  it("finds a crossing and a touch, not a shared corner", () => {
    expect(selfIntersections([[0, 0], [10, 10], [10, 0], [0, 10]])).toEqual([[0, 2]]);
    expect(segmentsTouch([0, 0], [10, 0], [5, 0], [5, 5])).toBe(true);
    expect(segmentsTouch([0, 0], [10, 0], [11, 0], [12, 0])).toBe(false);
    expect(segmentsTouch([5, 5], [5, 0], [0, 0], [10, 0])).toBe(true);
    expect(segmentsTouch([0, 0], [4, 0], [4, 0], [9, 9])).toBe(true);
    expect(segmentsTouch([0, 0], [4, 0], [9, 9], [4, 0])).toBe(true);
  });
});

describe("loop trimming", () => {
  it("cuts a small loop off at its crossing", () => {
    // A square whose bottom edge doubles back on itself in a small loop.
    const looped: Pt[] = [[0, 0], [6, 0], [6, -1], [5, -1], [5, 1], [10, 1], [10, 10], [0, 10]];
    const trimmed = trimLoops(looped);
    expect(selfIntersections(looped).length).toBeGreaterThan(0);
    expect(trimmed).toEqual([[0, 0], [5, 0], [5, 1], [10, 1], [10, 10], [0, 10]]);
    expect(outlineProblems(trimmed)).toEqual([]);
  });

  it("leaves a crossing wider than the loop limit for validation to report", () => {
    const bowtie: Pt[] = [[0, 0], [10, 10], [10, 0], [0, 10]];
    const wide: Pt[] = [[0, 0], ...Array.from({ length: MAX_LOOP_EDGES + 2 }, (_, i): Pt => [10 + i, 10 + i]), [10, 0], [0, 10]];
    expect(trimLoops(wide)).toEqual(wide);
    expect(trimLoops(bowtie)).not.toEqual(bowtie);
  });

  it("passes over edges that overlap along a line, which have no single crossing, and still ends", () => {
    const overlap: Pt[] = [[0, 0], [10, 0], [8, 0], [2, 0], [0, 5]];
    expect(trimLoops(overlap).length).toBeLessThan(overlap.length);
  });
});
