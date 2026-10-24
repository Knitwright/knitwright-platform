import type { PointOfMeasure } from "../../definitions";
import { always } from "../shared";

/**
 * Points of measure for socks and caps. Like the others, these are taken on the finished
 * article lying flat. The size charts say how big they are, and none exists yet.
 * Socks use the leg group and caps the body group, so no screen needs a new section.
 */

export const SOCK_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  always(
    "foot-length",
    "Foot length",
    "leg",
    "Lay the sock flat with the heel at the bottom and the sole facing down. Measure along the sole from the back of the heel to the tip of the toe.",
  ),
  always(
    "leg-height",
    "Leg height",
    "leg",
    "Lay the sock flat with the heel at the bottom. Measure straight up the back from the bottom of the heel to the top edge of the sock.",
  ),
  always(
    "calf-width",
    "Calf width",
    "leg",
    "Lay the sock flat and smooth it without stretching it. Measure straight across the leg, from one side to the other, at the widest part of the calf.",
  ),
  always(
    "ankle-width",
    "Ankle width",
    "leg",
    "Lay the sock flat and smooth it without stretching it. Measure straight across the leg, from one side to the other, at the narrowest part above the heel.",
  ),
  always(
    "top-width",
    "Top width",
    "leg",
    "Lay the sock flat and let the top lie without stretching it. Measure straight across the top edge, from one side to the other.",
  ),
];

export const CAP_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  always(
    "head-width",
    "Head opening width",
    "body",
    "Lay the cap flat with the peak towards you. Measure straight across the opening at the base of the crown, along the head band, from one side to the other.",
  ),
  always(
    "crown-height",
    "Crown height",
    "body",
    "Lay the cap flat with the peak towards you. Measure straight up the centre front from the bottom edge of the head band to the top of the crown.",
  ),
  always(
    "peak-length",
    "Peak length",
    "body",
    "Lay the cap flat with the peak towards you. Measure from the bottom edge of the head band at the centre front to the outer edge of the peak.",
  ),
  always(
    "peak-width",
    "Peak width",
    "body",
    "Lay the cap flat with the peak towards you. Measure straight across the peak at its widest point, from one side to the other.",
  ),
];
