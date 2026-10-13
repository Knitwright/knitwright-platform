import { describe, expect, it } from "vitest";
import type { FlatLayer, FlatPath, Point } from "@/lib/flat/model";
import { lineEnds, markElements, markSizes, markedLine, placeMark, withMarks } from "./callout-marks";

const line = (from: Point, to: Point): FlatPath => ({
  kind: "path",
  name: "Chest width line",
  panelId: null,
  commands: [
    { op: "M", to: from },
    { op: "L", to },
  ],
  fill: null,
  stroke: null,
});

describe("the marks that tie a drawing to the measurement table", () => {
  const sizes = markSizes({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });

  it("are sized from the width of the drawing", () => {
    expect(sizes.radius).toBeCloseTo(22);
    expect(sizes.lineWidth).toBeCloseTo(1.8);
    expect(markSizes({ minX: 5, minY: 0, maxX: 5, maxY: 0 }).radius).toBeGreaterThan(0);
  });

  it("read the two ends of a straight line, and nothing else", () => {
    expect(lineEnds(line({ x: 0, y: 0 }, { x: 10, y: 0 }))).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(lineEnds({ ...line({ x: 0, y: 0 }, { x: 1, y: 0 }), commands: [{ op: "Z" }] })).toBeNull();
    expect(lineEnds({ ...line({ x: 0, y: 0 }, { x: 1, y: 0 }), commands: [] })).toBeNull();
  });

  it("go in the middle of their line when it is clear", () => {
    expect(placeMark([{ x: 0, y: 0 }, { x: 1000, y: 0 }], [], 20)).toEqual({ x: 500, y: 0 });
  });

  it("move along the line, then beside it, to keep clear of the marks already placed", () => {
    expect(placeMark([{ x: 0, y: 0 }, { x: 1000, y: 0 }], [{ x: 500, y: 0 }], 20)).toEqual({ x: 300, y: 0 });
    const short: readonly [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 10 }];
    const beside = placeMark(short, [{ x: 0, y: 5 }], 20);
    expect(Math.hypot(beside.x, beside.y - 5)).toBeGreaterThanOrEqual(46);
  });

  it("take the place furthest from the others when nothing is clear", () => {
    const crowded = Array.from({ length: 41 }, (_, index) => ({ x: (index - 20) * 10, y: 0 })).flatMap((point) =>
      [-150, -100, -50, 0, 50, 100, 150].map((y) => ({ x: point.x, y })),
    );
    const placed = placeMark([{ x: 0, y: -5 }, { x: 0, y: 5 }], crowded, 20);
    // Every place is within reach of a mark, and the end of the line is the furthest from any.
    expect(placed).toEqual({ x: 0, y: -4.5 });
  });

  it("hold the code in a white disc with a ring, smaller type for a code of two letters", () => {
    const [disc, letter] = markElements("A", { x: 10, y: 20 }, sizes);
    expect(disc).toMatchObject({ name: "A mark", fill: "#ffffff" });
    expect(letter).toMatchObject({ kind: "text", text: "A", anchor: "middle" });
    const [, double] = markElements("AB", { x: 10, y: 20 }, sizes);
    expect(double.size).toBeLessThan(letter.size);
  });

  it("name the line by its code and draw it at least wide enough to print, keeping a wider line as it is", () => {
    expect(markedLine(line({ x: 0, y: 0 }, { x: 1, y: 0 }), "A", sizes)).toMatchObject({ name: "A line", stroke: { width: sizes.lineWidth, dash: [] } });
    const wide = { ...line({ x: 0, y: 0 }, { x: 1, y: 0 }), stroke: { colour: "#000000", width: 9, dash: [2, 2] } };
    expect(markedLine(wide, "A", sizes)).toMatchObject({ stroke: { colour: "#000000", width: 9, dash: [2, 2] } });
  });

  it("grow the bounds of the drawing to hold every mark, and leave other layers out of it", () => {
    const [disc] = markElements("A", { x: 0, y: -990 }, sizes);
    const layers: FlatLayer[] = [
      { id: "measurements", label: "Measurements", elements: [disc] },
      { id: "panels", label: "Panels", elements: [{ ...disc, name: "Far mark", commands: [{ op: "M", to: { x: 5000, y: 0 } }] }] },
    ];
    const grown = withMarks({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, layers, sizes);
    expect(grown.minY).toBeLessThan(-990 - sizes.radius);
    expect(grown.maxX).toBe(1000);
  });
});
