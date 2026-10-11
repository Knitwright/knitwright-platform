import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { GarmentSpec, NamesAndNumbers } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { madeUpFamilyValues } from "./fixtures/family-designs";
import { readPdf } from "./fixtures/pdf-read";
import type { FlatModel, FlatText, View } from "./model";
import { playerMarkElements } from "./player-marks";
import { renderPdfDocument } from "./render-pdf";
import { renderSvg } from "./render-svg";

const marks = (patch: Partial<NamesAndNumbers> = {}): NamesAndNumbers => ({
  places: [{ place: "back-name" }, { place: "back-number" }, { place: "front-number" }],
  colour: "Gold",
  swatch: "#d4a017",
  sampleName: "SMITH",
  sampleNumber: "7",
  provenance: "user-edited",
  ...patch,
});

const jersey = (namesAndNumbers: NamesAndNumbers): GarmentSpec => ({
  ...designWith("team-jersey", {}, madeUpValues({})),
  namesAndNumbers,
});

const flat = (spec: GarmentSpec, view: View): FlatModel =>
  buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main", callouts: false }) as FlatModel;

const texts = (model: FlatModel): FlatText[] =>
  (model.layers.find((layer) => layer.id === "artwork")?.elements ?? []).filter((element): element is FlatText => element.kind === "text");

const ANCHORS: Readonly<Record<string, { x: number; y: number }>> = {
  "body-back:upper-back": { x: 0, y: 1000 },
  "body-back:centre-back": { x: 0, y: 1300 },
  "body-front:centre-chest": { x: 0, y: 1300 },
};
const anchors = (panelId: string, anchorId: string) => ANCHORS[`${panelId}:${anchorId}`] ?? null;

describe("player names and numbers on the drawing", () => {
  it("draws the sample name and number on the back, and the number on the front, in the colour chosen", () => {
    const spec = jersey(marks());
    expect(texts(flat(spec, "back")).map((text) => text.text)).toEqual(["SMITH", "7"]);
    expect(texts(flat(spec, "front")).map((text) => text.text)).toEqual(["7"]);
    expect(texts(flat(spec, "back")).every((text) => text.colour === "#d4a017")).toBe(true);
  });

  it("puts the back number wholly below the name, even when the anchors are close", () => {
    const [name, number] = playerMarkElements(marks(), "back", anchors) as FlatText[];
    // The baseline sits 0.35 of the size below the middle of the line.
    const middle = (text: FlatText) => text.at.y - text.size * 0.35;
    const nameBottom = middle(name) + name.size / 2;
    const numberTop = middle(number) - number.size / 2;
    expect(numberTop).toBeGreaterThan(nameBottom);
  });

  it("draws a typed height at that height", () => {
    const typed = marks({ places: [{ place: "back-number", height: 2500 }] });
    expect((playerMarkElements(typed, "back", anchors)[0] as FlatText).size).toBe(2500);
  });

  it("draws a number on the leg of shorts", () => {
    const base = designWith("shorts", {}, madeUpFamilyValues("shorts", {}));
    const spec = { ...base, namesAndNumbers: marks({ places: [{ place: "leg-number" }] }) };
    expect(texts(flat(spec, "front")).map((text) => text.text)).toEqual(["7"]);
  });

  it("draws nothing for a design without names and numbers", () => {
    expect(playerMarkElements(undefined, "back", anchors)).toEqual([]);
  });

  it("writes the same samples into the SVG and the PDF", async () => {
    const model = flat(jersey(marks()), "back");
    const svg = renderSvg(model);
    expect(svg).toContain(">SMITH</text>");
    expect(svg).toContain(">7</text>");
    const pdf = await readPdf(new Uint8Array(await renderToBuffer(renderPdfDocument(model, new Map(), { widthPoints: 400, margin: 40 }))));
    expect(pdf.text).toContain("SMITH");
    expect(pdf.text).toContain("7");
  });
});
