import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { Artwork, GarmentSpec, KitPattern, NamesAndNumbers } from "@/lib/garment";
import { POLKA_JERSEY_DESIGN } from "@/lib/production/fixtures";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { readPdf } from "./fixtures/pdf-read";
import { boundsOfPoints, flatten } from "./geometry";
import type { FlatModel, FlatPath, Point, View } from "./model";
import { renderPdfDocument } from "./render-pdf";
import { renderSvg } from "./render-svg";

const RED = "#c8102e";
const BLUE = "#1f4fbf";
const WHITE = "#ffffff";
const NAVY = "#1b2a49";
const CREST = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

/** The benchmark jersey's numbers, from the design spec fixture, in tenths of a millimetre. */
const brief = POLKA_JERSEY_DESIGN.kitPattern;
const dotted = (patch: Partial<KitPattern> = {}): KitPattern => ({
  style: "dots",
  colours: [{ colour: "Red", swatch: RED }, { colour: "Royal blue", swatch: BLUE }],
  size: brief.diameterMm * 10,
  dots: { pitch: brief.pitchMm * 10, rowStep: brief.rowStepMm * 10, halfDrop: brief.halfDrop, clearSpace: brief.clearSpaceMm * 10 },
  provenance: "user-edited",
  ...patch,
});

const numbers: NamesAndNumbers = {
  places: [
    { place: "front-number", height: 1000 },
    { place: "back-name" },
    { place: "back-number", height: 2500 },
  ],
  colour: "Navy",
  swatch: NAVY,
  sampleName: "NAME",
  sampleNumber: "10",
  provenance: "user-edited",
};

const sponsor = (patch: Partial<Artwork>): Artwork => ({
  id: "sponsor",
  name: "Sponsor",
  source: { kind: "file", fileId: CREST },
  panelId: "body-front",
  anchor: "lower-front",
  offsetX: 0,
  offsetY: 0,
  width: 3000,
  height: 700,
  rotationDegrees: 0,
  technique: "sublimation",
  provenance: "user-edited",
  ...patch,
});

const jersey = (kitPattern: KitPattern, marks = true, artwork: readonly Artwork[] = []): GarmentSpec => {
  const base = designWith("team-jersey", {}, madeUpValues({}));
  const colours = ["body-front", "body-back", "sleeve-left", "sleeve-right"].map((panelId) => ({
    panelId,
    colour: "White",
    swatch: WHITE,
    provenance: "user-edited" as const,
  }));
  return { ...base, colourways: [{ ...base.colourways[0], colours }], kitPattern, artwork, ...(marks ? { namesAndNumbers: numbers } : {}) };
};

const flat = (spec: GarmentSpec, view: View): FlatModel => buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel;
const dotsOf = (model: FlatModel): FlatPath[] =>
  (model.layers.find((layer) => layer.id === "panels")?.elements ?? []).filter(
    (element): element is FlatPath => element.kind === "path" && element.name.startsWith("Kit pattern"),
  );
const box = (path: FlatPath) => boundsOfPoints(flatten(path.commands).flatMap((run) => [...run.points]));
const centre = (path: FlatPath): Point => {
  const b = box(path);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
};
/** Dots whole inside the body, so their width is the full dot. */
const whole = (path: FlatPath): boolean => Math.abs(box(path).maxX - box(path).minX - 300) < 2 && Math.abs(box(path).maxY - box(path).minY - 300) < 2;

describe("the benchmark polka-dot jersey on the flats", () => {
  it.each(["front", "back"] as const)("draws red and royal blue dots in alternating rows on the %s", (view) => {
    const drawn = dotsOf(flat(jersey(dotted(), false), view)).filter(whole);
    expect(drawn.length).toBeGreaterThan(20);
    const rows = new Map<number, FlatPath[]>();
    for (const dot of drawn) rows.set(Math.round(centre(dot).y), [...(rows.get(Math.round(centre(dot).y)) ?? []), dot]);
    const ys = [...rows.keys()].sort((a, b) => a - b);
    ys.slice(1).forEach((y, at) => expect(y - (ys[at] as number)).toBe(350));
    ys.forEach((y, row) => {
      const dotsInRow = rows.get(y) as FlatPath[];
      const xs = dotsInRow.map((dot) => centre(dot).x).sort((a, b) => a - b);
      // Dots cut by the neckline are not whole, so a gap is a whole number of pitches.
      xs.slice(1).forEach((x, at) => expect(Math.abs(((x - (xs[at] as number)) / 700) % 1) < 0.01 || Math.abs((((x - (xs[at] as number)) / 700) % 1) - 1) < 0.01).toBe(true));
      // Half drop: row A sits on the centre line and takes the first colour; row B is half a pitch off it, in the second.
      const onCentre = Math.abs(Math.abs(xs[0] as number) % 700) < 1 || Math.abs(Math.abs(xs[0] as number) % 700 - 700) < 1;
      expect(onCentre || Math.abs(Math.abs(xs[0] as number) % 700 - 350) < 1).toBe(true);
      expect(new Set(dotsInRow.map((dot) => dot.fill))).toEqual(new Set([onCentre ? RED : BLUE]));
      if (row > 0) expect(dotsInRow[0]?.fill).not.toBe(rows.get(ys[row - 1] as number)?.[0]?.fill);
    });
  });

  it("keeps clear of the number, name, crest and sponsor", () => {
    const marks: Artwork[] = [sponsor({ width: 3000, height: 700 }), sponsor({ id: "crest", anchor: "left-chest", width: 800, height: 800 })];
    const spec = jersey(dotted(), true, marks);
    const front = flat(spec, "front");
    const underarm = (front.landmarks["underarm-right"] as Point).y;
    // Front number: 10 cm tall at the centre of the chest, two digits wide.
    const number = { x: 0, y: 0.62 * underarm };
    const wide = dotsOf(front);
    const near = (dot: FlatPath, at: Point, halfWidth: number, halfHeight: number): boolean =>
      Math.abs(centre(dot).x - at.x) < halfWidth + 150 + 100 && Math.abs(centre(dot).y - at.y) < halfHeight + 150 + 100;
    expect(wide.filter((dot) => near(dot, number, 650, 500))).toEqual([]);
    expect(wide.length).toBeGreaterThan(20);
    const without = dotsOf(flat(jersey(dotted(), false), "front"));
    expect(without.length).toBeGreaterThan(wide.length);
    const back = dotsOf(flat(spec, "back"));
    expect(back.length).toBeLessThan(dotsOf(flat(jersey(dotted(), false), "back")).length);
  });

  it("draws each colour from the design's colours, and a lone colour on every row", () => {
    const one = dotsOf(flat(jersey(dotted({ colours: [{ colour: "Red", swatch: RED }] }), false), "front"));
    expect(new Set(one.map((dot) => dot.fill))).toEqual(new Set([RED]));
  });

  it("lines the rows up when the design says no half drop", () => {
    const plain = dotsOf(flat(jersey(dotted({ dots: { pitch: 700, rowStep: 350, halfDrop: false } }), false), "front")).filter(whole);
    const top = new Set(plain.map((dot) => Math.round(centre(dot).x / 10)));
    const rowCount = new Set(plain.map((dot) => Math.round(centre(dot).y))).size;
    expect(rowCount).toBeGreaterThan(2);
    expect([...top].every((x) => Math.abs(((x * 10) % 700 + 700) % 700) < 11 || Math.abs(((x * 10) % 700 + 700) % 700 - 700) < 11)).toBe(true);
  });

  it("draws a design with no spacing given at the stand-in spacing, without showing it as a measurement", () => {
    const bare = dotsOf(flat(jersey({ style: "dots", colours: [{ colour: "Red", swatch: RED }], provenance: "user-edited" }, false), "front"));
    expect(bare.length).toBeGreaterThan(10);
  });

  it("is the same every time", () => {
    const spec = jersey(dotted());
    expect(renderSvg(flat(spec, "front"))).toBe(renderSvg(flat(spec, "front")));
  });

  it("reads back from the SVG with both colours and the pattern's name", () => {
    const svg = renderSvg(flat(jersey(dotted(), false), "front"));
    expect(svg).toContain('data-name="Kit pattern: Polka dots"');
    expect(svg).toContain(`fill="${RED}"`);
    expect(svg).toContain(`fill="${BLUE}"`);
  });

  it.each(["front", "back"] as const)("reads back from the PDF on the %s with both colours", async (view) => {
    const model = flat(jersey(dotted(), false), view);
    const facts = await readPdf(new Uint8Array(await renderToBuffer(renderPdfDocument(model, new Map()))));
    const fills = facts.operations.filter((operation) => operation.name === "setFillRGBColor").map((operation) => String(operation.args[0]).toLowerCase());
    expect(fills).toContain(RED);
    expect(fills).toContain(BLUE);
    expect(fills.filter((fill) => fill === RED).length).toBeGreaterThan(5);
    expect(fills.filter((fill) => fill === BLUE).length).toBeGreaterThan(5);
  });
});
