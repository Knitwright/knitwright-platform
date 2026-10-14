import type { LandmarkId } from "@/lib/production/contract";
import type { Pt } from "./geometry";
import type { Outline } from "./outline";
import { maskAt } from "./raster";
import { staged, type Staged } from "./types";

/**
 * The landmarks of a garment found from its outline (plan W7d step 4): neck point, shoulder points,
 * underarms, hem corners and sleeve ends. They are shown as handles a person can drag. Only the
 * silhouette is used, so what is found is where the outline turns, not where a seam is.
 */

export type Side = "left" | "centre" | "right";
export type Origin = "found" | "model-guess" | "moved-by-you";

export interface FoundLandmark {
  readonly id: LandmarkId;
  /** Left and right are as seen in the picture. */
  readonly side: Side;
  /** Pixels of the picture. */
  readonly at: Pt;
  readonly confidence: number;
  readonly origin: Origin;
}

export type LandmarkSet = readonly FoundLandmark[];

export interface LandmarkHint {
  readonly id: LandmarkId;
  readonly side: Side;
  readonly at: Pt;
}

export const landmarkAt = (set: LandmarkSet, id: LandmarkId, side: Side): FoundLandmark | undefined =>
  set.find((entry) => entry.id === id && entry.side === side);

const round = (p: Pt): Pt => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
const entry = (id: LandmarkId, side: Side, at: Pt, confidence: number): FoundLandmark => ({ id, side, at: round(at), confidence, origin: "found" });

interface Gap {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** The neck opening: the rows from the top where the centre is empty with garment on both sides. */
function neckGap(outline: Outline, cx: number): Gap | null {
  const { mask, box } = outline;
  const limit = box.y + Math.floor(box.h * 0.4);
  let bottom = -1;
  for (let y = box.y; y < limit; y += 1) {
    if (maskAt(mask, Math.round(cx), y)) break;
    bottom = y;
  }
  if (bottom < box.y) return null;
  const topRow = box.y;
  let left = Math.round(cx);
  let right = Math.round(cx);
  while (left > box.x && !maskAt(mask, left - 1, topRow)) left -= 1;
  while (right < box.x + box.w - 1 && !maskAt(mask, right + 1, topRow)) right += 1;
  const hasShoulders = left > box.x && right < box.x + box.w - 1;
  return hasShoulders ? { left, right: right + 1, bottom: bottom + 1 } : null;
}

const turn = (a: Pt, b: Pt, c: Pt): number => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

/** The angle the outline turns through at b, in radians, always positive. */
function turnAngle(a: Pt, b: Pt, c: Pt): number {
  const first = Math.atan2(b.y - a.y, b.x - a.x);
  const second = Math.atan2(c.y - b.y, c.x - b.x);
  const diff = Math.abs(second - first);
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
}

function signedArea(polygon: readonly Pt[]): number {
  return polygon.reduce((sum, p, i) => sum + (p.x * polygon[(i + 1) % polygon.length].y - polygon[(i + 1) % polygon.length].x * p.y), 0);
}

interface SideResult {
  readonly shoulder: FoundLandmark | null;
  readonly underarm: FoundLandmark | null;
  readonly sleeveEnds: readonly FoundLandmark[];
}

/** The shoulder point, underarm and sleeve ends of one side, from the outline's corners. */
function findSide(outline: Outline, side: "left" | "right", cx: number, hps: Pt | null): SideResult {
  const polygon = outline.polygon;
  const sign = Math.sign(signedArea(polygon)) || 1;
  const sideSign = side === "right" ? 1 : -1;
  const { box } = outline;
  const vertices = polygon.map((at, i) => ({ at, prev: polygon[(i + polygon.length - 1) % polygon.length], next: polygon[(i + 1) % polygon.length] }));
  const mine = vertices.filter((v) => (v.at.x - cx) * sideSign > box.w * 0.08);
  // The outermost corner in the upper half is the sleeve end; with no sleeve it is the shoulder.
  const upper = mine.filter((v) => v.at.y < box.y + box.h * 0.6);
  const outer = [...upper].sort((a, b) => (b.at.x - a.at.x) * sideSign || a.at.y - b.at.y)[0];
  const sleeveEnds: FoundLandmark[] = [];
  if (outer) {
    const other = [outer.prev, outer.next].sort((a, b) => b.y - a.y)[0];
    sleeveEnds.push(entry("hem-a", side, outer.at, 0.7), entry("hem-b", side, other, 0.7));
  }
  const reflex = mine
    .filter((v) => v.at.y > box.y + box.h * 0.08 && v.at.y < box.y + box.h * 0.8 && turn(v.prev, v.at, v.next) * sign < 0)
    .sort((a, b) => turnAngle(b.prev, b.at, b.next) - turnAngle(a.prev, a.at, a.next))[0];
  const underarm = reflex ? entry("underarm", side, reflex.at, 0.85) : null;
  let shoulder: FoundLandmark | null = null;
  if (outer && hps) {
    const between = upper.filter((v) => v !== outer && (v.at.x - hps.x) * sideSign > 0 && v.at.y < outer.at.y + 1 && Math.hypot(v.at.x - hps.x, v.at.y - hps.y) > 8);
    const bend = between.sort((a, b) => turnAngle(b.prev, b.at, b.next) - turnAngle(a.prev, a.at, a.next))[0];
    shoulder = bend && turnAngle(bend.prev, bend.at, bend.next) > 0.1
      ? entry("shoulder-point", side, bend.at, 0.8)
      : entry("shoulder-point", side, { x: hps.x + (outer.at.x - hps.x) * 0.55, y: hps.y + (outer.at.y - hps.y) * 0.55 }, 0.35);
  }
  return { shoulder, underarm, sleeveEnds };
}

const NEEDED: readonly (readonly [LandmarkId, Side])[] = [
  ["hps", "left"], ["hps", "right"], ["cf-neck", "centre"], ["shoulder-point", "left"], ["shoulder-point", "right"],
  ["underarm", "left"], ["underarm", "right"], ["side-hem", "left"], ["side-hem", "right"], ["cf-hem", "centre"],
];

/** Where a hint is used: to fill a landmark the outline did not give, or to add a little trust when it agrees. */
function withHints(found: readonly FoundLandmark[], hints: readonly LandmarkHint[], radius: number): FoundLandmark[] {
  const result = [...found];
  for (const hint of hints) {
    const at = result.findIndex((e) => e.id === hint.id && e.side === hint.side);
    if (at === -1) {
      result.push({ id: hint.id, side: hint.side, at: round(hint.at), confidence: 0.3, origin: "model-guess" });
    } else if (Math.hypot(result[at].at.x - hint.at.x, result[at].at.y - hint.at.y) <= radius) {
      result[at] = { ...result[at], confidence: Math.min(1, result[at].confidence + 0.1) };
    }
  }
  return result;
}

/** Finds the landmarks of a front or back flat from its outline. Seeded by the reading's guesses where given. */
export function findLandmarks(outline: Outline, hints: readonly LandmarkHint[] = []): Staged<LandmarkSet> {
  const { box } = outline;
  const cx = box.x + box.w / 2;
  const gap = neckGap(outline, cx);
  const found: FoundLandmark[] = [];
  const hpsLeft = gap ? { x: gap.left, y: box.y } : null;
  const hpsRight = gap ? { x: gap.right, y: box.y } : null;
  if (gap && hpsLeft && hpsRight) {
    found.push(entry("hps", "left", hpsLeft, 0.9), entry("hps", "right", hpsRight, 0.9));
    found.push(entry("cf-neck", "centre", { x: (gap.left + gap.right) / 2, y: gap.bottom }, 0.85));
  }
  for (const [side, hps] of [["left", hpsLeft], ["right", hpsRight]] as const) {
    const result = findSide(outline, side, cx, hps);
    for (const landmark of [result.shoulder, result.underarm, ...result.sleeveEnds]) if (landmark) found.push(landmark);
  }
  const bottom = box.y + box.h - 1;
  const row = (side: "left" | "right"): Pt => {
    let x = side === "left" ? box.x : box.x + box.w - 1;
    while (!maskAt(outline.mask, x, bottom)) x += side === "left" ? 1 : -1;
    return { x: side === "left" ? x : x + 1, y: bottom + 1 };
  };
  found.push(entry("side-hem", "left", row("left"), 0.85), entry("side-hem", "right", row("right"), 0.85));
  found.push(entry("cf-hem", "centre", { x: cx, y: bottom + 1 }, 0.8));
  const all = withHints(found, hints, box.w * 0.08);
  const missing = NEEDED.filter(([id, side]) => !all.some((e) => e.id === id && e.side === side));
  const weak = NEEDED.filter(([id, side]) => all.some((e) => e.id === id && e.side === side && (e.confidence < 0.5)));
  const score = NEEDED.reduce((sum, [id, side]) => sum + (landmarkAt(all, id, side)?.confidence ?? 0), 0) / NEEDED.length;
  const notes: string[] = [];
  if (!gap) notes.push("The neck opening is not visible in the picture, so the neck points are left out. Drag them into place if you can see where they go.");
  if (missing.length > 0 && gap) notes.push("Some landmarks could not be found. Drag them into place.");
  if (weak.length > 0) notes.push("Some landmarks are only a guess. Check them.");
  return staged(all, score, notes.length > 0 ? notes.join(" ") : "The neck, shoulders, underarms and hem were found from the outline.");
}

/** Moves or adds handles. A handle a person moved is theirs: it is marked so and fully trusted. The old set is not changed. */
export function applyHandleEdits(set: LandmarkSet, edits: readonly LandmarkHint[]): LandmarkSet {
  const next = set.filter((e) => !edits.some((edit) => edit.id === e.id && edit.side === e.side));
  return [...next, ...edits.map((edit): FoundLandmark => ({ id: edit.id, side: edit.side, at: round(edit.at), confidence: 1, origin: "moved-by-you" }))];
}
