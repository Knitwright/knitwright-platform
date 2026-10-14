import { describe, expect, it } from "vitest";
import { vectorModelSchema, type VectorModel } from "@/lib/artwork-intake";
import { shapeBounds, shapeArea } from "../geometry/boolean";
import { copyFromModel, encodeVectorCopy, parseVectorCopy, readVectorAsset, ringsOfCopy } from "./vector-asset";

const none = { type: "none" } as const;
const base = { opacity: 1, strokeWidth: 0, lineCap: "butt", lineJoin: "miter", miterLimit: 4, stroke: none, fillRule: "nonzero" } as const;
const square = (x: number, y: number, s: number, hex = "#102a56") => ({ ...base, kind: "path" as const, fill: { type: "colour" as const, hex, opacity: 1 }, segments: [["M", x, y], ["L", x + s, y], ["L", x + s, y + s], ["L", x, y + s], ["Z"]] as const });
const model = (nodes: unknown[], extra: Partial<VectorModel> = {}): VectorModel =>
  vectorModelSchema.parse({ schemaVersion: 1, viewBox: { x: 10, y: 20, width: 100, height: 50 }, statedSizeMm: null, gradients: [], clips: [], nodes, ...extra });

describe("vector copy of a logo", () => {
  it("reads the restricted model: a path becomes a shape, the box moves to the origin, a curve is flattened", () => {
    const circle = { ...base, kind: "path", fill: { type: "colour", hex: "#cc0000", opacity: 1 }, segments: [["M", 60, 45], ["C", 60, 52, 54, 58, 47, 58], ["C", 40, 58, 34, 52, 34, 45], ["C", 34, 38, 40, 32, 47, 32], ["C", 54, 32, 60, 38, 60, 45], ["Z"]] };
    const read = copyFromModel(model([square(10, 20, 20), circle]))!;
    expect(read.copy).toMatchObject({ kind: "vector", width: 100, height: 50 });
    expect(read.notDrawn).toEqual([]);
    const [sq, round] = ringsOfCopy(read.copy);
    expect(shapeBounds(sq.shape)).toMatchObject({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
    expect(round.shape[0].length).toBeGreaterThan(12);
    expect(shapeArea(round.shape)).toBeGreaterThan(Math.PI * 12 * 12 * 0.95);
  });
  it("works groups and transforms through, and folds opacity in", () => {
    const group = { kind: "group", opacity: 0.5, transform: [2, 0, 0, 2, 0, 0], children: [{ ...square(0, 0, 10), opacity: 0.5 }] };
    const read = copyFromModel(model([group], { viewBox: { x: 0, y: 0, width: 100, height: 50 } }))!;
    const [s] = ringsOfCopy(read.copy);
    expect(shapeBounds(s.shape)).toMatchObject({ maxX: 20, maxY: 20 });
    expect(s.opacity).toBeCloseTo(0.25, 9);
  });
  it("says what it does not draw: strokes, gradients, clip paths and pictures", () => {
    const gradient = { id: "g1", type: "linear", units: "objectBoundingBox", spread: "pad", x1: 0, y1: 0, x2: 1, y2: 0, stops: [{ offset: 0, hex: "#112233", opacity: 1 }, { offset: 1, hex: "#ffffff", opacity: 1 }] };
    const nodes = [
      { ...square(0, 0, 5), stroke: { type: "colour", hex: "#000000", opacity: 1 }, strokeWidth: 2 },
      { ...square(5, 5, 5), fill: { type: "gradient", gradientId: "g1", opacity: 1 } },
      { ...square(9, 9, 5), clipId: "c1" },
      { kind: "image", opacity: 1, x: 0, y: 0, width: 5, height: 5, png: "AAAA" },
    ];
    const read = copyFromModel(model(nodes, { gradients: [gradient] as never, clips: [{ id: "c1", children: [square(0, 0, 50)] }] as never }))!;
    expect(read.notDrawn).toEqual(["clip paths", "gradients (drawn as a flat colour)", "outline strokes", "pictures inside the logo"]);
    expect(ringsOfCopy(read.copy)[1].fill).toBe("#112233");
  });
  it("makes an evenodd hole stay a hole and a nonzero overlap one shape", () => {
    const holed = { ...square(0, 0, 20), fillRule: "evenodd", segments: [["M", 0, 0], ["L", 20, 0], ["L", 20, 20], ["L", 0, 20], ["Z"], ["M", 5, 5], ["L", 15, 5], ["L", 15, 15], ["L", 5, 15], ["Z"]] };
    expect(shapeArea(ringsOfCopy(copyFromModel(model([holed]))!.copy)[0].shape)).toBeCloseTo(400 - 100, 6);
    const overlap = { ...square(0, 0, 20), segments: [["M", 0, 0], ["L", 20, 0], ["L", 20, 20], ["L", 0, 20], ["Z"], ["M", 10, 10], ["L", 30, 10], ["L", 30, 30], ["L", 10, 30], ["Z"]] };
    expect(shapeArea(ringsOfCopy(copyFromModel(model([overlap]))!.copy)[0].shape)).toBeCloseTo(400 + 400 - 100, 6);
  });
  it("reads either form from bytes, and nothing else", () => {
    const m = model([square(0, 0, 10)]);
    expect(readVectorAsset(new TextEncoder().encode(JSON.stringify(m)))?.copy.shapes).toHaveLength(1);
    const plain = encodeVectorCopy({ kind: "vector", width: 10, height: 10, shapes: [{ fill: "#000000", rings: [[[0, 0], [1, 0], [1, 1]]] }] });
    expect(parseVectorCopy(plain)?.shapes).toHaveLength(1);
    expect(readVectorAsset(new TextEncoder().encode("{not json"))).toBeNull();
    expect(readVectorAsset(new TextEncoder().encode('{"schemaVersion":1}'))).toBeNull();
    expect(copyFromModel(model([{ ...square(0, 0, 5), fill: none }]))).toBeNull();
  });
});
