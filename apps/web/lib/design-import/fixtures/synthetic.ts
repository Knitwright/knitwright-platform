import sharp from "sharp";
import type { LandmarkSet, Pt } from "../types";

/**
 * Synthetic pictures made from a known tee, so the truth is known (plan W7d acceptance). Everything here is
 * deterministic: no random numbers, no dates. A tee is drawn on a 400 by 400 canvas, centred at x = 200.
 */

const CANVAS = 400;

const half: readonly Pt[] = [
  { x: 230, y: 40 }, // hps
  { x: 290, y: 55 }, // shoulder point
  { x: 350, y: 95 }, // sleeve top
  { x: 335, y: 140 }, // sleeve cuff, outer
  { x: 285, y: 120 }, // underarm
  { x: 285, y: 330 }, // side hem
];

const mirror = (p: Pt): Pt => ({ x: 400 - p.x, y: p.y });

/** The outline, clockwise from the left neck edge, with the neck dip at the centre. */
export const TEE_OUTLINE: readonly Pt[] = [
  mirror(half[0]),
  { x: 200, y: 70 },
  ...half,
  ...[...half].reverse().map(mirror),
];

export const TEE_TRUTH: LandmarkSet = {
  hps: half[0],
  "shoulder-point": half[1],
  underarm: half[4],
  "cf-neck": { x: 200, y: 70 },
  "cf-hem": { x: 200, y: 330 },
  "side-hem": half[5],
};

interface SyntheticOptions {
  readonly garment?: string;
  readonly background?: string;
  /** A homography strength; 0 is a flat. Above 0 the picture looks like a photo taken from below. */
  readonly keystone?: number;
  /** Baked shading, as in a photo. */
  readonly shading?: boolean;
  /** Extra SVG drawn on the garment, in canvas coordinates. */
  readonly extra?: string;
  /** Words drawn as text on the garment, to test text read as data. */
  readonly words?: string;
}

const project = (p: Pt, g: number): Pt => {
  const w = 1 + g * (p.y - 200);
  return { x: 200 + (p.x - 200) / w, y: 200 + (p.y - 200) / w };
};

export interface Synthetic {
  readonly png: Uint8Array;
  readonly landmarks: LandmarkSet;
  readonly outline: readonly Pt[];
}

export async function renderTee(options: SyntheticOptions = {}): Promise<Synthetic> {
  const { garment = "#c8102e", background = "#f2f2f2", keystone = 0, shading = false, extra = "", words = "" } = options;
  const outline = TEE_OUTLINE.map((p) => project(p, keystone));
  const landmarks = Object.fromEntries(Object.entries(TEE_TRUTH).map(([id, p]) => [id, project(p as Pt, keystone)])) as LandmarkSet;
  const path = outline.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
  const fill = shading ? "url(#shade)" : garment;
  const text = words === "" ? "" : `<text x="120" y="230" font-size="22" fill="#ffffff" font-family="sans-serif">${words}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${garment}" stop-opacity="1"/><stop offset="1" stop-color="${garment}" stop-opacity="0.9"/></linearGradient></defs>
    <rect width="${CANVAS}" height="${CANVAS}" fill="${background}"/>
    <path d="${path}" fill="${fill}"/>${extra}${text}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { png: new Uint8Array(png), landmarks, outline };
}
