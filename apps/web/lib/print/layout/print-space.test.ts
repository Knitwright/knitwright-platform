import { describe, expect, it } from "vitest";
import { printScale } from "@/lib/production/contract";
import { TEST_BASE_SIZE, TEST_GRADED_JERSEY } from "../fixtures/graded";
import { boundsOf, distance } from "../geometry/vec";
import { createLayoutMapper } from "./mapper";
import { NO_SCALE, createPrintSpace } from "./print-space";

const mapper = createLayoutMapper({ pattern: TEST_GRADED_JERSEY, baseSize: TEST_BASE_SIZE });
const shrink = printScale({
  shrinkLengthPct: { value: 2, source: "fabric-test", testId: "t1" },
  shrinkWidthPct: { value: 1.5, source: "fabric-test", testId: "t1" },
});

describe("print space", () => {
  it("is the piece itself when there is no scale", () => {
    const s = createPrintSpace(mapper, "front", "48", NO_SCALE)!;
    expect(s.outline).toEqual(s.frame.opened.outline);
    const p = s.toPrint({ x: 12, y: 34 });
    expect(p).toEqual(mapper.planeToPiece("front", { x: 12, y: 34 }, "48"));
  });
  it("grows the length by 1/(1-2%) and the width by 1/(1-1.5%), about the chest line on the centre", () => {
    const s = createPrintSpace(mapper, "front", "48", { length: shrink.length, width: shrink.width })!;
    const [a, b] = [s.toPrint({ x: 0, y: 0 }), s.toPrint({ x: 0, y: 100 })];
    expect(distance(a, b)).toBeCloseTo(100 * shrink.length, 6);
    const [c, d] = [s.toPrint({ x: 0, y: 0 }), s.toPrint({ x: 100, y: 0 })];
    expect(distance(c, d)).toBeCloseTo(100 * shrink.width, 6);
    const before = boundsOf(s.frame.opened.outline);
    const after = boundsOf(s.outline);
    // The piece's length runs along x in the pattern file.
    expect((after.maxX - after.minX) / (before.maxX - before.minX)).toBeCloseTo(1.0204, 2);
    expect((after.maxY - after.minY) / (before.maxY - before.minY)).toBeCloseTo(1.0152, 3);
  });
  it("converts back from print space to the plane", () => {
    const s = createPrintSpace(mapper, "back", "50", { length: 1.0204, width: 1.0152 })!;
    const plane = s.toPlane(s.toPrint({ x: 530, y: -77 }));
    expect(plane.x).toBeCloseTo(530, 9);
    expect(plane.y).toBeCloseTo(-77, 9);
  });
  it("has nothing for a view without a piece", () => {
    expect(createPrintSpace(mapper, "front", "99", NO_SCALE)).toBeNull();
  });
});
