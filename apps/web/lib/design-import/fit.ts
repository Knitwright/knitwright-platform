import type { LandmarkId } from "@/lib/production/contract";
import { roundMm, type PieceMapper, type PointMm, type ViewId } from "@/lib/artwork-stack";
import { invert3, solveLinear } from "./linear";
import type { LandmarkTemplate } from "./template";
import type { Raster } from "./raster";
import { clamp01, round2, type LandmarkSet, type PictureKind, type Pt } from "./types";

/**
 * Step 4: fit the landmarks found in the picture to the template's landmarks (decision 0034, the piece is
 * master). A flat or mockup is fitted by an affine map; a photo by a homography from its landmarks first, which
 * takes out the perspective. The map goes from picture pixels to design millimetres, and from there the
 * PieceMapper puts a point on a pattern piece for any size.
 */

export interface ViewFit {
  readonly view: ViewId;
  readonly model: "affine" | "homography";
  /** Picture pixels to design millimetres, row by row. */
  readonly matrix: readonly number[];
  readonly inverse: readonly number[];
  readonly used: readonly LandmarkId[];
  /** How far the fitted landmarks sit from the template's, root mean square. */
  readonly rmsMm: number;
  /** Millimetres of design for one pixel of the picture, at the middle of the garment. */
  readonly mmPerPixel: number;
  readonly confidence: number;
  readonly notes: readonly string[];
}

type FitResult = { readonly ok: true; readonly fit: ViewFit } | { readonly ok: false; readonly reason: string };

export const TOO_FEW_LANDMARKS = "Too few landmarks were found to fit this view to the pattern, so its layers are left empty.";

const apply = (m: readonly number[], x: number, y: number): [number, number] => {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
};

export const toDesign = (fit: ViewFit, p: Pt): PointMm => {
  const [x, y] = apply(fit.matrix, p.x, p.y);
  return { x: roundMm(x), y: roundMm(y) };
};
export const toPicture = (fit: ViewFit, q: PointMm): Pt => {
  const [x, y] = apply(fit.inverse, q.x, q.y);
  return { x, y };
};

interface Pair {
  readonly id: LandmarkId;
  readonly from: Pt;
  readonly to: PointMm;
  readonly weight: number;
}

function affine(pairs: readonly Pair[]): number[] | null {
  const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const [bx, by] = [[0, 0, 0], [0, 0, 0]];
  for (const { from, to, weight } of pairs) {
    const row = [from.x, from.y, 1];
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) normal[i][j] += weight * row[i] * row[j];
      bx[i] += weight * row[i] * to.x;
      by[i] += weight * row[i] * to.y;
    }
  }
  const [px, py] = [solveLinear(normal, bx), solveLinear(normal, by)];
  return px && py ? [...px, ...py, 0, 0, 1] : null;
}

function homography(pairs: readonly Pair[]): number[] | null {
  const normal = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const rhs = new Array<number>(8).fill(0);
  const add = (row: number[], target: number, weight: number): void => {
    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 8; j += 1) normal[i][j] += weight * row[i] * row[j];
      rhs[i] += weight * row[i] * target;
    }
  };
  for (const { from: f, to: t, weight } of pairs) {
    add([f.x, f.y, 1, 0, 0, 0, -f.x * t.x, -f.y * t.x], t.x, weight);
    add([0, 0, 0, f.x, f.y, 1, -f.x * t.y, -f.y * t.y], t.y, weight);
  }
  const h = solveLinear(normal, rhs);
  return h ? [...h, 1] : null;
}

/** Fits one view. `kind` decides the model; a photo with fewer than four landmarks falls back to the affine map and says so. */
export function fitView(
  view: ViewId,
  found: { readonly points: LandmarkSet; readonly confidence: Readonly<Partial<Record<LandmarkId, number>>> },
  template: LandmarkTemplate,
  kind: PictureKind,
): FitResult {
  const wanted = template.landmarks(view);
  const pairs: Pair[] = (Object.keys(wanted) as LandmarkId[]).flatMap((id) => {
    const [from, to] = [found.points[id], wanted[id]];
    return from && to ? [{ id, from, to, weight: Math.max(0.05, found.confidence[id] ?? 0.5) }] : [];
  });
  if (pairs.length < 3) return { ok: false, reason: TOO_FEW_LANDMARKS };
  const notes: string[] = [];
  const photo = kind === "worn-photo";
  const wantHomography = photo && pairs.length >= 4;
  if (photo && !wantHomography) notes.push("Fewer than four landmarks were found, so perspective could not be taken out.");
  let matrix = wantHomography ? homography(pairs) : affine(pairs);
  let model: ViewFit["model"] = wantHomography ? "homography" : "affine";
  if (matrix === null && wantHomography) {
    matrix = affine(pairs);
    model = "affine";
  }
  const inverse = matrix && invert3(matrix);
  if (!matrix || !inverse) return { ok: false, reason: TOO_FEW_LANDMARKS };

  const errors = pairs.map(({ from, to }) => {
    const [x, y] = apply(matrix, from.x, from.y);
    return (x - to.x) ** 2 + (y - to.y) ** 2;
  });
  const rms = Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length);
  const centre = pairs.reduce((acc, p) => ({ x: acc.x + p.from.x / pairs.length, y: acc.y + p.from.y / pairs.length }), { x: 0, y: 0 });
  const [x0, y0] = apply(matrix, centre.x, centre.y);
  const [x1, y1] = apply(matrix, centre.x + 1, centre.y);
  const mmPerPixel = Math.hypot(x1 - x0, y1 - y0);
  const span = Math.max(...pairs.map((p) => Math.hypot(p.to.x - pairs[0].to.x, p.to.y - pairs[0].to.y)), 1);
  const meanSure = pairs.reduce((sum, p) => sum + p.weight, 0) / pairs.length;
  const confidence = clamp01((1 - (rms / span) * 8) * meanSure * (photo ? 0.8 : 1));
  if (photo) notes.push("Photo, approximate: perspective was taken out from the landmarks, but folds and curved fabric were not undone.");
  return {
    ok: true,
    fit: { view, model, matrix, inverse, used: pairs.map((p) => p.id), rmsMm: round2(rms), mmPerPixel, confidence: round2(confidence), notes },
  };
}

/** The share of a picture outline (0 to 1) that lands on a pattern piece for this size. Used to say when a fit is off the piece. */
export function onPieceFraction(fit: ViewFit, outline: readonly Pt[], mapper: PieceMapper, size: string): number {
  if (outline.length === 0) return 0;
  const inside = outline.filter((p) => mapper.toPiece(fit.view, toDesign(fit, p), size) !== null).length;
  return round2(inside / outline.length);
}

/** Resamples the picture into design space: a raster whose pixel (i, j) is the picture at design point (minX + i * step, minY + j * step). Nearest neighbour. */
export function warpToDesign(
  raster: Raster,
  fit: ViewFit,
  area: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
  stepMm: number,
  /** Pixels of `raster` for each pixel of the picture the fit was made on: 1, or more for a larger copy of the same picture. */
  pictureScale = 1,
): Raster {
  const width = Math.max(1, Math.round((area.maxX - area.minX) / stepMm));
  const height = Math.max(1, Math.round((area.maxY - area.minY) / stepMm));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const p = toPicture(fit, { x: area.minX + (i + 0.5) * stepMm, y: area.minY + (j + 0.5) * stepMm });
      const [sx, sy] = [Math.floor(p.x * pictureScale), Math.floor(p.y * pictureScale)];
      const at = (j * width + i) * 4;
      if (sx < 0 || sy < 0 || sx >= raster.width || sy >= raster.height) data.set([0, 0, 0, 0], at);
      else data.set(raster.data.subarray((sy * raster.width + sx) * 4, (sy * raster.width + sx) * 4 + 4), at);
    }
  }
  return { width, height, data };
}
