import type { PointOfMeasure } from "../../definitions";
import { always, onlyWhen, when } from "../shared";
import { TOPS_POINTS_OF_MEASURE } from "../tops/points-of-measure";

const fromTops = (id: string): PointOfMeasure => {
  const found = TOPS_POINTS_OF_MEASURE.find((point) => point.id === id);
  if (!found) throw new Error(`The tops registry has no point of measure "${id}".`);
  return found;
};

const SLEEVED = [when("sleeves", ["short", "long"])];
const SLEEVELESS = [when("sleeves", ["sleeveless"])];
const NO_SLEEVES = "This garment has no sleeves, so there is no sleeve to measure.";
const HAS_SLEEVES = "This garment has sleeves, so it has no straps to measure.";

/** A tops point that applies to a close-fitting garment only when it has sleeves. */
const sleevedFromTops = (id: string): PointOfMeasure => ({ ...fromTops(id), appliesWhen: SLEEVED, unavailableReason: NO_SLEEVES });

/**
 * Points of measure for close-fitting garments: the body and neck points of a top, its sleeve
 * points when there are sleeves, and the points the plan adds for straps, armholes, the back
 * and the underband. Measurements of the finished garment lying flat.
 */
export const CLOSE_FITTING_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  fromTops("chest-width"),
  fromTops("body-length"),
  fromTops("hem-width"),
  always(
    "underbust",
    "Underbust",
    "body",
    "Lay the garment flat with the front facing up. Measure straight across the bottom edge of the underband, from one side to the other, without stretching it.",
  ),
  sleevedFromTops("shoulder-width"),
  sleevedFromTops("sleeve-length"),
  sleevedFromTops("armhole"),
  sleevedFromTops("upper-arm"),
  sleevedFromTops("sleeve-opening"),
  onlyWhen(
    "armhole-depth",
    "Armhole depth",
    "strap",
    "Lay the garment flat with the front facing up. Measure straight down from the top of the shoulder strap, where it meets the neckline, to the lowest point of the armhole edge.",
    SLEEVELESS,
    HAS_SLEEVES,
  ),
  onlyWhen(
    "strap-width",
    "Strap width",
    "strap",
    "Lay the garment flat with the front facing up. Measure straight across one shoulder strap at its narrowest, at a right angle to the length of the strap.",
    SLEEVELESS,
    HAS_SLEEVES,
  ),
  onlyWhen(
    "back-width-narrowest",
    "Back width at the narrowest",
    "strap",
    "Lay the garment flat with the back facing up. Measure straight across the back at its narrowest point, from one armhole edge to the other.",
    SLEEVELESS,
    HAS_SLEEVES,
  ),
  fromTops("neck-width"),
  fromTops("front-neck-drop"),
  fromTops("back-neck-drop"),
];
