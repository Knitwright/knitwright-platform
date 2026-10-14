import { dist, dot, mid, sub, unit } from "../geometry";
import { foldFrame, lineNote } from "./frame";
import { reading, skip, type Outcome, type SizeSet } from "./types";

/** Points of measure read from the sleeve and the collar. */

const SLEEVE_PLACES = ["underarm-a", "underarm-b", "hem-a", "hem-b", "cap-top"] as const;

export function sleeveReadings(set: SizeSet): Outcome[] {
  const sleeve = set.sleeve;
  const none = (id: string): Outcome => skip(id, "This pattern has no sleeve piece with its landmarks.");
  const ids = ["sleeve-length", "upper-arm", "sleeve-opening", "cap-height", "cap-curve"];
  if (!sleeve || SLEEVE_PLACES.some((name) => !sleeve.landmarks[name])) return ids.map(none);
  const place = (name: (typeof SLEEVE_PLACES)[number]) => sleeve.landmarks[name] as [number, number];
  const note = lineNote(sleeve);
  const underarm = mid(place("underarm-a"), place("underarm-b"));
  const hem = mid(place("hem-a"), place("hem-b"));
  const axis = unit(sub(underarm, hem));
  const caps = (set.seams.get(sleeve.id) ?? []).filter((s) => s.seamId.startsWith("armhole") || s.seamId.startsWith("sleeve-cap"));
  return [
    reading("sleeve-length", dot(sub(place("cap-top"), hem), axis), `On the sleeve, along its length from the top of the cap to the middle of the sleeve opening, ${note}.`),
    reading("upper-arm", dist(place("underarm-a"), place("underarm-b")) / 2, `Across the sleeve at the underarm, halved because the piece is the whole sleeve laid out, ${note}.`),
    reading("sleeve-opening", dist(place("hem-a"), place("hem-b")) / 2, `Across the sleeve at the hem, halved because the piece is the whole sleeve laid out, ${note}.`),
    reading("cap-height", dot(sub(place("cap-top"), underarm), axis), `From the underarm line up to the top of the sleeve cap, ${note}.`),
    caps.length === 2
      ? reading("cap-curve", caps[0].lengthMm + caps[1].lengthMm, `Both halves of the sleeve cap curve, along the line, ${note}.`)
      : skip("cap-curve", "The sleeve cap curve could not be found."),
  ];
}

/** Drawing and rounding can leave a cap a few hundredths short of its armholes; that is no ease, not a stretch. */
const EASE_ROUNDING_MM = 0.5;

/** Ease: how much longer the sleeve cap is than the armholes it is sewn into. Never negative here. */
export function capEase(cap: number | undefined, armholes: number | undefined): Outcome {
  if (cap === undefined || armholes === undefined) return skip("cap-ease", "Needs both the sleeve cap and the armholes.");
  if (cap < armholes - EASE_ROUNDING_MM) return skip("cap-ease", `The sleeve cap is ${(armholes - cap).toFixed(1)} mm shorter than the armholes, so it would be stretched in.`);
  return reading("cap-ease", Math.max(0, cap - armholes), "The sleeve cap curve minus the front and back armhole curves; zero means the sleeve is sewn in without ease.");
}

export function collarReadings(set: SizeSet): Outcome[] {
  const collar = set.collar;
  const frame = collar ? foldFrame(collar) : null;
  if (!collar) return [skip("collar-height", "This pattern has no collar piece."), skip("collar-cut-length", "This pattern has no collar piece.")];
  const along = collar.cutOutline.map((p) => frame?.along(p) ?? p[0]);
  const width = Math.max(...along) - Math.min(...along);
  const far = frame ? Math.max(...collar.cutOutline.map((p) => frame.across(p))) : null;
  const note = lineNote(collar);
  return [
    reading("collar-height", width, `The width of the collar piece as cut, along its fold, ${note}.`),
    far !== null
      ? reading("collar-cut-length", collar.onFold ? 2 * far : far, `The collar piece from its fold to its far end${collar.onFold ? ", doubled because it is cut on the fold" : ""}, ${note}.`)
      : skip("collar-cut-length", "The collar has no fold line to measure its length from."),
  ];
}
