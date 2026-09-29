import { renderToBuffer } from "@react-pdf/renderer";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Artwork, GarmentSpec } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { readPdf } from "./fixtures/pdf-read";
import type { FlatModel } from "./model";
import { pdfPlacement, renderPdf, renderPdfDocument } from "./render-pdf";
import { renderSvg } from "./render-svg";

const FILE_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const artwork = (patch: Partial<Artwork>): Artwork => ({
  id: "a1",
  name: "Logo",
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 600,
  height: 400,
  rotationDegrees: 30,
  technique: "screen-print",
  provenance: "user-edited",
  ...patch,
});

function modelFor(typeId: string, choices: Record<string, string>, items: readonly Artwork[] = [], callouts = false): FlatModel {
  const base = designWith(typeId, choices, madeUpValues(choices));
  const spec: GarmentSpec = { ...base, artwork: items };
  const model = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main", callouts });
  if (!model) throw new Error("No drawing");
  return model;
}

/** Every drawn thing under a layer, in order, named by the kind of thing it is. */
function drawnKinds(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(drawnKinds);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ children?: ReactNode; id?: string; d?: string }>;
  const name = typeof element.type === "string" ? element.type : "";
  const own = name === "PATH" ? ["path"] : name === "TEXT" ? ["text"] : name === "IMAGE" ? ["image"] : [];
  return [...own, ...drawnKinds(element.props.children)];
}

function layersOf(node: ReactNode): { id: string; kinds: string[] }[] {
  if (Array.isArray(node)) return node.flatMap(layersOf);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ children?: ReactNode; id?: string }>;
  if (typeof element.props.id === "string" && element.props.id.startsWith("layer-")) {
    return [{ id: element.props.id.slice("layer-".length), kinds: drawnKinds(element.props.children) }];
  }
  return layersOf(element.props.children);
}

const images = async () => {
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#22aa44" } }).png().toBuffer();
  return new Map([[FILE_ID, { bytes: new Uint8Array(bytes), contentType: "image/png" as const }]]);
};

describe("renderPdf draws the same elements as the model", () => {
  it.each([
    ["a plain crew tee", "crew-tee", {}],
    ["a polo with buttons", "polo", { placket: "buttons" }],
    ["a loaded jersey", "team-jersey", { "sleeve-type": "raglan", placket: "zip", "hem-shape": "side-vent", "side-panels": "contrast-insert", cuffs: "rib-cuff" }],
  ])("%s: same number of paths, texts and pictures, in the same order, in every layer", async (_name, typeId, choices) => {
    const items = [artwork({}), artwork({ id: "a2", source: { kind: "text", text: "HOME" }, anchor: "lower-front" })];
    const model = modelFor(typeId, choices, items, true);
    const drawn = layersOf(renderPdf(model, { images: await images(), widthPoints: 500 }));
    expect(drawn.map((entry) => entry.id)).toEqual(model.layers.map((layer) => layer.id));
    for (const [index, layer] of model.layers.entries()) {
      const wanted = layer.elements.map((element) => (element.kind === "path" ? "path" : element.kind === "text" ? "text" : "image"));
      expect(drawn[index]?.kinds, layer.id).toEqual(wanted);
    }
  });

  it("draws the same number of paths, texts and pictures as the SVG", async () => {
    const model = modelFor("crew-tee", {}, [artwork({}), artwork({ id: "a2", source: { kind: "text", text: "HOME" } })], true);
    const svg = renderSvg(model, await images());
    const kinds = layersOf(renderPdf(model, { images: await images(), widthPoints: 500 })).flatMap((entry) => entry.kinds);
    expect(kinds.filter((kind) => kind === "path")).toHaveLength((svg.match(/<path /g) ?? []).length);
    expect(kinds.filter((kind) => kind === "text")).toHaveLength((svg.match(/<text /g) ?? []).length);
    expect(kinds.filter((kind) => kind === "image")).toHaveLength((svg.match(/<image /g) ?? []).length);
  });
});

describe("pdfPlacement", () => {
  it("uses one scale for both axes and keeps the proportions of the drawing", () => {
    const model = modelFor("crew-tee", {});
    const placement = pdfPlacement(model, 500);
    const width = model.bounds.maxX - model.bounds.minX;
    const height = model.bounds.maxY - model.bounds.minY;
    expect(placement.widthPoints / width).toBeCloseTo(placement.heightPoints / height, 9);
    expect(placement.pointsPerUnit).toBeCloseTo(500 / width, 9);
  });
});

describe("renderPdfDocument", () => {
  it("makes a valid A4 PDF holding the callout text, the artwork text as plain text, and a picture", async () => {
    const nasty = "<script>alert(1)</script> & co";
    const model = modelFor("crew-tee", {}, [artwork({}), artwork({ id: "a2", source: { kind: "text", text: nasty }, anchor: "lower-front", rotationDegrees: 0 })], true);
    const bytes = await renderToBuffer(renderPdfDocument(model, await images()));
    const facts = await readPdf(new Uint8Array(bytes));
    expect(facts.startsAsPdf).toBe(true);
    expect(facts.pageCount).toBe(1);
    expect(facts.widthPoints).toBeCloseTo(595.28, 1);
    expect(facts.heightPoints).toBeCloseTo(841.89, 1);
    expect(facts.text).toContain("Chest width 52.0 cm");
    expect(facts.text).toContain(nasty);
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Subtype /Image");
  });

  it("says plainly that the drawing is not to scale, and shows no measurement values", async () => {
    const model = buildFlat({
      spec: designWith("crew-tee", {}),
      measurements: typedIn(designWith("crew-tee", {})),
      view: "front",
      colourwayId: "main",
      callouts: true,
    }) as FlatModel;
    const bytes = await renderToBuffer(renderPdfDocument(model, new Map()));
    const facts = await readPdf(new Uint8Array(bytes));
    expect(facts.text).toContain("Not to scale. Some measurements are missing.");
    expect(facts.text).not.toMatch(/\d\.\d cm/);
  });

  it("puts a label where the model says, so the viewBox origin is honoured", async () => {
    const model = modelFor("crew-tee", {}, [], true);
    const label = model.layers.find((layer) => layer.id === "measurements")?.elements.find((element) => element.kind === "text" && element.text === "Body length 70.0 cm");
    if (label?.kind !== "text") throw new Error("No label");
    const placement = pdfPlacement(model, 400);
    const bytes = await renderToBuffer(renderPdfDocument(model, new Map(), { widthPoints: 400, margin: 40 }));
    const facts = await readPdf(new Uint8Array(bytes));
    const found = facts.positions.find((item) => item.text === "Body length 70.0 cm");
    expect(found).toBeDefined();
    const expectedTop = 40 + (label.at.y - model.bounds.minY) * placement.pointsPerUnit;
    expect(facts.heightPoints - (found?.y ?? 0)).toBeCloseTo(expectedTop, 0);
  });
});
