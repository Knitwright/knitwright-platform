import type { PointOfMeasure } from "../../definitions";
import { always, onlyWhen, when } from "../shared";

/**
 * Points of measure for bottoms. Like the tops points, these are measurements of the
 * finished garment lying flat, not of the body. The size charts say how big they are.
 */
export const BOTTOMS_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  always(
    "waist-relaxed",
    "Waist, relaxed",
    "waist",
    "Lay the garment flat with the front facing up and let the waistband lie without stretching it. Measure straight across the top edge of the waistband, from one side to the other.",
  ),
  always(
    "waist-stretched",
    "Waist, stretched",
    "waist",
    "Lay the garment flat with the front facing up. Stretch the waistband out as far as it goes without straining the stitches, and measure straight across its top edge, from one side to the other.",
  ),
  always(
    "waistband-height",
    "Waistband height",
    "waist",
    "Lay the garment flat with the front facing up. Measure straight down the waistband at the centre front, from its top edge to the seam that joins it to the legs.",
  ),
  always(
    "hip",
    "Hip",
    "waist",
    "Lay the garment flat with the front facing up. Measure straight across from one side to the other at the fullest part of the seat, where the front seam starts to curve in towards the legs.",
  ),
  always(
    "front-rise",
    "Front rise",
    "rise",
    "Lay the garment flat with the front facing up. Measure along the centre front seam, following its curve, from the point where the legs meet up to the top edge of the waistband.",
  ),
  always(
    "back-rise",
    "Back rise",
    "rise",
    "Lay the garment flat with the back facing up. Measure along the centre back seam, following its curve, from the point where the legs meet up to the top edge of the waistband.",
  ),
  always(
    "thigh",
    "Thigh",
    "leg",
    "Lay the garment flat and smooth out one leg. Measure straight across the leg just below the point where the legs meet, at a right angle to the length of the leg.",
  ),
  onlyWhen(
    "knee",
    "Knee",
    "leg",
    "Lay the garment flat and smooth out one leg. Measure straight across the leg halfway down the inside leg seam, at a right angle to the length of the leg.",
    [when("leg-length", ["cropped", "full"])],
    "A short leg ends above the knee, so there is no knee width to measure.",
  ),
  always(
    "leg-opening",
    "Leg opening",
    "leg",
    "Lay the garment flat and smooth out one leg. Measure straight across the bottom edge of the leg, from edge to edge, without stretching it.",
  ),
  always(
    "inseam",
    "Inside leg",
    "leg",
    "Lay the garment flat and smooth out one leg. Measure along the inside leg seam, from the point where the legs meet down to the bottom edge of the leg.",
  ),
  always(
    "outseam",
    "Outside leg",
    "leg",
    "Lay the garment flat and smooth out one leg. Measure along the outside of the leg, from the top edge of the waistband down to the bottom edge of the leg.",
  ),
];
