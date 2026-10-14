import sharp from "sharp";
import type { DisplayList, DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import { getGenerator } from "@/lib/pattern-generators";
import { fitView, type ViewFit } from "../fit";
import type { Raster } from "../raster";
import { renderTee, TEE_OUTLINE, TEE_TRUTH } from "./synthetic";
import { SYNTHETIC_TEMPLATE } from "./template";

/**
 * Pictures made from known stacks: a pattern is drawn by one of W7c's generators with settings that are written
 * down in the test, then painted onto a flat or a tee. The truth is the settings, so what the matcher reads back can
 * be compared with it. Deterministic: no random numbers, no dates.
 */

export const generatorOf = (id: string): PatternGenerator => {
  const found = getGenerator(id);
  if (!found) throw new Error(`No generator ${id}`);
  return found;
};

export interface KnownPattern {
  readonly generatorId: string;
  readonly params: Readonly<Record<string, number | boolean>>;
  readonly colours: readonly string[];
  readonly ground: string;
  readonly seed?: number;
  readonly datum?: { readonly x: number; readonly y: number };
}

/** The pattern's display list over a rectangle of design millimetres. */
export function drawKnown(pattern: KnownPattern, bounds: { minX: number; minY: number; maxX: number; maxY: number }): DisplayList {
  return generatorOf(pattern.generatorId).render({
    view: "front",
    bounds,
    landmarks: {},
    datum: pattern.datum ?? { x: 0, y: 0 },
    colours: pattern.colours,
    ground: pattern.ground,
    params: pattern.params,
    seed: pattern.seed ?? 0,
  });
}

const shapeSvg = (shape: DisplayShape, at: (x: number, y: number) => [number, number], size: (mm: number) => number): string => {
  if (shape.kind === "circle") {
    const [cx, cy] = at(shape.centre.x, shape.centre.y);
    return `<circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="${size(shape.radius).toFixed(3)}" fill="${shape.fill}"/>`;
  }
  return `<polygon points="${shape.points.map((p) => at(p.x, p.y).map((v) => v.toFixed(3)).join(",")).join(" ")}" fill="${shape.fill}"/>`;
};

/** A flat, in design space: pixel (i, j) is the point (originX + i * step, originY + j * step), painted with anti-aliasing as a photo would be. */
export async function renderFlat(list: DisplayList, frame: { width: number; height: number; step: number; originX: number; originY: number }, ground: string): Promise<Raster> {
  const at = (x: number, y: number): [number, number] => [(x - frame.originX) / frame.step, (y - frame.originY) / frame.step];
  const body = list.shapes.map((s) => shapeSvg(s, at, (mm) => mm / frame.step)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><rect width="100%" height="100%" fill="${ground}"/>${body}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

/** A tile of `tile` pixels cut from the top left of a flat, laid over a flat of `width` by `height`. This makes a repeat out of a pattern that has none. */
export function repeatTile(flat: Raster, tile: { width: number; height: number }, size: { width: number; height: number }): Raster {
  const data = new Uint8ClampedArray(size.width * size.height * 4);
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      const from = ((y % tile.height) * flat.width + (x % tile.width)) * 4;
      data.set(flat.data.subarray(from, from + 4), (y * size.width + x) * 4);
    }
  }
  return { width: size.width, height: size.height, data };
}

/** The synthetic tee's true fit, from its true landmarks: picture pixels to design millimetres and back. */
export function trueFit(): ViewFit {
  const confidence = Object.fromEntries(Object.keys(TEE_TRUTH).map((id) => [id, 1]));
  const fit = fitView("front", { points: TEE_TRUTH, confidence }, SYNTHETIC_TEMPLATE, "flat");
  if (!fit.ok) throw new Error(fit.reason);
  return fit.fit;
}

/** Design millimetres a tee covers, with room to spare. */
export const TEE_AREA = { minX: -330, minY: -120, maxX: 330, maxY: 420 } as const;

const teePath = TEE_OUTLINE.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";

/** SVG that paints a display list (design millimetres) onto the tee, cut to its outline, through the true fit. */
export function teeOverlay(list: DisplayList, fit: ViewFit): string {
  const [m0, m1, m2, m3, m4, m5] = fit.inverse;
  const body = list.shapes.map((s) => shapeSvg(s, (x, y) => [x, y], (mm) => mm)).join("");
  return `<defs><clipPath id="tee"><path d="${teePath}"/></clipPath></defs><g clip-path="url(#tee)"><g transform="matrix(${m0} ${m3} ${m1} ${m4} ${m2} ${m5})">${body}</g></g>`;
}

const moved = (shape: DisplayShape, dx: number, dy: number): DisplayShape =>
  shape.kind === "circle"
    ? { ...shape, centre: { x: shape.centre.x + dx, y: shape.centre.y + dy } }
    : { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };

/** A display list laid side by side over an area, each copy drawn after the one before, so the whole is a repeat of `tile` millimetres. */
export function tiledList(list: DisplayList, tile: number, area: typeof TEE_AREA): DisplayList {
  const [i0, i1, j0, j1] = [Math.floor(area.minX / tile), Math.ceil(area.maxX / tile), Math.floor(area.minY / tile), Math.ceil(area.maxY / tile)];
  const shapes = Array.from({ length: j1 - j0 }, (_, j) => Array.from({ length: i1 - i0 }, (_, i) => list.shapes.map((s) => moved(s, (i0 + i) * tile, (j0 + j) * tile)))).flat(2);
  return { shapes };
}

/** A front and a back of the same tee side by side, as one 800 by 400 picture, each with the pattern painted on. */
export async function renderSheet(pattern: KnownPattern | DisplayList, garment: string): Promise<Uint8Array> {
  const fit = trueFit();
  const overlay = teeOverlay("shapes" in pattern ? pattern : drawKnown(pattern, TEE_AREA), fit);
  const tee = await renderTee({ garment, extra: overlay });
  const background = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#f2f2f2" } }).png().toBuffer();
  const sheet = await sharp(background)
    .composite([
      { input: Buffer.from(tee.png), left: 0, top: 0 },
      { input: Buffer.from(tee.png), left: 400, top: 0 },
    ])
    .png()
    .toBuffer();
  return new Uint8Array(sheet);
}

export const SHEET_REPLY = {
  kind: "flat",
  garment: "short sleeve tee",
  views: [
    { view: "front", box: { x: 0, y: 0, w: 0.5, h: 1 } },
    { view: "back", box: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  ],
  marks: [],
  colours: ["#c8102e"],
  confidence: 0.9,
};
