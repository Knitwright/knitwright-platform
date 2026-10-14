import type { LandmarkId, GradedPattern, PatternPiece } from "@/lib/production/contract";
import type { PieceHit, PieceMapper, PointMm, ViewId } from "@/lib/artwork-stack";
import { dot, pointInPolygon, sub, type Pt } from "../geometry/vec";
import { openPiece, type OpenedPiece, type PieceVariant } from "./open-piece";

/** Which pattern piece a view is printed on, and which half of it. */
export interface ViewBinding {
  readonly pieceId: string;
  readonly variant: PieceVariant;
}

export const DEFAULT_BINDINGS: Readonly<Record<ViewId, ViewBinding>> = {
  front: { pieceId: "front", variant: "whole" },
  back: { pieceId: "back", variant: "whole" },
  "sleeve-left": { pieceId: "sleeve", variant: "left" },
  "sleeve-right": { pieceId: "sleeve", variant: "right" },
  collar: { pieceId: "collar", variant: "whole" },
};

const VIEW_ORDER: readonly ViewId[] = ["front", "back", "sleeve-left", "sleeve-right", "collar"];

/** A view's piece for one size, and how its plane sits on it. */
export interface ViewFrame {
  readonly view: ViewId;
  readonly pieceId: string;
  readonly size: string;
  readonly opened: OpenedPiece;
  /** The piece point at the plane's (0, 0). For a body that is the centre line at the chest line. */
  readonly origin: Pt;
  /** Unit vectors, in piece coordinates, of the plane's x axis (to the right) and y axis (down). */
  readonly right: Pt;
  readonly down: Pt;
  /** Added to a plane point to give the design point: the plane's place on the worn sheet (back beside front, sleeves at the shoulders). */
  readonly wornOrigin: Pt;
}

/** Where rows of a repeat agree across the joins, as a gap in millimetres (0 = they meet). */
export interface RowAgreement {
  readonly sideSeamMm: number;
  readonly shoulderMm: number;
  readonly sleeveShoulderMm: number;
  readonly sleeveUnderarmMm: number;
}

/**
 * The piece mapper W7a declares (`PieceMapper`), plus what the print layout needs. Decision 0034: the piece is the
 * master. Design space is the "worn sheet": the body unrolled around the chest with the back beside the front, the
 * sleeves at the shoulders, so one field runs through a seam. Scale is 1 in every size.
 */
export interface LayoutMapper extends PieceMapper {
  views(size: string): readonly ViewId[];
  frame(view: ViewId, size: string): ViewFrame | null;
  planeToPiece(view: ViewId, point: PointMm, size: string): Pt | null;
  pieceToPlane(view: ViewId, point: Pt, size: string): PointMm | null;
  /** A landmark of the view on the design plane, or undefined when the piece does not have it. */
  landmarkPlane(view: ViewId, id: LandmarkId, size: string): PointMm | undefined;
  rowAgreement(size: string): RowAgreement;
}

export interface MapperInput {
  readonly pattern: GradedPattern;
  /** The size the design plane's worn sheet is laid out from. Its origins are then fixed for every size. */
  readonly baseSize: string;
  readonly bindings?: Readonly<Partial<Record<ViewId, ViewBinding>>>;
}

const rightOf = (down: Pt): Pt => [-down[1], down[0]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const norm = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};

function footOnLine(p: Pt, from: Pt, to: Pt): Pt {
  const d = norm(sub(to, from));
  const t = dot(sub(p, from), d);
  return [from[0] + d[0] * t, from[1] + d[1] * t];
}

interface Basis {
  readonly origin: Pt;
  readonly down: Pt;
}

/** Where a view's plane sits on its piece: the origin, and the direction of "down". Null when the piece lacks what it needs. */
function basisOf(view: ViewId, opened: OpenedPiece): Basis | null {
  const { piece } = opened;
  const l = opened.landmarks;
  if (view === "front" || view === "back") {
    const hem = view === "front" ? l["cf-hem"] : l["cb-hem"];
    if (hem === undefined || l.hps === undefined || l.underarm === undefined || piece.foldLine === null) return null;
    // Up runs along the centre line (the fold), toward the neck. The neck point is off the fold, so it only picks the way.
    const along = norm(sub(piece.foldLine.to, piece.foldLine.from));
    const up: Pt = dot(along, sub(l.hps, hem)) >= 0 ? along : [-along[0], -along[1]];
    return { origin: footOnLine(l.underarm, piece.foldLine.from, piece.foldLine.to), down: [-up[0], -up[1]] };
  }
  if (view === "collar") {
    if (piece.foldLine === null) return null;
    const { from, to } = piece.foldLine;
    return { origin: mid(from, to), down: norm(sub(to, from)) };
  }
  const [cap, ua, ub, ha, hb] = [l["cap-top"], l["underarm-a"], l["underarm-b"], l["hem-a"], l["hem-b"]];
  if (cap === undefined || ua === undefined || ub === undefined || ha === undefined || hb === undefined) return null;
  const up = norm(sub(mid(ua, ub), mid(ha, hb)));
  return { origin: cap, down: [-up[0], -up[1]] };
}

const pieceOf = (pattern: GradedPattern, size: string, id: string): PatternPiece | undefined =>
  (Object.hasOwn(pattern.piecesBySize, size) ? pattern.piecesBySize[size] : []).find((p) => p.id === id);

export function createLayoutMapper(input: MapperInput): LayoutMapper {
  const bindings = { ...DEFAULT_BINDINGS, ...input.bindings };
  const cache = new Map<string, ViewFrame | null>();

  const rawFrame = (view: ViewId, size: string, wornOrigin: Pt): ViewFrame | null => {
    const bound = bindings[view];
    const piece = pieceOf(input.pattern, size, bound.pieceId);
    if (piece === undefined) return null;
    const opened = openPiece(piece, bound.variant);
    const basis = basisOf(view, opened);
    if (basis === null) return null;
    return { view, pieceId: piece.id, size, opened, origin: basis.origin, down: basis.down, right: rightOf(basis.down), wornOrigin };
  };

  // The worn sheet is laid out once, from the base size, so it is the same in every size.
  const origins = wornOrigins(input.baseSize, (view, size) => rawFrame(view, size, [0, 0]));

  const frame = (view: ViewId, size: string): ViewFrame | null => {
    const key = `${view}|${size}`;
    if (!cache.has(key)) cache.set(key, rawFrame(view, size, origins[view]));
    return cache.get(key) ?? null;
  };

  const planeToPiece = (view: ViewId, point: PointMm, size: string): Pt | null => {
    const f = frame(view, size);
    if (f === null) return null;
    const [x, y] = [point.x - f.wornOrigin[0], point.y - f.wornOrigin[1]];
    return [f.origin[0] + f.right[0] * x + f.down[0] * y, f.origin[1] + f.right[1] * x + f.down[1] * y];
  };

  const pieceToPlane = (view: ViewId, point: Pt, size: string): PointMm | null => {
    const f = frame(view, size);
    if (f === null) return null;
    const rel = sub(point, f.origin);
    return { x: dot(rel, f.right) + f.wornOrigin[0], y: dot(rel, f.down) + f.wornOrigin[1] };
  };

  const landmarkPlane = (view: ViewId, id: LandmarkId, size: string): PointMm | undefined => {
    const f = frame(view, size);
    const at = f?.opened.landmarks[id];
    return at === undefined ? undefined : (pieceToPlane(view, at, size) ?? undefined);
  };

  return {
    views: (size) => VIEW_ORDER.filter((view) => frame(view, size) !== null),
    frame,
    planeToPiece,
    pieceToPlane,
    landmarkPlane,
    toPiece(view, point, size) {
      const at = planeToPiece(view, point, size);
      const f = frame(view, size);
      if (at === null || f === null || !pointInPolygon(at, f.opened.outline)) return null;
      const hit: PieceHit = { pieceId: f.pieceId, xMm: at[0], yMm: at[1] };
      return hit;
    },
    rowAgreement: (size) => rowAgreementOf(size, landmarkPlane),
  };
}

/** The worn sheet: front at the origin, back one front half and one back half chest to its right, sleeves at the shoulder points, collar at the neck. */
function wornOrigins(baseSize: string, rawFrame: (view: ViewId, size: string) => ViewFrame | null): Record<ViewId, Pt> {
  const origins: Record<ViewId, Pt> = { front: [0, 0], back: [0, 0], "sleeve-left": [0, 0], "sleeve-right": [0, 0], collar: [0, 0] };
  const front = rawFrame("front", baseSize);
  const back = rawFrame("back", baseSize);
  if (front === null) return origins;
  const across = (f: ViewFrame, id: LandmarkId): number => {
    const at = f.opened.landmarks[id];
    return at === undefined ? 0 : Math.abs(dot(sub(at, f.origin), f.right));
  };
  const heightOf = (f: ViewFrame, id: LandmarkId): number => {
    const at = f.opened.landmarks[id];
    return at === undefined ? 0 : dot(sub(at, f.origin), f.down);
  };
  const shoulderAcross = across(front, "shoulder-point");
  const shoulderY = heightOf(front, "shoulder-point");
  origins.back = [back === null ? 0 : across(front, "underarm") + across(back, "underarm"), 0];
  origins["sleeve-left"] = [shoulderAcross, shoulderY];
  origins["sleeve-right"] = [-shoulderAcross, shoulderY];
  origins.collar = [0, heightOf(front, "hps")];
  return origins;
}

function rowAgreementOf(size: string, at: (view: ViewId, id: LandmarkId, size: string) => PointMm | undefined): RowAgreement {
  const gap = (a: PointMm | undefined, b: PointMm | undefined): number => (a === undefined || b === undefined ? 0 : Math.abs(a.y - b.y));
  const sleeveUnderarm = at("sleeve-left", "underarm-a", size);
  return {
    sideSeamMm: gap(at("front", "underarm", size), at("back", "underarm", size)),
    shoulderMm: Math.max(gap(at("front", "hps", size), at("back", "hps", size)), gap(at("front", "shoulder-point", size), at("back", "shoulder-point", size))),
    sleeveShoulderMm: gap(at("sleeve-left", "cap-top", size), at("front", "shoulder-point", size)),
    sleeveUnderarmMm: gap(sleeveUnderarm, at("front", "underarm", size)),
  };
}
