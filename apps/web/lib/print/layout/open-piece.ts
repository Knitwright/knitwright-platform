import { FillRule, unionD } from "clipper2-ts";
import type { LandmarkId, PatternPiece } from "@/lib/production/contract";
import { mirrorAcross, sub, type Pt } from "../geometry/vec";

/** Which part of the pattern is meant: a piece cut on the fold, or one half of a mirrored pair. */
export type PieceVariant = "whole" | "right" | "left";

export interface OpenedPiece {
  readonly piece: PatternPiece;
  readonly variant: PieceVariant;
  /** The whole cut outline: a piece cut on the fold is opened about its fold line. */
  readonly outline: readonly Pt[];
  /** The landmarks as the pattern states them, moved if the piece was mirrored for the left. */
  readonly landmarks: Readonly<Partial<Record<LandmarkId, Pt>>>;
  /** The same landmarks on the other half of an opened piece. Empty when nothing was opened. */
  readonly mirroredLandmarks: Readonly<Partial<Record<LandmarkId, Pt>>>;
  /** The line the piece was opened about, or the long axis it was mirrored about; null for a whole piece with neither. */
  readonly axis: { readonly from: Pt; readonly to: Pt } | null;
}

const mapLandmarks = (landmarks: PatternPiece["landmarks"], f: (p: Pt) => Pt): Partial<Record<LandmarkId, Pt>> =>
  Object.fromEntries(Object.entries(landmarks).map(([id, at]) => [id, f(at)]));

function openedOutline(half: readonly Pt[], from: Pt, to: Pt): Pt[] {
  const mirrored = half.map((p) => mirrorAcross(p, from, to));
  const toPath = (ring: readonly Pt[]) => ring.map(([x, y]) => ({ x, y }));
  const joined = unionD([toPath(half)], [toPath(mirrored)], FillRule.NonZero, 2);
  const best = joined.reduce<(typeof joined)[number] | undefined>((a, b) => (a !== undefined && a.length >= b.length ? a : b), undefined);
  return (best ?? []).map((p): Pt => [p.x, p.y]);
}

/**
 * Gives the outline a print file is drawn on. A piece cut on the fold is opened by mirroring its outline about the
 * fold line. The ARTWORK is not mirrored: the caller reads it from the design plane across the centre line, so a
 * number stays whole and a pattern runs through. A mirrored pair is two pieces: "right" is as cut, "left" is the
 * mirror image about the long axis of the piece (the line through the cap top along the piece's length).
 */
export function openPiece(piece: PatternPiece, variant: PieceVariant): OpenedPiece {
  if (variant === "whole" && piece.mirroredPair) throw new RangeError(`${piece.name} is a mirrored pair: ask for its right or its left.`);
  if (variant !== "whole" && !piece.mirroredPair) throw new RangeError(`${piece.name} is not a mirrored pair, so it has no ${variant} side.`);
  if (variant === "whole" && piece.onFold && piece.foldLine !== null) {
    const { from, to } = piece.foldLine;
    return {
      piece,
      variant,
      outline: openedOutline(piece.cutOutline, from, to),
      landmarks: piece.landmarks,
      mirroredLandmarks: mapLandmarks(piece.landmarks, (p) => mirrorAcross(p, from, to)),
      axis: { from, to },
    };
  }
  if (variant === "left") {
    const axis = longAxis(piece);
    const flip = (p: Pt): Pt => mirrorAcross(p, axis.from, axis.to);
    return { piece, variant, outline: piece.cutOutline.map(flip), landmarks: mapLandmarks(piece.landmarks, flip), mirroredLandmarks: {}, axis };
  }
  return { piece, variant, outline: piece.cutOutline, landmarks: piece.landmarks, mirroredLandmarks: {}, axis: null };
}

/**
 * The line a mirrored pair is reflected about: through the cap top, along the sleeve's length. The direction is from
 * the middle of the hem to the middle of the underarm line, which is the way the sleeve points; the cap top is only
 * a point on the line.
 */
function longAxis(piece: PatternPiece): { from: Pt; to: Pt } {
  const { "cap-top": cap, "underarm-a": ua, "underarm-b": ub, "hem-a": ha, "hem-b": hb } = piece.landmarks;
  if (cap === undefined || ua === undefined || ub === undefined) {
    throw new RangeError(`${piece.name} needs a cap top and two underarm points to be mirrored.`);
  }
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const underarm = mid(ua, ub);
  const direction = sub(underarm, ha !== undefined && hb !== undefined ? mid(ha, hb) : cap);
  return { from: cap, to: [cap[0] + direction[0], cap[1] + direction[1]] };
}
