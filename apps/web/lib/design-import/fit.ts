import type { LandmarkId } from "@/lib/production/contract";
import type { PieceHit, PieceMapper, PointMm, ViewId } from "@/lib/artwork-stack";
import { applyTransform, fitTransform, rmsError, type Pair, type Pt, type Transform } from "./geometry";
import type { FoundLandmark, LandmarkSet } from "./landmarks";
import type { TemplateLandmarks } from "./template";
import { staged, type Staged } from "./types";

/**
 * Fitting a picture to the template (plan W7d step 4). A flat or a mockup is fitted by a map that keeps
 * straight lines straight (affine); a photo by a perspective map from four landmarks first. The map takes
 * the picture's pixels to design millimetres; the piece mapper (W7a's interface, decision 0034) then says
 * which piece a point lands on in each size.
 */

export type PictureKind = "flat" | "photo";

export interface FittedLandmark {
  readonly id: LandmarkId;
  readonly side: FoundLandmark["side"];
  readonly pixel: Pt;
  readonly mm: PointMm;
}

export interface ViewFit {
  readonly view: ViewId;
  readonly transform: Transform;
  /** The root mean square gap, in millimetres, between where the landmarks went and where the template has them. */
  readonly residualMm: number;
  readonly used: number;
  readonly landmarks: readonly FittedLandmark[];
}

/** The back view names its neck and hem points differently. */
const nameFor = (view: ViewId, id: LandmarkId): LandmarkId => {
  if (view !== "back") return id;
  return id === "cf-neck" ? "cb-neck" : id === "cf-hem" ? "cb-hem" : id;
};

function pairsFor(view: ViewId, landmarks: LandmarkSet, template: TemplateLandmarks): { pairs: Pair[]; fitted: FittedLandmark[]; trust: number[] } {
  const pairs: Pair[] = [];
  const trust: number[] = [];
  const fitted: FittedLandmark[] = [];
  for (const landmark of landmarks) {
    const target = template[nameFor(view, landmark.id)];
    if (!target) continue;
    const mm = { x: landmark.side === "left" ? -target.x : landmark.side === "centre" ? 0 : target.x, y: target.y };
    pairs.push({ from: landmark.at, to: mm });
    trust.push(landmark.confidence);
    fitted.push({ id: landmark.id, side: landmark.side, pixel: landmark.at, mm });
  }
  return { pairs, fitted, trust };
}

const PHOTO_NOTE = "This is a photo, so it is flattened approximately. Folds and angle are not undone.";

export function fitView(options: {
  readonly view: ViewId;
  readonly landmarks: LandmarkSet;
  readonly template: TemplateLandmarks | null;
  readonly kind: PictureKind;
}): Staged<ViewFit | null> {
  const { view, landmarks, template, kind } = options;
  if (!template) return staged(null, 0, `There is no template for the ${view} view, so it is not fitted.`);
  const { pairs, fitted, trust } = pairsFor(view, landmarks, template);
  if (pairs.length < 3) return staged(null, 0, "Too few landmarks were found to fit the picture. Drag the landmarks into place, or use a clearer picture.");
  let transform = fitTransform(pairs, kind === "photo" ? "homography" : "affine");
  const fellBack = kind === "photo" && transform === null;
  if (transform === null) transform = fitTransform(pairs, "affine");
  if (transform === null) return staged(null, 0, "The landmarks lie too close to one line to fit the picture. Drag them into place.");
  const residual = Math.round(rmsError(pairs, transform) * 10) / 10;
  const width = Math.max(...Object.values(template).map((p) => (p ? Math.abs(p.x) : 0))) * 2 || 1;
  const average = trust.reduce((sum, value) => sum + value, 0) / trust.length;
  const confidence = Math.max(0, 1 - (residual / width) * 4) * average;
  const photo = kind === "photo" ? ` ${PHOTO_NOTE}${fellBack ? " Too few landmarks gave a perspective fit, so a flat fit was used." : ""}` : "";
  const note = `Fitted with ${pairs.length} landmarks; they land about ${residual} mm from the template on average, so the drawing is stretched to fit.${photo}`;
  return staged({ view, transform, residualMm: residual, used: pairs.length, landmarks: fitted }, confidence, note);
}

/** The outline, or any points of the picture, in design millimetres. */
export const outlineToDesign = (fit: ViewFit, points: readonly Pt[]): PointMm[] => points.map((p) => applyTransform(fit.transform, p));

export interface PlacedLandmark extends FittedLandmark {
  readonly hit: PieceHit | null;
}

/** Where each landmark lands on a pattern piece in one size. A point on no piece has no hit. */
export function placeOnPieces(mapper: PieceMapper, fit: ViewFit, size: string): PlacedLandmark[] {
  return fit.landmarks.map((landmark) => ({ ...landmark, hit: mapper.toPiece(fit.view, landmark.mm, size) }));
}
