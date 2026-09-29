import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Artwork, GarmentSpec } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { readPdf, type PdfFacts } from "./fixtures/pdf-read";
import type { FlatModel } from "./model";
import { pdfPlacement, renderPdfDocument } from "./render-pdf";

/**
 * These tests read back what the PDF actually drew, with a PDF reader, so a renderer that
 * drops a dash pattern, a line width, a turn or a position is noticed.
 */

const FILE = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const WIDTH = 400;
const MARGIN = 40;

const picture = (id: string, patch: Partial<Artwork>): Artwork => ({
  id,
  name: id,
  source: { kind: "file", fileId: FILE },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 600,
  height: 300,
  rotationDegrees: 0,
  technique: "screen-print",
  provenance: "user-edited",
  ...patch,
});

const modelOf = (items: readonly Artwork[], callouts = true): FlatModel => {
  const base = designWith("crew-tee", {}, madeUpValues({}));
  const spec: GarmentSpec = { ...base, artwork: items };
  return buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main", callouts }) as FlatModel;
};

const logo = async () => {
  const bytes = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#22aa44" } }).png().toBuffer();
  return new Map([[FILE, { bytes: new Uint8Array(bytes), contentType: "image/png" as const }]]);
};

const readBack = async (model: FlatModel, withPicture = true): Promise<PdfFacts> => {
  const bytes = await renderToBuffer(renderPdfDocument(model, withPicture ? await logo() : new Map(), { widthPoints: WIDTH, margin: MARGIN }));
  return readPdf(new Uint8Array(bytes));
};

type Matrix = readonly number[];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Applies a new transform on top of the current one, as the PDF `cm` operator does. */
const compose = (add: Matrix, current: Matrix): number[] => {
  const [a, b, c, d, e, f] = add as [number, number, number, number, number, number];
  const [p, q, r, s, t, u] = current as [number, number, number, number, number, number];
  return [a * p + b * r, a * q + b * s, c * p + d * r, c * q + d * s, e * p + f * r + t, e * q + f * s + u];
};

/** Where each picture lands: the transform in force when it is painted, following save and restore. */
const pictureMatrices = (facts: PdfFacts): number[][] => {
  const stack: Matrix[] = [];
  let current: Matrix = IDENTITY;
  const found: number[][] = [];
  for (const operation of facts.operations) {
    if (operation.name === "save") stack.push(current);
    else if (operation.name === "restore") current = stack.pop() ?? IDENTITY;
    else if (operation.name === "transform") current = compose(operation.args as number[], current);
    else if (operation.name === "paintImageXObject") found.push([...current]);
  }
  return found;
};

const angleOf = (matrix: number[]): number => (Math.atan2(matrix[1] as number, matrix[0] as number) * 180) / Math.PI;
const sizeOf = (matrix: number[]): [number, number] => [Math.hypot(matrix[0] as number, matrix[1] as number), Math.hypot(matrix[2] as number, matrix[3] as number)];
const centreOf = (m: number[]): [number, number] => [(m[4] as number) + ((m[0] as number) + (m[2] as number)) / 2, (m[5] as number) + ((m[1] as number) + (m[3] as number)) / 2];

describe("the PDF, read back: lines", () => {
  it("draws the stitching dashed with the model's dash pattern and width at the page scale", async () => {
    const model = modelOf([]);
    const facts = await readBack(model, false);
    const dashes = facts.operations.filter((entry) => entry.name === "setDash").map((entry) => entry.args[0] as number[]);
    const stitched = dashes.filter((pattern) => pattern.length === 2);
    expect(stitched.length).toBeGreaterThan(0);
    expect(stitched[0]).toEqual([16, 10]);
    // The drawing is in the model's units, and the page scale is applied as one transform for both axes.
    const widths = facts.operations.filter((entry) => entry.name === "setLineWidth").map((entry) => entry.args[0] as number);
    for (const wanted of [6, 4, 3]) expect(widths, `width ${wanted}`).toContain(wanted);
  });
});

describe("the PDF, read back: text", () => {
  const model = modelOf([picture("words", { source: { kind: "text", text: "TURNED" }, rotationDegrees: 90, height: 300 })]);
  const scale = pdfPlacement(model, WIDTH).pointsPerUnit;
  const pageX = (x: number) => MARGIN + (x - model.bounds.minX) * scale;

  it("centres a middle anchored label, and ends an end anchored label, on the point in the model", async () => {
    const facts = await readBack(model, false);
    const texts = model.layers.flatMap((layer) => layer.elements).flatMap((element) => (element.kind === "text" ? [element] : []));
    const middle = texts.find((text) => text.text === "Chest width 52.0 cm" && text.anchor === "middle");
    const end = texts.find((text) => text.anchor === "end");
    expect(middle && end).toBeTruthy();
    const found = (text: string) => facts.positions.find((item) => item.text === text);
    const m = found(middle!.text)!;
    const e = found(end!.text)!;
    expect(m.x + m.width / 2).toBeCloseTo(pageX(middle!.at.x), 0);
    expect(e.x + e.width).toBeCloseTo(pageX(end!.at.x), 0);
  });

  it("turns text about its centre point", async () => {
    const facts = await readBack(model, false);
    const turned = facts.positions.find((item) => item.text === "TURNED")!;
    const [a, b] = turned.matrix as [number, number];
    expect(Math.abs((Math.atan2(b, a) * 180) / Math.PI)).toBeCloseTo(90, 0);
    const length = Math.hypot(a, b);
    const middleX = turned.x + (a / length) * (turned.width / 2);
    const middleY = turned.y + (b / length) * (turned.width / 2);
    const source = model.layers.find((layer) => layer.id === "artwork")!.elements[0]!;
    if (source.kind !== "text") throw new Error("Expected text");
    expect(middleX).toBeCloseTo(pageX(source.at.x), 0);
    expect(facts.heightPoints - middleY).toBeCloseTo(MARGIN + (source.at.y - model.bounds.minY) * scale, 0);
  });
});

describe("the PDF, read back: pictures", () => {
  it("draws a picture at the size and turn in the model, from its centre", async () => {
    const model = modelOf([picture("one", { rotationDegrees: 30 }), picture("two", { offsetX: 1000, offsetY: 500, rotationDegrees: 0, width: 800, height: 200 })]);
    const scale = pdfPlacement(model, WIDTH).pointsPerUnit;
    const matrices = pictureMatrices(await readBack(model));
    expect(matrices).toHaveLength(2);
    const [first, second] = matrices as [number[], number[]];
    expect(Math.abs(angleOf(first))).toBeCloseTo(30, 0);
    expect(Math.abs(angleOf(second))).toBeCloseTo(0, 0);
    expect(sizeOf(first)[0]).toBeCloseTo(600 * scale, 0);
    expect(sizeOf(first)[1]).toBeCloseTo(300 * scale, 0);
    expect(sizeOf(second)[0]).toBeCloseTo(800 * scale, 0);
    expect(sizeOf(second)[1]).toBeCloseTo(200 * scale, 0);
    const [x1, y1] = centreOf(first);
    const [x2, y2] = centreOf(second);
    expect(Math.abs(x2 - x1)).toBeCloseTo(1000 * scale, 0);
    expect(Math.abs(y2 - y1)).toBeCloseTo(500 * scale, 0);
  });
});

describe("a picture that is missing", () => {
  it("is drawn as a dashed box, the same one as the SVG draws, and no picture is painted", async () => {
    const countDashes = (facts: PdfFacts) => facts.operations.filter((entry) => entry.name === "setDash").length;
    const without = countDashes(await readBack(modelOf([]), false));
    const facts = await readBack(modelOf([picture("gone", {})]), false);
    expect(pictureMatrices(facts)).toEqual([]);
    expect(countDashes(facts)).toBe(without + 1);
  });
});

describe("a drawing that is not to scale", () => {
  it("prints no size and no scale in the PDF, only the sentence saying so", async () => {
    const spec = designWith("crew-tee", {});
    const model = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" }) as FlatModel;
    const facts = await readBack(model, false);
    expect(facts.text).toContain("Not to scale. Some measurements are missing.");
    expect(facts.text).not.toMatch(/\d\s?(mm|cm)\b/i);
    expect(facts.text).not.toMatch(/\d\s?:\s?\d/);
  });
});
