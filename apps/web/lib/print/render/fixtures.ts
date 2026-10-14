import sharp from "sharp";
import type { Blend } from "@/lib/artwork-stack";
import type { Box, FillItem, ImageItem, PieceScene, Ring, StrokeItem } from "@/lib/print/scene";

export const BLEED = 3;

export const rectRing = (minX: number, minY: number, maxX: number, maxY: number): Ring => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
];

export const fill = (layerId: string, rings: readonly Ring[], colour: string, blend: Blend = "normal", opacity = 1): FillItem => ({
  kind: "fill",
  layerId,
  rings,
  colour,
  opacity,
  blend,
});

const CUT_BOX: Box = { minX: 10, minY: 20, maxX: 310, maxY: 220 };

const dots = (): FillItem[] =>
  [0, 1, 2, 3].map((index) => fill("dots", [rectRing(40 + index * 60, 80, 60 + index * 60, 100)], "#112233", "normal", 0.5));

/** A logo with a hole in it, so a ring inside a ring. */
const logo = (): FillItem => fill("logo", [rectRing(120, 120, 200, 180), rectRing(140, 135, 180, 165)], "#cc0000");

const line = (): StrokeItem => ({
  kind: "stroke",
  layerId: "line",
  points: [[20, 30], [150, 60], [290, 30]],
  closed: false,
  widthMm: 1.5,
  colour: "#00aa00",
  opacity: 1,
  blend: "normal",
});

/** A 300 by 200 mm piece with 3 mm bleed: ground, dots, a logo with a hole, a line and a margin note. */
export function vectorScene(overrides: Partial<PieceScene> = {}): PieceScene {
  return {
    instanceId: "front",
    pieceName: "Front (A&B)",
    size: "M",
    playerLabel: null,
    cut: rectRing(10, 20, 310, 220),
    bleed: rectRing(7, 17, 313, 223),
    bleedMm: BLEED,
    cutBox: CUT_BOX,
    dpi: 50,
    items: [fill("ground", [rectRing(7, 17, 313, 223)], "#f0f0f0"), ...dots(), logo(), line()],
    margin: [fill("margin", [rectRing(12, 22, 40, 26)], "#000000")],
    raster: null,
    noteLines: ["Printed at 100 percent", "Café <test> & more"],
    issues: [],
    ...overrides,
  };
}

/** A small see-through picture made with sharp. */
export async function tinyPng(colour: { r: number; g: number; b: number; alpha: number } = { r: 200, g: 30, b: 30, alpha: 0.5 }): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 8, height: 4, channels: 4, background: colour } }).png().toBuffer());
}

export async function imageItem(imageId: string, left: number, blend: Blend = "normal"): Promise<ImageItem> {
  return {
    kind: "image",
    layerId: `pic-${imageId}`,
    imageId,
    png: await tinyPng(),
    widthPx: 8,
    heightPx: 4,
    matrix: [10, 0, 0, -10, left, 140],
    clip: [rectRing(7, 17, 313, 223)],
    opacity: 0.8,
    blend,
  };
}

/** The vector piece with a picture used twice (one imageId) on top of the ground. */
export async function imageScene(): Promise<PieceScene> {
  const base = vectorScene();
  const first = await imageItem("tile", 30);
  const second = await imageItem("tile", 130);
  return { ...base, items: [base.items[0] as FillItem, first, second, ...base.items.slice(1)] };
}

/** A piece whose second layer multiplies, so it is written as one picture. */
export function rasterScene(): PieceScene {
  const base = vectorScene();
  const multiply = fill("shade", [rectRing(50, 50, 250, 150)], "#8888ff", "multiply", 0.9);
  return { ...base, items: [...base.items, multiply], raster: { reason: "multiply" }, dpi: 20 };
}

/** A small well-formedness check: tags nest and close, attributes are quoted. */
export function wellFormed(text: string): boolean {
  const stack: string[] = [];
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g;
  let rest = text;
  for (const match of text.matchAll(tag)) {
    const [whole, closing, name, , selfClosing] = match;
    rest = rest.replace(whole, "");
    if (closing) {
      if (stack.pop() !== name) return false;
    } else if (!selfClosing) stack.push(name ?? "");
  }
  const leftover = rest.replace(/<\/?[^>]*>/g, "").replace(/<[^<]*$/, "");
  return stack.length === 0 && !/<(?![/A-Za-z])/.test(leftover) && !/&(?!amp;|lt;|gt;)/.test(leftover);
}
