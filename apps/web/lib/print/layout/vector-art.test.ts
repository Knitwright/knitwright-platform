import { describe, expect, it } from "vitest";
import type { VectorModel } from "@/lib/artwork-intake";
import { readVectorArt, VECTOR_NOTES } from "./vector-art";

const text = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const colour = (hex: string) => ({ type: "colour" as const, hex, opacity: 1 });
const none = { type: "none" as const };

const path = (segments: unknown[], over: Record<string, unknown> = {}) => ({
  kind: "path",
  opacity: 1,
  segments,
  fill: colour("#1b2a49"),
  fillRule: "nonzero",
  stroke: none,
  strokeWidth: 0,
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 4,
  ...over,
});

const model = (nodes: unknown[], over: Partial<Record<keyof VectorModel, unknown>> = {}) => ({
  schemaVersion: 1,
  viewBox: { x: 0, y: 0, width: 100, height: 50 },
  statedSizeMm: null,
  gradients: [],
  clips: [],
  nodes,
  ...over,
});

const SQUARE = [["M", 10, 10], ["L", 20, 10], ["L", 20, 20], ["L", 10, 20], ["Z"]];

describe("readVectorArt: the print copy of an uploaded vector", () => {
  it("reads a path as a closed filled shape in the drawing's own box", () => {
    const read = readVectorArt(text(model([path(SQUARE)])));
    expect(read?.art).toMatchObject({ width: 100, height: 50 });
    expect(read?.art.shapes).toEqual([{ fill: "#1b2a49", stroke: null, closed: true, rings: [[[10, 10], [20, 10], [20, 20], [10, 20]]] }]);
    expect(read?.notes).toEqual([]);
  });

  it("moves the drawing to the corner of its view box", () => {
    const read = readVectorArt(text(model([path(SQUARE)], { viewBox: { x: 10, y: 10, width: 20, height: 20 } })));
    expect(read?.art.shapes[0]?.rings[0]?.[0]).toEqual([0, 0]);
  });

  it("flattens curves into straight runs that start and end where the curve does", () => {
    const read = readVectorArt(text(model([path([["M", 0, 0], ["C", 0, 10, 10, 10, 10, 0], ["Q", 15, -10, 20, 0], ["Z"]])])));
    const ring = read?.art.shapes[0]?.rings[0] ?? [];
    expect(ring.length).toBeGreaterThan(20);
    expect(ring[0]).toEqual([0, 0]);
    expect(ring.at(-1)).toEqual([20, 0]);
    expect(ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it("applies transforms of the path and of the groups round it, and scales a stroke with them", () => {
    const inner = path(SQUARE, { fill: none, stroke: colour("#ff0000"), strokeWidth: 2, transform: [2, 0, 0, 2, 0, 0] });
    const read = readVectorArt(text(model([{ kind: "group", opacity: 1, transform: [1, 0, 0, 1, 5, 0], children: [inner] }])));
    const shape = read?.art.shapes[0];
    expect(shape?.rings[0]?.[0]).toEqual([25, 20]);
    expect(shape?.stroke).toEqual({ colour: "#ff0000", widthMm: 4 });
    expect(shape?.fill).toBeNull();
  });

  it("keeps an open line open and a closed one closed, each with its own stroke", () => {
    const open = path([["M", 0, 0], ["L", 10, 0], ["L", 10, 10]], { fill: none, stroke: colour("#000000"), strokeWidth: 1 });
    const read = readVectorArt(text(model([open])));
    expect(read?.art.shapes[0]).toMatchObject({ fill: null, closed: false });
  });

  it("keeps a hole as a second ring of the same shape", () => {
    const ring = (o: number, s: number) => [["M", o, o], ["L", o + s, o], ["L", o + s, o + s], ["L", o, o + s], ["Z"]];
    const read = readVectorArt(text(model([path([...ring(0, 40), ...ring(10, 20)])])));
    expect(read?.art.shapes).toHaveLength(1);
    expect(read?.art.shapes[0]?.rings).toHaveLength(2);
  });

  it("prints a gradient as one flat colour from its middle and says so", () => {
    const gradient = { type: "linear", id: "g", units: "objectBoundingBox", spread: "pad", x1: 0, y1: 0, x2: 1, y2: 0, stops: [{ offset: 0, hex: "#000000", opacity: 1 }, { offset: 1, hex: "#ffffff", opacity: 1 }] };
    const read = readVectorArt(text(model([path(SQUARE, { fill: { type: "gradient", gradientId: "g", opacity: 1 } })], { gradients: [gradient] })));
    expect(read?.art.shapes[0]?.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(read?.notes).toContain(VECTOR_NOTES.gradient);
  });

  it("leaves off a picture inside the logo, clips and see-through parts, and says what it left", () => {
    const picture = { kind: "image", opacity: 1, x: 0, y: 0, width: 5, height: 5, png: "AAAA" };
    const clipped = path(SQUARE, { clipId: "c" });
    const faded = path(SQUARE, { opacity: 0.5 });
    const read = readVectorArt(text(model([picture, clipped, faded], { clips: [{ id: "c", children: [path(SQUARE)] }] })));
    expect(read?.notes).toEqual(expect.arrayContaining([VECTOR_NOTES.image, VECTOR_NOTES.clip, VECTOR_NOTES.opacity]));
    expect(read?.art.shapes).toHaveLength(2);
  });

  it("says when overlapping parts of one path run the same way, because they are filled by parity here and may show a gap where they cross", () => {
    const square = (o: number, s: number) => [["M", o, o], ["L", o + s, o], ["L", o + s, o + s], ["L", o, o + s], ["Z"]];
    const reverse = (o: number, s: number) => [["M", o, o], ["L", o, o + s], ["L", o + s, o + s], ["L", o + s, o], ["Z"]];
    const overlapping = readVectorArt(text(model([path([...square(0, 20), ...square(10, 20)])])));
    expect(overlapping?.notes).toContain(VECTOR_NOTES.overlap);
    const apart = readVectorArt(text(model([path([...square(0, 10), ...square(30, 10)])])));
    expect(apart?.notes).not.toContain(VECTOR_NOTES.overlap);
    const hole = readVectorArt(text(model([path([...square(0, 40), ...reverse(10, 20)])])));
    expect(hole?.notes).not.toContain(VECTOR_NOTES.overlap);
    const evenOdd = readVectorArt(text(model([path([...square(0, 20), ...square(10, 20)], { fillRule: "evenodd" })])));
    expect(evenOdd?.notes).not.toContain(VECTOR_NOTES.overlap);
  });

  it("refuses a file that is not a vector model, one with nothing to draw, and one too big to keep", () => {
    expect(readVectorArt(text({}))).toBeNull();
    expect(readVectorArt(new TextEncoder().encode("not json"))).toBeNull();
    expect(readVectorArt(text(model([])))).toBeNull();
    expect(readVectorArt(text(model([path(SQUARE, { transform: [1e308, 0, 0, 1e308, 0, 0] })])))).toBeNull();
    const many = Array.from({ length: 2001 }, () => path(SQUARE));
    expect(readVectorArt(text(model(many)))).toBeNull();
  });

  it("ignores a path with no area to draw and a stroke too thin to see (width 0)", () => {
    const read = readVectorArt(text(model([path([["M", 1, 1], ["Z"]]), path(SQUARE, { stroke: colour("#000000"), strokeWidth: 0 })])));
    expect(read?.art.shapes).toHaveLength(1);
    expect(read?.art.shapes[0]?.stroke).toBeNull();
  });
});
