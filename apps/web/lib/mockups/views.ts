import { GARMENT_VIEW_LABELS, MOCKUP_GAP_RULE, type GarmentView, type SceneGap } from "./types";

/**
 * The four sides of the garment F-L1 asks for, and where each one comes from.
 *
 * **What the platform can draw on a server today is the flat drawing** (`lib/flat`, rendered by
 * `lib/images/reference` and `lib/media/studio.ts`): a front and a back, and nothing else. The 3D
 * view of the same garment is built and turned in the browser (`lib/garment3d`, decision 0051), and
 * the turntable the spec asks for is recorded there and uploaded (`lib/media/video/turntable.ts`).
 * There is no 3D rasteriser on the server.
 *
 * So the front and the back are the real drawing, and a three-quarter or a side view is the same
 * drawing **turned about the garment's upright axis**: the width is multiplied by the cosine of the
 * turn, which is what a turn does to a flat face. That is honest about what it is and it is
 * deterministic, but it is not a render of the garment's side, and nothing here pretends it is:
 * every turned view carries its own sentence and a `R-GAP-000` gap, and the card shows both rather
 * than looking ready.
 *
 * The remedy is a server-side render of the 3D model, which belongs to the files-service seam
 * (decision 0070) and is an owner question on this workstream's pull request, not a thing to invent
 * here.
 */

/** How far round the garment is turned for each view, in degrees from the front. */
export const VIEW_TURN_DEGREES: Readonly<Record<GarmentView, number>> = {
  front: 0,
  back: 180,
  "three-quarter": 45,
  side: 90,
};

/** The drawing a view is made from: the front for anything less than a quarter turn past it. */
export const sourceViewOf = (view: GarmentView): "front" | "back" => (VIEW_TURN_DEGREES[view] > 90 ? "back" : "front");

/** True for the two views the server draws straight from the flat, with nothing derived. */
export const isDrawnStraight = (view: GarmentView): boolean => view === "front" || view === "back";

/**
 * The narrowest a turned garment is squeezed to. At a true quarter turn a flat face has no width at
 * all, and a picture of nothing is worse than a narrow one, so the squeeze stops here. A labelled
 * default, not a measurement: it says how a picture looks, never how a garment is shaped.
 */
export const MIN_TURN_WIDTH = 0.14;

export const MIN_TURN_WIDTH_NOTE = "How narrow a turned view is drawn at a quarter turn. A drawing has no side, so the squeeze stops here. Not reviewed by anyone.";

/**
 * How much of its width the garment keeps at this view: the cosine of the turn, never below
 * `MIN_TURN_WIDTH`. One for the front and the back.
 */
export function squeezeFor(view: GarmentView): number {
  const radians = (VIEW_TURN_DEGREES[view] * Math.PI) / 180;
  return Math.max(MIN_TURN_WIDTH, Math.abs(Math.cos(radians)));
}

/** True when the picture has to be mirrored: the back of the garment faces the other way. */
export const isMirrored = (view: GarmentView): boolean => sourceViewOf(view) === "back" && view !== "back";

/** The sentence a turned view carries on the screen, or null for the front and the back. */
export function turnNote(view: GarmentView): string | null {
  if (isDrawnStraight(view)) return null;
  const from = GARMENT_VIEW_LABELS[sourceViewOf(view)].toLowerCase();
  return `The ${GARMENT_VIEW_LABELS[view].toLowerCase()} view is the ${from} drawing turned ${VIEW_TURN_DEGREES[view]}°. A preview of shape and colour, not of fit or drape.`;
}

/** The gap a turned view carries, or null for the front and the back. */
export function viewGap(view: GarmentView): SceneGap | null {
  const note = turnNote(view);
  return note === null ? null : { ruleId: MOCKUP_GAP_RULE, line: `${note} A render of the garment's own ${GARMENT_VIEW_LABELS[view].toLowerCase()} needs the 3D model drawn on the server.` };
}

/**
 * The turn angles of the 360° turntable F-L1 lists among the free mockups, as whole degrees. The
 * clip itself is the video studio's (L5); this is the set of still frames it is made from.
 */
export const TURNTABLE_STEPS = 8;

export function turntableAngles(steps: number = TURNTABLE_STEPS): readonly number[] {
  if (!Number.isInteger(steps) || steps < 2 || steps > 72) {
    throw new RangeError(`A turntable has between 2 and 72 frames; ${steps} was asked for.`);
  }
  return Array.from({ length: steps }, (_, at) => Math.round((at * 360) / steps));
}

/** How much of its width the garment keeps at this angle, and which drawing the frame comes from. */
export function frameAt(degrees: number): { readonly from: "front" | "back"; readonly squeeze: number; readonly mirrored: boolean } {
  const turn = ((degrees % 360) + 360) % 360;
  const from = turn > 90 && turn < 270 ? "back" : "front";
  const squeeze = Math.max(MIN_TURN_WIDTH, Math.abs(Math.cos((turn * Math.PI) / 180)));
  return { from, squeeze, mirrored: from === "back" && turn !== 180 };
}
