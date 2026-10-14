import type { LandmarkId } from "@/lib/production/contract";
import { VIEW_IDS, type ViewId } from "@/lib/artwork-stack";
import type { PointMm } from "@/lib/artwork-stack";
import { IDENTITY, apply, compose, invert, rotation, scaling, translation, type Affine, type Pt } from "../geometry/affine";
import { boundsOf } from "../geometry/polygon";
import type { PieceInstance } from "./instances";

/** Where the named places of each view are in design space. The flat of the design supplies them; see `anchorsFromInstances`. */
export type DesignAnchors = Partial<Record<ViewId, Partial<Record<LandmarkId, PointMm>>>>;

export type FrameBasis = "landmarks" | "bounds";

/**
 * How a piece lies on the design plane. The design plane is a flat-lay seen from the outside: x runs right from the
 * centre line, y runs down, and the chest line (the underarm) is where the view's anchors say.
 * Only a turn and a move are used, never a stretch, so a repeat keeps its size in every size of the pattern,
 * and rows that start on the chest line meet at the side seams and the underarm.
 * The pattern file is read as drawn from the outside, so the turn alone puts the neck at the top.
 */
export interface PieceFrame {
  readonly toDesign: Affine;
  readonly toPiece: Affine;
  readonly basis: FrameBasis;
}

const FLIP_Y = scaling(1, -1);

const at = (a: Pt, b: Pt): Pt => [b[0] - a[0], b[1] - a[1]];
const mean = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** The turn that brings the direction `up` to point up the page. */
const turnUp = (up: Pt): Affine => rotation(Math.PI / 2 - Math.atan2(up[1], up[0]));

function finish(turn: Affine, centre: Pt, chest: Pt, wantX: number, wantY: number, basis: FrameBasis): PieceFrame {
  const upright = compose(FLIP_Y, turn);
  const [cx] = apply(upright, centre);
  const [, cy] = apply(upright, chest);
  const toDesign = compose(translation(wantX - cx, wantY - cy), upright);
  return { toDesign, toPiece: invert(toDesign), basis };
}

function bodyFrame(instance: PieceInstance, anchors: DesignAnchors): PieceFrame | null {
  const lm = instance.piece.landmarks;
  const front = instance.view === "front";
  const neck = lm[front ? "cf-neck" : "cb-neck"];
  const hem = lm[front ? "cf-hem" : "cb-hem"];
  const underarm = lm.underarm;
  if (!neck || !hem || !underarm) return null;
  const mine = anchors[instance.view] ?? {};
  const wantX = mine[front ? "cf-neck" : "cb-neck"]?.x ?? 0;
  return finish(turnUp(at(hem, neck)), hem, underarm, wantX, mine.underarm?.y ?? 0, "landmarks");
}

function sleeveFrame(instance: PieceInstance, anchors: DesignAnchors): PieceFrame | null {
  const lm = instance.piece.landmarks;
  const [hemA, hemB, underA, underB] = [lm["hem-a"], lm["hem-b"], lm["underarm-a"], lm["underarm-b"]];
  if (!hemA || !hemB || !underA || !underB) return null;
  const hemMid = mean(hemA, hemB);
  const underMid = mean(underA, underB);
  const along = at(hemA, hemB);
  const square: Pt = [-along[1], along[0]];
  const toward = at(hemMid, underMid);
  const up: Pt = square[0] * toward[0] + square[1] * toward[1] >= 0 ? square : [-square[0], -square[1]];
  const mine = anchors[instance.view] ?? {};
  const under = [mine["underarm-a"]?.y, mine["underarm-b"]?.y].filter((y): y is number => y !== undefined);
  const wantY = under.length === 0 ? 0 : under.reduce((s, y) => s + y, 0) / under.length;
  return finish(turnUp(up), hemMid, underMid, mine["cap-top"]?.x ?? 0, wantY, "landmarks");
}

/** A piece with no landmarks to go by: stood on its fold line when it has one, centred on its bounds otherwise. */
function boundsFrame(instance: PieceInstance): PieceFrame {
  const fold = instance.piece.foldLine;
  const box = boundsOf(instance.opened);
  const middle: Pt = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  const turn = fold ? turnUp(at(fold.from, fold.to)) : IDENTITY;
  const centre = fold ? mean(fold.from, fold.to) : middle;
  return finish(turn, centre, centre, 0, 0, "bounds");
}

export function frameFor(instance: PieceInstance, anchors: DesignAnchors): PieceFrame {
  const view = instance.view;
  const placed = view === "front" || view === "back" ? bodyFrame(instance, anchors) : view === "collar" ? null : sleeveFrame(instance, anchors);
  return placed ?? boundsFrame(instance);
}

/**
 * The design anchors a pattern implies: each view's landmarks, laid out with the centre line at x = 0 and the chest line
 * at y = 0. A real flat of the design may supply its own; until then the pattern's base size is the design plane.
 */
export function anchorsFromInstances(instances: readonly PieceInstance[]): DesignAnchors {
  const out: Partial<Record<ViewId, Partial<Record<LandmarkId, PointMm>>>> = {};
  for (const view of VIEW_IDS) {
    const instance = instances.find((entry) => entry.view === view);
    if (!instance) continue;
    const { toDesign } = frameFor(instance, {});
    const places = Object.entries(instance.piece.landmarks).map(([name, p]) => {
      const [x, y] = apply(toDesign, p as Pt);
      return [name, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }] as const;
    });
    out[view] = Object.fromEntries(places);
  }
  return out;
}
