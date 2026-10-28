import { need, type Dims } from "../dimensions";
import { pt } from "../chain";
import type { Point } from "../model";
import type { TopsOptions } from "./options";

/** Shares of the chest width for parts of a drawing that have no point of measure. */
const SHOULDER_DROP = 0.07;
export const BAND_WIDTH = 0.04;
export const CUFF_HEIGHT = 0.1;
export const SIDE_PANEL_WIDTH = 0.1;
export const HEM_STITCH_GAP = 0.03;
export const V_SEAM_FACTOR = 1.6;

const MIN_ANGLE = (10 * Math.PI) / 180;
const MAX_ANGLE = (72 * Math.PI) / 180;

/**
 * The parts of a top that do not change between the front and the back: the size of
 * the body, where the armhole and the underarm are, and how the sleeve hangs.
 */
export interface Basis {
  readonly chest: number;
  readonly halfChest: number;
  readonly halfHem: number;
  readonly length: number;
  readonly neckHalf: number;
  /** The width of the neckband, or 0 when a collar takes its place. */
  readonly band: number;
  /** Where the shoulder line begins, at the edge of the neckband. */
  readonly seamX: number;
  /** The top of the armhole seam: the shoulder point, or the neck for a raglan. */
  readonly top: Point;
  readonly underarm: Point;
  /** The direction the top edge of the sleeve runs, as a unit vector, and the one across it. */
  readonly along: Point;
  readonly across: Point;
  readonly sleeveLength: number;
  readonly sleeveOpening: number;
  readonly shoulderHalf: number;
  /** How steeply the shoulder line falls, for each unit it runs outwards. The band ends follow it. */
  readonly shoulderSlope: number;
}

interface BasisResult {
  readonly basis: Basis | null;
  /** Plain sentences saying why the measurements cannot be drawn together. */
  readonly problems: readonly string[];
}

const TOO_WIDE_NECK = "The neck is as wide as the shoulders, so there is no room for a shoulder.";
const SHOULDER_WIDER = "The shoulders are wider than the chest.";
const ARMHOLE_SHORT = "The armhole is too short to reach from the shoulder to the underarm.";
const SLEEVE_ANGLE = "The upper arm and the armhole do not fit together, so the sleeve cannot hang naturally.";
const BODY_SHORT = "The body is too short for the armhole and the neck.";
const HEM_WIDTH = "The hem width is too small compared with the chest.";

/** Draws nothing. Says whether the measurements can be drawn, and works out the basis if so. */
export function basisOf(dims: Dims, options: TopsOptions): BasisResult {
  const d = (id: string): number => need(dims, id);
  const chest = d("chest-width");
  const band = options.collar === "none" ? BAND_WIDTH * chest : 0;
  const neckHalf = d("neck-width") / 2;
  const seamX = neckHalf + band;
  const shoulderHalf = d("shoulder-width") / 2;
  const top = options.raglan ? pt(seamX, 0) : pt(shoulderHalf, SHOULDER_DROP * chest);
  const dx = chest / 2 - top.x;
  const armhole = d("armhole");
  const rise = Math.sqrt(Math.max(armhole * armhole - dx * dx, 0));
  const problems: string[] = [];
  if (!options.raglan && seamX >= shoulderHalf * 0.95) problems.push(TOO_WIDE_NECK);
  if (dx <= 0) problems.push(SHOULDER_WIDER);
  if (armhole <= dx * 1.05 || rise < armhole * 0.35) problems.push(ARMHOLE_SHORT);
  const underarm = pt(chest / 2, top.y + rise);
  const cosine = armhole > 0 ? d("upper-arm") / armhole : 2;
  const angle = cosine <= 1 ? Math.acos(cosine) - Math.atan2(dx, rise) : -1;
  if (!(angle >= MIN_ANGLE && angle <= MAX_ANGLE)) problems.push(SLEEVE_ANGLE);
  if (d("body-length") < underarm.y + 0.15 * chest || d("front-neck-drop") + d("placket-length") > d("body-length") * 0.8) {
    problems.push(BODY_SHORT);
  }
  if (d("hem-width") < 0.4 * chest) problems.push(HEM_WIDTH);
  if (problems.length > 0) return { basis: null, problems };
  return {
    basis: {
      chest,
      halfChest: chest / 2,
      halfHem: d("hem-width") / 2,
      length: d("body-length"),
      neckHalf,
      band,
      seamX,
      top,
      underarm,
      along: pt(Math.cos(angle), Math.sin(angle)),
      across: pt(-Math.sin(angle), Math.cos(angle)),
      sleeveLength: d("sleeve-length"),
      sleeveOpening: d("sleeve-opening"),
      shoulderHalf,
      shoulderSlope: options.raglan ? Math.tan(angle) : top.y / (top.x - seamX),
    },
    problems,
  };
}

export const fitProblems = (dims: Dims, options: TopsOptions): readonly string[] => basisOf(dims, options).problems;
