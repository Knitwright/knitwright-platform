import { simplifyClosed, type Box, type Pt } from "./geometry";
import { createMask, maskAt, rgbDistance, type Mask, type Raster, type Rgb } from "./raster";
import { staged, type Staged } from "./types";

/**
 * Finding the garment in a picture, classical first (plan W7d step 3): the background is the colour the
 * four corners agree on, the garment is the largest connected region that differs from it, and its
 * outline is traced and simplified to a polygon.
 */

const CORNER = 6;
/** How far a pixel's colour must be from the background's to count as garment (red green blue distance). */
const DIFFERENT = 48;
const ALPHA_SOLID = 128;

export const NO_GARMENT_NOTE = "The garment could not be told apart from the background. Use a picture where the garment stands out from a plain background.";

export interface Outline {
  /** The garment's outline, simplified, in the picture's pixels. */
  readonly polygon: readonly Pt[];
  readonly mask: Mask;
  readonly box: Box;
  /** The share of the picture the garment fills. */
  readonly areaShare: number;
}

function cornerColours(raster: Raster): { colour: Rgb; transparent: boolean }[] {
  const origins = [[0, 0], [raster.width - CORNER, 0], [0, raster.height - CORNER], [raster.width - CORNER, raster.height - CORNER]];
  return origins.map(([ox, oy]) => {
    const sum = [0, 0, 0];
    let transparent = 0;
    let count = 0;
    for (let y = Math.max(0, oy); y < Math.min(raster.height, oy + CORNER); y += 1) {
      for (let x = Math.max(0, ox); x < Math.min(raster.width, ox + CORNER); x += 1) {
        const at = (y * raster.width + x) * 4;
        count += 1;
        if (raster.data[at + 3] < ALPHA_SOLID) transparent += 1;
        sum[0] += raster.data[at];
        sum[1] += raster.data[at + 1];
        sum[2] += raster.data[at + 2];
      }
    }
    return { colour: [sum[0] / count, sum[1] / count, sum[2] / count] as Rgb, transparent: transparent > count / 2 };
  });
}

/** Which pixels differ from the background, and how sure we are of the background (the share of corners that agree). */
export function foregroundMask(raster: Raster): { readonly mask: Mask; readonly confidence: number } {
  const corners = cornerColours(raster);
  const transparent = corners.filter((corner) => corner.transparent).length;
  const mask = createMask(raster.width, raster.height);
  if (transparent >= 3) {
    for (let i = 0; i < raster.width * raster.height; i += 1) mask.data[i] = raster.data[i * 4 + 3] >= ALPHA_SOLID ? 1 : 0;
    return { mask, confidence: transparent / 4 };
  }
  const solid = corners.filter((corner) => !corner.transparent);
  const median = [0, 1, 2].map((channel) => [...solid.map((corner) => corner.colour[channel])].sort((a, b) => a - b)[Math.floor(solid.length / 2)]) as unknown as Rgb;
  const agreeing = solid.filter((corner) => rgbDistance(corner.colour, median) <= 30).length;
  for (let i = 0; i < raster.width * raster.height; i += 1) {
    const solidPixel = raster.data[i * 4 + 3] >= ALPHA_SOLID;
    const colour: Rgb = [raster.data[i * 4], raster.data[i * 4 + 1], raster.data[i * 4 + 2]];
    mask.data[i] = solidPixel && rgbDistance(colour, median) > DIFFERENT ? 1 : 0;
  }
  return { mask, confidence: agreeing / 4 };
}

interface Component {
  readonly mask: Mask;
  readonly area: number;
  readonly box: Box;
}

/** Every 4-connected region of a mask, largest first. */
function components(mask: Mask): Component[] {
  const seen = new Uint8Array(mask.data.length);
  const found: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.data.length; start += 1) {
    if (mask.data[start] !== 1 || seen[start] === 1) continue;
    const members: number[] = [];
    let minX = mask.width;
    let minY = mask.height;
    let maxX = 0;
    let maxY = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop() as number;
      members.push(at);
      const x = at % mask.width;
      const y = Math.floor(at / mask.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const next = [x > 0 ? at - 1 : -1, x < mask.width - 1 ? at + 1 : -1, y > 0 ? at - mask.width : -1, y < mask.height - 1 ? at + mask.width : -1];
      for (const n of next) {
        if (n >= 0 && mask.data[n] === 1 && seen[n] === 0) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    const region = createMask(mask.width, mask.height);
    for (const m of members) region.data[m] = 1;
    found.push({ mask: region, area: members.length, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } });
  }
  return found.sort((a, b) => b.area - a.area);
}

export function largestRegion(mask: Mask): { readonly mask: Mask; readonly area: number; readonly total: number } {
  const all = components(mask);
  const total = all.reduce((sum, component) => sum + component.area, 0);
  return all.length === 0 ? { mask: createMask(mask.width, mask.height), area: 0, total: 0 } : { mask: all[0].mask, area: all[0].area, total };
}

/** Background pixels the border cannot reach are inside the garment (a white stripe, a hole). They become garment. */
export function fillHoles(mask: Mask): Mask {
  const outside = new Uint8Array(mask.data.length);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    const at = y * mask.width + x;
    if (mask.data[at] === 0 && outside[at] === 0) {
      outside[at] = 1;
      stack.push(at);
    }
  };
  for (let x = 0; x < mask.width; x += 1) {
    push(x, 0);
    push(x, mask.height - 1);
  }
  for (let y = 0; y < mask.height; y += 1) {
    push(0, y);
    push(mask.width - 1, y);
  }
  while (stack.length > 0) {
    const at = stack.pop() as number;
    const x = at % mask.width;
    const y = Math.floor(at / mask.width);
    if (x > 0) push(x - 1, y);
    if (x < mask.width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < mask.height - 1) push(x, y + 1);
  }
  const filled = createMask(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i += 1) filled.data[i] = outside[i] === 1 ? 0 : 1;
  return filled;
}

// Clockwise on a screen with y down, starting west.
const AROUND: readonly (readonly [number, number])[] = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];

/** The boundary of the first region in reading order, pixel by pixel (Moore neighbour tracing). */
export function traceContour(mask: Mask): Pt[] {
  const first = mask.data.indexOf(1);
  if (first === -1) return [];
  const start: Pt = { x: first % mask.width, y: Math.floor(first / mask.width) };
  const contour: Pt[] = [start];
  let at = start;
  let back = 0;
  for (let step = 0; step < mask.data.length * 4; step += 1) {
    let moved = false;
    for (let k = 1; k <= 8; k += 1) {
      const [dx, dy] = AROUND[(back + k) % 8];
      if (!maskAt(mask, at.x + dx, at.y + dy)) continue;
      const [px, py] = AROUND[(back + k - 1) % 8];
      const next = { x: at.x + dx, y: at.y + dy };
      back = AROUND.findIndex(([ax, ay]) => ax === at.x + px - next.x && ay === at.y + py - next.y);
      at = next;
      moved = true;
      break;
    }
    if (!moved) return contour;
    if (at.x === start.x && at.y === start.y) return contour;
    contour.push(at);
  }
  return contour;
}

const MIN_SHARE = 0.02;
const MAX_SHARE = 0.92;

/** Finds the garment's outline. The value is null, with a plain note, when it cannot. */
export function findOutline(raster: Raster): Staged<Outline | null> {
  const { mask: foreground, confidence: backgroundSure } = foregroundMask(raster);
  const region = largestRegion(foreground);
  const share = region.area / (raster.width * raster.height);
  if (region.area === 0 || share < MIN_SHARE || share > MAX_SHARE) return staged(null, 0, NO_GARMENT_NOTE);
  const solid = fillHoles(region.mask);
  const diagonal = Math.hypot(raster.width, raster.height);
  const polygon = simplifyClosed(traceContour(solid), Math.max(1.5, diagonal * 0.004));
  const rows = solid.data;
  let minX = raster.width;
  let minY = raster.height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i] !== 1) continue;
    const x = i % raster.width;
    const y = Math.floor(i / raster.width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const onePiece = region.area / region.total;
  const confidence = backgroundSure * (onePiece > 0.97 ? 1 : 0.7);
  const note = onePiece > 0.97 ? "The garment's outline was found from the background colour." : "The garment's outline was found, but the picture holds other things too. Check the outline.";
  return staged({ polygon, mask: solid, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }, areaShare: share }, confidence, note);
}

export interface Views {
  readonly boxes: readonly Box[];
  readonly mask: Mask;
}

/** The separate garments in a picture, left to right and then top to bottom. A sheet of views gives several. */
export function separateViews(raster: Raster): Views {
  const { mask } = foregroundMask(raster);
  const all = components(mask);
  if (all.length === 0) return { boxes: [], mask };
  const biggest = all[0].area;
  const real = all.filter((component) => component.area >= biggest * 0.15).slice(0, 5);
  const boxes = real.map((component) => component.box).sort((a, b) => a.x - b.x || a.y - b.y);
  return { boxes, mask };
}
