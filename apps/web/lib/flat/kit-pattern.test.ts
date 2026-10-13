import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { KIT_PATTERN_STYLES, type GarmentSpec, type KitPattern, type KitPatternStyle } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { boundsOfPoints, flatten } from "./geometry";
import { clipToConvex, kitPatternElements, PATTERN_FALLBACK, withKitPattern } from "./kit-pattern";
import type { FlatModel, FlatPath, Point, View } from "./model";
import { renderPdfDocument } from "./render-pdf";
import { renderSvg } from "./render-svg";

const NAVY = "#1b2a49";
const GOLD = "#d4af37";

const pattern = (style: KitPatternStyle, patch: Partial<KitPattern> = {}): KitPattern => ({
  style,
  colours: [{ colour: "Gold", swatch: GOLD }],
  provenance: "user-edited",
  ...patch,
});

const navyJersey = (kitPattern?: KitPattern, choices: Readonly<Record<string, string>> = {}): GarmentSpec => {
  const base = designWith("team-jersey", choices, madeUpValues(choices));
  const colours = ["body-front", "body-back", "sleeve-left", "sleeve-right"].map((panelId) => ({
    panelId,
    colour: "Navy",
    swatch: NAVY,
    provenance: "user-edited" as const,
  }));
  return { ...base, colourways: [{ ...base.colourways[0], colours }], ...(kitPattern ? { kitPattern } : {}) };
};

const flat = (spec: GarmentSpec, view: View): FlatModel =>
  buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel;

const panelLayer = (model: FlatModel): FlatPath[] =>
  (model.layers.find((layer) => layer.id === "panels")?.elements ?? []).filter((element): element is FlatPath => element.kind === "path");

const pieces = (model: FlatModel): FlatPath[] => panelLayer(model).filter((path) => path.name.startsWith("Kit pattern"));

const pointsOf = (path: FlatPath): Point[] => flatten(path.commands).flatMap((run) => [...run.points]);

describe("clipping a shape to a convex band", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("keeps only the part inside the band, whichever way the band is wound", () => {
    const band: Point[] = [
      { x: -5, y: 2 },
      { x: 15, y: 2 },
      { x: 15, y: 4 },
      { x: -5, y: 4 },
    ];
    for (const clip of [band, [...band].reverse()]) {
      const kept = clipToConvex(square, clip);
      expect(boundsOfPoints(kept)).toEqual({ minX: 0, minY: 2, maxX: 10, maxY: 4 });
    }
  });

  it("gives nothing when they do not meet", () => {
    const away: Point[] = [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
    ];
    expect(clipToConvex(square, away)).toEqual([]);
  });
});

describe("a kit pattern on the flat drawing", () => {
  it("draws nothing extra for a plain kit", () => {
    expect(pieces(flat(navyJersey(), "front"))).toEqual([]);
  });

  it.each(KIT_PATTERN_STYLES)("draws %s on the front and the back, inside the body, then the body outline again", (style) => {
    for (const view of ["front", "back"] as const) {
      const model = flat(navyJersey(pattern(style)), view);
      const panels = panelLayer(model);
      const bodyIndex = panels.findIndex((path) => path.panelId === `body-${view}`);
      const drawn = pieces(model);
      expect(drawn.length, `${style} ${view}`).toBeGreaterThan(0);
      const body = boundsOfPoints(pointsOf(panels[bodyIndex] as FlatPath));
      for (const piece of drawn) {
        expect(piece.stroke).toBeNull();
        const box = boundsOfPoints(pointsOf(piece));
        expect(box.minX).toBeGreaterThanOrEqual(body.minX - 0.5);
        expect(box.maxX).toBeLessThanOrEqual(body.maxX + 0.5);
        expect(box.minY).toBeGreaterThanOrEqual(body.minY - 0.5);
        expect(box.maxY).toBeLessThanOrEqual(body.maxY + 0.5);
      }
      // Pieces come straight after the body, and then the body's outline is drawn over them.
      expect(panels.indexOf(drawn[0] as FlatPath)).toBe(bodyIndex + 1);
      const outline = panels[bodyIndex + drawn.length + 1] as FlatPath;
      expect(outline.fill).toBeNull();
      expect(outline.stroke).not.toBeNull();
      expect(outline.commands).toEqual(panels[bodyIndex]?.commands);
    }
  });

  it("prints hoops in the pattern colour, bands of the size given", () => {
    const model = flat(navyJersey(pattern("hoops", { size: 1000 })), "front");
    const drawn = pieces(model);
    expect(drawn.every((piece) => piece.fill === GOLD)).toBe(true);
    const heights = drawn.map((piece) => boundsOfPoints(pointsOf(piece))).map((box) => box.maxY - box.minY);
    expect(Math.max(...heights)).toBeCloseTo(1000, 0);
  });

  it("alternates two colours", () => {
    const two = pattern("stripes", { colours: [{ colour: "Gold", swatch: GOLD }, { colour: "White", swatch: "#ffffff" }] });
    const fills = new Set(pieces(flat(navyJersey(two), "front")).map((piece) => piece.fill));
    expect(fills).toEqual(new Set([GOLD, "#ffffff"]));
  });

  it("draws a colour with no swatch in a plain grey", () => {
    const named = pattern("hoops", { colours: [{ colour: "Club gold" }] });
    expect(pieces(flat(navyJersey(named), "front")).every((piece) => piece.fill === PATTERN_FALLBACK)).toBe(true);
  });

  it("runs the sash the other way on the back, as it goes round the body", () => {
    const front = boundsOfPoints(pointsOf(pieces(flat(navyJersey(pattern("sash")), "front"))[0] as FlatPath));
    const back = boundsOfPoints(pointsOf(pieces(flat(navyJersey(pattern("sash")), "back"))[0] as FlatPath));
    const topRight = (model: FlatModel) => {
      const piece = pieces(model)[0] as FlatPath;
      const top = pointsOf(piece).reduce((best, point) => (point.y < best.y ? point : best));
      return top.x;
    };
    expect(front.maxY).toBeGreaterThan(front.minY);
    expect(back.maxY).toBeGreaterThan(back.minY);
    expect(Math.sign(topRight(flat(navyJersey(pattern("sash")), "front")))).toBe(1);
    expect(Math.sign(topRight(flat(navyJersey(pattern("sash")), "back")))).toBe(-1);
  });

  it("keeps side panels below the armhole, on both sides", () => {
    const model = flat(navyJersey(pattern("side-panels")), "front");
    const underarm = model.landmarks["underarm-right"] as Point;
    const drawn = pieces(model);
    expect(drawn).toHaveLength(2);
    for (const piece of drawn) expect(boundsOfPoints(pointsOf(piece)).minY).toBeGreaterThanOrEqual(underarm.y - 0.5);
  });

  it("edges a sash on both sides in a second colour", () => {
    const two = pattern("sash", { colours: [{ colour: "Gold", swatch: GOLD }, { colour: "White", swatch: "#ffffff" }] });
    const drawn = pieces(flat(navyJersey(two), "front"));
    expect(drawn.filter((piece) => piece.fill === GOLD)).toHaveLength(1);
    expect(drawn.filter((piece) => piece.fill === "#ffffff")).toHaveLength(2);
  });

  it("edges side panels in a second colour, on both sides", () => {
    const two = pattern("side-panels", { colours: [{ colour: "Gold", swatch: GOLD }, { colour: "White", swatch: "#ffffff" }] });
    const drawn = pieces(flat(navyJersey(two), "front"));
    expect(drawn.filter((piece) => piece.fill === GOLD)).toHaveLength(2);
    expect(drawn.filter((piece) => piece.fill === "#ffffff")).toHaveLength(2);
  });

  it("puts a chest band above the underarm, with a thin stripe under it in a second colour", () => {
    const model = flat(navyJersey(pattern("chest-band", { colours: [{ colour: "Gold", swatch: GOLD }, { colour: "White", swatch: "#ffffff" }] })), "front");
    const drawn = pieces(model);
    const band = drawn.find((piece) => piece.fill === GOLD) as FlatPath;
    const stripe = drawn.find((piece) => piece.fill === "#ffffff") as FlatPath;
    const bandBox = boundsOfPoints(pointsOf(band));
    const stripeBox = boundsOfPoints(pointsOf(stripe));
    expect(stripeBox.minY).toBeGreaterThan(bandBox.maxY);
    expect(stripeBox.maxY - stripeBox.minY).toBeLessThan(bandBox.maxY - bandBox.minY);
    expect(pieces(flat(navyJersey(pattern("chest-band")), "front"))).toHaveLength(1);
  });

  it("fades from the body colour into the pattern colour, darkest at the hem", () => {
    const drawn = pieces(flat(navyJersey(pattern("fade", { colours: [{ colour: "White", swatch: "#ffffff" }] })), "front"));
    expect(drawn.length).toBeGreaterThan(6);
    expect(drawn.at(-1)?.fill).toBe("#ffffff");
    expect(new Set(drawn.map((piece) => piece.fill)).size).toBeGreaterThan(6);
  });

  it("follows a raglan, curved hem body", () => {
    const choices = { "sleeve-type": "raglan", "hem-shape": "curved" };
    expect(pieces(flat(navyJersey(pattern("hoops"), choices), "back")).length).toBeGreaterThan(0);
  });

  it("is in the SVG and the PDF", async () => {
    const model = flat(navyJersey(pattern("hoops")), "front");
    expect(renderSvg(model)).toContain('data-name="Kit pattern: Hoops"');
    const pdf = await renderToBuffer(renderPdfDocument(model, new Map()));
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("placing a kit pattern on panels directly", () => {
  it("leaves the panels as they are when there is no body to print on", () => {
    const sleeve: FlatPath = { kind: "path", name: "Sleeve", panelId: "sleeve-left", commands: [], fill: NAVY, stroke: null };
    expect(withKitPattern([sleeve], pattern("hoops"), { view: "front", underarm: { x: 2600, y: 2300 } })).toEqual([sleeve]);
  });

  it("gives nothing for a body with no closed outline", () => {
    const open: FlatPath = {
      kind: "path",
      name: "Body",
      panelId: "body-front",
      commands: [
        { op: "M", to: { x: 0, y: 0 } },
        { op: "L", to: { x: 10, y: 0 } },
      ],
      fill: NAVY,
      stroke: null,
    };
    expect(kitPatternElements(pattern("hoops"), open, { view: "front", underarm: { x: 5, y: 5 } })).toEqual([]);
  });
});
