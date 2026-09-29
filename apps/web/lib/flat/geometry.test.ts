import { describe, expect, it } from "vitest";
import {
  boundsOfPoints,
  crossesItself,
  distanceToPolyline,
  extentPoints,
  flatten,
  grow,
  rotateAbout,
  segmentsCross,
} from "./geometry";
import type { FlatElement, PathCommand } from "./model";

const square: PathCommand[] = [
  { op: "M", to: { x: 0, y: 0 } },
  { op: "L", to: { x: 10, y: 0 } },
  { op: "L", to: { x: 10, y: 10 } },
  { op: "L", to: { x: 0, y: 10 } },
  { op: "Z" },
];

const bowtie: PathCommand[] = [
  { op: "M", to: { x: 0, y: 0 } },
  { op: "L", to: { x: 10, y: 10 } },
  { op: "L", to: { x: 10, y: 0 } },
  { op: "L", to: { x: 0, y: 10 } },
  { op: "Z" },
];

describe("flatten", () => {
  it("keeps straight lines and marks closed sub-paths", () => {
    const [run] = flatten(square);
    expect(run?.closed).toBe(true);
    expect(run?.points).toHaveLength(4);
  });

  it("splits a curve into steps that start and end on the curve", () => {
    const [run] = flatten([
      { op: "M", to: { x: 0, y: 0 } },
      { op: "C", c1: { x: 0, y: 10 }, c2: { x: 10, y: 10 }, to: { x: 10, y: 0 } },
    ]);
    expect(run?.closed).toBe(false);
    expect(run?.points.length).toBeGreaterThan(10);
    expect(run?.points.at(-1)).toEqual({ x: 10, y: 0 });
    const top = Math.max(...(run?.points ?? []).map((p) => p.y));
    expect(top).toBeCloseTo(7.5, 1);
  });

  it("gives one run for each move", () => {
    expect(flatten([...square, ...square])).toHaveLength(2);
  });

  it("ignores commands that come before any move", () => {
    expect(flatten([{ op: "L", to: { x: 1, y: 1 } }, { op: "Z" }])).toEqual([]);
  });
});

describe("crossing", () => {
  it("finds a proper crossing and ignores segments that only meet at an end", () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 })).toBe(false);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });

  it("says a square does not cross itself and a bow tie does", () => {
    expect(crossesItself(flatten(square))).toBe(false);
    expect(crossesItself(flatten(bowtie))).toBe(true);
  });

  it("finds two sub-paths that cross each other", () => {
    const shifted: PathCommand[] = square.map((command) =>
      command.op === "Z" ? command : { ...command, to: { x: command.to.x + 5, y: command.to.y + 5 } },
    );
    expect(crossesItself(flatten([...square, ...shifted]))).toBe(true);
  });
});

describe("distance and bounds", () => {
  it("measures the distance from a point to an outline", () => {
    const [run] = flatten(square);
    expect(distanceToPolyline({ x: 5, y: 0 }, run!)).toBe(0);
    expect(distanceToPolyline({ x: 5, y: -3 }, run!)).toBe(3);
  });

  it("handles a run with a repeated point", () => {
    const run = { points: [{ x: 1, y: 1 }, { x: 1, y: 1 }], closed: false };
    expect(distanceToPolyline({ x: 4, y: 5 }, run)).toBe(5);
  });

  it("finds the box round points and grows it", () => {
    const box = boundsOfPoints([{ x: 1, y: 2 }, { x: -3, y: 8 }]);
    expect(box).toEqual({ minX: -3, minY: 2, maxX: 1, maxY: 8 });
    expect(grow(box, 2)).toEqual({ minX: -5, minY: 0, maxX: 3, maxY: 10 });
  });

  it("rotates about a point", () => {
    const turned = rotateAbout({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(turned.x).toBeCloseTo(0, 6);
    expect(turned.y).toBeCloseTo(10, 6);
  });
});

describe("extent of an element", () => {
  it("includes the stroke width around a path", () => {
    const element: FlatElement = {
      kind: "path",
      name: "x",
      panelId: null,
      commands: square,
      fill: null,
      stroke: { colour: "#000000", width: 4, dash: [] },
    };
    const box = boundsOfPoints(extentPoints(element));
    expect(box).toEqual({ minX: -2, minY: -2, maxX: 12, maxY: 12 });
  });

  it("covers the four corners of a rotated picture", () => {
    const element: FlatElement = { kind: "image", fileId: "f", at: { x: 0, y: 0 }, width: 20, height: 10, rotation: 90 };
    const box = boundsOfPoints(extentPoints(element));
    expect(box.maxX).toBeCloseTo(5, 6);
    expect(box.maxY).toBeCloseTo(10, 6);
  });

  it("covers text of each anchor, and gives text room for a rotated line", () => {
    const base = { kind: "text", text: "Hello", at: { x: 100, y: 100 }, size: 20, colour: "#000000", rotation: 0 } as const;
    const start = boundsOfPoints(extentPoints({ ...base, anchor: "start" }));
    const middle = boundsOfPoints(extentPoints({ ...base, anchor: "middle" }));
    const end = boundsOfPoints(extentPoints({ ...base, anchor: "end" }));
    expect(start.minX).toBe(100);
    expect(middle.minX).toBeLessThan(100);
    expect(middle.maxX).toBeGreaterThan(100);
    expect(end.maxX).toBe(100);
    const turned = boundsOfPoints(extentPoints({ ...base, anchor: "start", rotation: 90 }));
    expect(turned.maxY - turned.minY).toBeGreaterThan(start.maxY - start.minY);
  });
});
