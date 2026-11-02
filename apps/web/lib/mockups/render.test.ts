import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import { COLOUR_CHIPS_SHOWN, SIZE_ROWS_SHOWN, TO_BE_CONFIRMED, colourChartSvg, drawCard, sizeChartSvg } from "./charts";
import { AI_SCENE_REFUSED, CARD_MISSING, composeMockup, composeTurntable } from "./compose";
import { MOCKUP_EDGE, canvasFor } from "./crops";
import { NO_DRAWING_LINE, drawGarment, withRoster } from "./garment";
import { backdropLayer, foldedStack, ghostShade, hangerSvg, measured, rgbOf, shadowOf } from "./paint";
import { ALL_MOCKUP_SCENES, deterministicScenes, sceneBySlug } from "./scenes";
import { TURNTABLE_STEPS } from "./views";

/**
 * Drawing a deterministic mockup, and the one number F-L1's acceptance test names:
 * **"Deterministic mockups render in under 5 s, free."**
 *
 * The garment is the design's own flat drawing, so every picture here starts from what the platform
 * drew and nothing calls a model. The pictures are not compared byte for byte: text is drawn with
 * whatever sans-serif the host has, and a font is not something this repository may carry. What is
 * checked is the size, the shape, the backdrop, the placement, and that two runs of one design give
 * the same bytes.
 */

const CREST_ID = "0b4a5b1e-7c7e-4e57-9d6a-3f1a2b3c4d5e";

const design = (): GarmentSpec =>
  ({
    ...start("crew-tee"),
    namesAndNumbers: {
      places: [{ place: "back-name", height: 600 }, { place: "back-number", height: 2000 }],
      colour: "",
      sampleName: "PLAYER",
      sampleNumber: "10",
      provenance: "user-edited",
    },
  }) as unknown as GarmentSpec;

const images = async (): Promise<ImageMap> => {
  const bytes = await sharp({ create: { width: 48, height: 48, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toBuffer();
  return new Map([[CREST_ID, { bytes: new Uint8Array(bytes), contentType: "image/png" as const }]]);
};

const drawings = async (edge = 512) => {
  const made = await drawGarment({ spec: design(), charts: DEFAULT_CHART_SET, images: await images(), edge });
  if (!made) throw new Error("No drawing");
  return made;
};

/** The colour of one pixel, which is how the backdrop and the placement are checked. */
const pixelAt = async (png: Uint8Array, x: number, y: number): Promise<readonly number[]> => {
  const raw = await sharp(Buffer.from(png)).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer();
  return [...raw].slice(0, 3);
};

describe("the garment a mockup is built from", () => {
  it("draws the front and the back of the design with nothing behind them", async () => {
    const made = await drawings(256);
    expect(made.edge).toBe(256);
    for (const png of [made.front, made.back]) {
      const meta = await sharp(Buffer.from(png)).metadata();
      expect(meta.format).toBe("png");
      expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(256);
      expect(meta.hasAlpha).toBe(true);
    }
  });

  it("gives the same bytes twice for one design, so a mockup is reproducible", async () => {
    const [first, second] = await Promise.all([drawings(192), drawings(192)]);
    expect(Buffer.from(first.front).equals(Buffer.from(second.front))).toBe(true);
  });

  it("shows the board's shirt name and number without changing the design", () => {
    const spec = design();
    const shown = withRoster(spec, { name: "SMITH", number: "7" });
    expect(shown.namesAndNumbers?.sampleName).toBe("SMITH");
    expect(shown.namesAndNumbers?.sampleNumber).toBe("7");
    // The design itself is untouched: a mockup never writes a brand's design.
    expect(spec.namesAndNumbers?.sampleName).toBe("PLAYER");
    expect(withRoster(spec, null)).toBe(spec);
    expect(withRoster({ ...spec, namesAndNumbers: undefined } as unknown as GarmentSpec, { name: "SMITH", number: "7" }).namesAndNumbers).toBeUndefined();
  });

  it("draws a different picture for a different name, which is what the roster switcher does", async () => {
    const [plain, named] = await Promise.all([
      drawGarment({ spec: design(), charts: DEFAULT_CHART_SET, edge: 192 }),
      drawGarment({ spec: design(), charts: DEFAULT_CHART_SET, roster: { name: "SMITH", number: "7" }, edge: 192 }),
    ]);
    expect(Buffer.from(plain!.back).equals(Buffer.from(named!.back))).toBe(false);
  });

  it("says plainly when the platform has no drawing of a garment type", async () => {
    const noDrawing = await drawGarment({ spec: { ...design(), typeId: "nothing-like-this" } as unknown as GarmentSpec, charts: DEFAULT_CHART_SET, edge: 128 });
    expect(noDrawing).toBeNull();
    expect(NO_DRAWING_LINE).toContain("no drawing of this garment type");
  });
});

describe("the pieces this workstream paints itself", () => {
  it("reads a hex colour as sharp reads it", () => {
    expect(rgbOf("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgbOf("4a7a3c")).toEqual({ r: 74, g: 122, b: 60 });
  });

  it("paints a flat backdrop and a gradient one at the size asked for", async () => {
    const flat = await backdropLayer(sceneBySlug("product-front")!.backdrop, { width: 40, height: 60 });
    expect(await measured(flat)).toEqual({ width: 40, height: 60 });
    const gradient = await backdropLayer(sceneBySlug("floodlit-pitch")!.backdrop, { width: 40, height: 60 });
    const [top, bottom] = await Promise.all([pixelAt(new Uint8Array(gradient), 20, 1), pixelAt(new Uint8Array(gradient), 20, 58)]);
    expect(top).not.toEqual(bottom);
  });

  it("takes a shadow from the picture's own outline, not from its box", async () => {
    const dot = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 6, height: 6, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(), left: 7, top: 7 }])
      .png()
      .toBuffer();
    const shade = await shadowOf(dot, 2, 0.5);
    expect(await measured(shade)).toEqual({ width: 20, height: 20 });
    const corner = await sharp(shade).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect(corner[3]).toBe(0);
  });

  it("draws a hanger as lines and nothing else", () => {
    const svg = hangerSvg({ width: 100, height: 30 }, "#6b6257");
    expect(svg.toString()).toContain('fill="none"');
    expect(svg.toString()).toContain("#6b6257");
    expect(svg.toString()).not.toContain("<image");
  });

  it("folds the garment into a stack at the size of its slot", async () => {
    const made = await drawings(128);
    const stack = await foldedStack(Buffer.from(made.front), { width: 120, height: 80 });
    expect(await measured(stack)).toEqual({ width: 120, height: 80 });
  });

  it("shades a ghost mannequin from the garment's own picture", async () => {
    const made = await drawings(128);
    const shade = await ghostShade(Buffer.from(made.front), { width: 128, height: 128 });
    expect(await measured(shade)).toEqual({ width: 128, height: 128 });
  });
});

describe("a deterministic mockup", () => {
  it("draws every deterministic scene at the crop it names", async () => {
    const made = await drawings(320);
    for (const scene of deterministicScenes()) {
      if (scene.card !== null) continue;
      const image = await composeMockup({ scene, drawings: made, edge: 256 });
      expect([image.width, image.height], scene.slug).toEqual([canvasFor(image.crop, 256).width, canvasFor(image.crop, 256).height]);
      expect(scene.crops, scene.slug).toContain(image.crop);
      expect(image.provenance, scene.slug).toBe("deterministic");
      expect(image.ruleId, scene.slug).toBe("R-GAP-000");
      expect(image.sceneSlug).toBe(scene.slug);
    }
  }, 60_000);

  it("uses the scene's own backdrop, which a person cannot change", async () => {
    const made = await drawings(256);
    const grass = await composeMockup({ scene: sceneBySlug("flat-lay-grass")!, drawings: made, crop: "1:1", edge: 128 });
    expect(await pixelAt(grass.png, 2, 2)).toEqual([74, 122, 60]);
    const white = await composeMockup({ scene: sceneBySlug("product-front")!, drawings: made, crop: "1:1", edge: 128 });
    expect(await pixelAt(white.png, 2, 2)).toEqual([255, 255, 255]);
  });

  it("carries the note and the gap of a turned view onto the picture itself", async () => {
    const made = await drawings(256);
    const turned = await composeMockup({ scene: sceneBySlug("product-three-quarter")!, drawings: made, edge: 128 });
    expect(turned.notes.some((note) => note.includes("turned 45°"))).toBe(true);
    expect(turned.gaps[0]!.ruleId).toBe("R-GAP-000");
    const straight = await composeMockup({ scene: sceneBySlug("product-front")!, drawings: made, edge: 128 });
    expect(straight.notes).toEqual([]);
    expect(straight.gaps).toEqual([]);
  });

  it("gives the same bytes twice, so a board redrawn is the same picture", async () => {
    const made = await drawings(256);
    const ask = { scene: sceneBySlug("flat-lay-white")!, drawings: made, crop: "1:1" as const, edge: 128 };
    const [first, second] = await Promise.all([composeMockup(ask), composeMockup(ask)]);
    expect(Buffer.from(first.png).equals(Buffer.from(second.png))).toBe(true);
  });

  it("refuses a scene a model runs, rather than drawing half of one", async () => {
    const made = await drawings(128);
    await expect(composeMockup({ scene: sceneBySlug("dojo-mat")!, drawings: made, edge: 128 })).rejects.toThrow(AI_SCENE_REFUSED);
  });

  it("refuses a chart scene with no chart to draw", async () => {
    const made = await drawings(128);
    await expect(composeMockup({ scene: sceneBySlug("size-chart-card")!, drawings: made, edge: 128 })).rejects.toThrow(CARD_MISSING);
  });

  it("draws a chart scene from the card it is given", async () => {
    const made = await drawings(128);
    const card = await drawCard(sizeChartSvg({ title: "Size chart", sizes: ["S", "M"], rows: [{ label: "Chest", values: ["50", null] }], note: "Not reviewed by anyone." }, 256, 256));
    const image = await composeMockup({ scene: sceneBySlug("colour-chart-card")!, drawings: made, card, edge: 128 });
    expect(image.width).toBe(128);
  });

  it("draws every frame of the turntable, each one turned a little further", async () => {
    const made = await drawings(192);
    const frames = await composeTurntable({ scene: sceneBySlug("turntable-360")!, drawings: made, crop: "1:1", edge: 96 });
    expect(frames).toHaveLength(TURNTABLE_STEPS);
    expect(Buffer.from(frames[0]!.png).equals(Buffer.from(frames[2]!.png))).toBe(false);
    expect((await composeTurntable({ scene: sceneBySlug("turntable-360")!, drawings: made, crop: "1:1", edge: 96 }, 2))).toHaveLength(2);
  }, 60_000);
});

describe("the render budget F-L1 names", () => {
  it("draws a product shot at its full size in under five seconds, and spends nothing", async () => {
    const made = await drawings(MOCKUP_EDGE);
    const started = performance.now();
    const image = await composeMockup({ scene: sceneBySlug("ecommerce-white-four-five")!, drawings: made, crop: "4:5", edge: MOCKUP_EDGE });
    const took = performance.now() - started;
    expect(image.height).toBe(MOCKUP_EDGE);
    expect(took, `took ${Math.round(took)} ms`).toBeLessThan(5_000);
  }, 30_000);

  it("draws the busiest scene of all, an eleven-shirt line-up, inside the same budget", async () => {
    // The line-up is an AI scene, so it is drawn here as the deterministic scene it would be if it
    // were one: eleven slots is the most work any scene of 07 can ask for.
    const scene = { ...sceneBySlug("team-line-up-eleven")!, source: "deterministic" as const };
    const made = await drawings(MOCKUP_EDGE);
    const started = performance.now();
    await composeMockup({ scene, drawings: made, crop: "16:9", edge: MOCKUP_EDGE });
    const took = performance.now() - started;
    expect(took, `took ${Math.round(took)} ms`).toBeLessThan(5_000);
  }, 30_000);
});

describe("the two cards F-L1 asks for", () => {
  it("writes a size that was never filled in as To be confirmed, never as a number", () => {
    const svg = sizeChartSvg({ title: "Size chart", sizes: ["S", "M", "L"], rows: [{ label: "Chest", values: ["50", null, "54"] }], note: "Not reviewed by anyone." });
    expect(svg).toContain(TO_BE_CONFIRMED);
    expect(svg).toContain("Chest");
    expect(svg).toContain("Not reviewed by anyone.");
  });

  it("escapes what a brand typed, so a chart cannot carry markup", () => {
    const svg = sizeChartSvg({ title: '<script>"x"</script>', sizes: ["S"], rows: [], note: "a & b" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&amp;");
  });

  it("shows a colour with no swatch as an empty chip with its code, or To be confirmed", () => {
    const svg = colourChartSvg({
      title: "Colour chart",
      swatches: [
        { name: "Club navy", hex: "#0b1f4b", code: "PANTONE-ish" },
        { name: "Trim", hex: null, code: "" },
      ],
      note: "Not reviewed by anyone.",
    });
    expect(svg).toContain("#0b1f4b");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain(TO_BE_CONFIRMED);
  });

  it("stops at the number of chips and rows a card holds", () => {
    const many = Array.from({ length: 20 }, (_, at) => ({ name: `C${at}`, hex: "#111111", code: "x" }));
    const svg = colourChartSvg({ title: "Colour chart", swatches: many, note: "n" });
    expect([...svg.matchAll(/<rect /g)]).toHaveLength(COLOUR_CHIPS_SHOWN + 1);
    expect(SIZE_ROWS_SHOWN).toBeGreaterThan(0);
  });

  it("rasterises a card as a PNG", async () => {
    const png = await drawCard(colourChartSvg({ title: "Colour chart", swatches: [], note: "n" }, 128, 128));
    expect(await measured(Buffer.from(png))).toEqual({ width: 128, height: 128 });
  });
});

describe("every scene in the library", () => {
  it("is either drawn by this workstream or marked for L3, and nothing is left unowned", () => {
    expect(ALL_MOCKUP_SCENES.every((scene) => scene.owner === "L2" || scene.owner === "L3")).toBe(true);
  });
});
