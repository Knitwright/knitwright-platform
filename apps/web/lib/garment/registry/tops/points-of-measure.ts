import type { PointOfMeasure } from "../../definitions";

/**
 * Points of measure for tops. These are garment measurements, taken on the finished
 * garment lying flat, as a factory would check them. They are not body measurements.
 * The registry says what to measure. The size charts say how big it should be.
 */
export const TOPS_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  {
    id: "chest-width",
    label: "Chest width",
    howToMeasure:
      "Lay the garment flat and smooth it out. Measure straight across the chest, from one side seam to the other, just below where the sleeve joins the body.",
    appliesWhen: [],
  },
  {
    id: "body-length",
    label: "Body length",
    howToMeasure:
      "Lay the garment flat with the front facing up. Measure from the highest point of the shoulder, where it meets the neckline, straight down to the bottom edge of the hem.",
    appliesWhen: [],
  },
  {
    id: "shoulder-width",
    label: "Shoulder width",
    howToMeasure:
      "Lay the garment flat with the back facing up. Measure straight across from the seam where one sleeve joins the shoulder to the same seam on the other side.",
    appliesWhen: [{ option: "sleeve-type", in: ["set-in"] }],
    unavailableReason:
      "A raglan sleeve runs up to the neck with no shoulder seam, so there is no shoulder width to measure.",
  },
  {
    id: "sleeve-length",
    label: "Sleeve length",
    howToMeasure:
      "Lay the garment flat and spread one sleeve straight out. Measure along the top of the sleeve, from the shoulder seam where the sleeve is joined, or from the neck edge on a raglan, to the edge of the sleeve opening.",
    appliesWhen: [],
  },
  {
    id: "armhole",
    label: "Armhole",
    howToMeasure:
      "Lay the garment flat. Measure in a straight line from the top of the armhole seam, where the sleeve meets the shoulder, down to the underarm point where the sleeve meets the side seam.",
    appliesWhen: [],
  },
  {
    id: "upper-arm",
    label: "Upper arm",
    howToMeasure:
      "Lay the garment flat and spread one sleeve straight out. Measure straight across the sleeve just below the underarm, at a right angle to the length of the sleeve.",
    appliesWhen: [],
  },
  {
    id: "sleeve-opening",
    label: "Sleeve opening",
    howToMeasure:
      "Lay the garment flat and spread one sleeve straight out. Measure straight across the open end of the sleeve, from edge to edge, without stretching it.",
    appliesWhen: [],
  },
  {
    id: "hem-width",
    label: "Hem width",
    howToMeasure:
      "Lay the garment flat with the hem straight. Measure straight across the bottom edge from one side seam to the other, without stretching it.",
    appliesWhen: [],
  },
  {
    id: "neck-width",
    label: "Neck width",
    howToMeasure:
      "Lay the garment flat. Measure straight across the neck opening, from the seam on one shoulder where the neckline begins to the same seam on the other shoulder.",
    appliesWhen: [],
  },
  {
    id: "front-neck-drop",
    label: "Front neck drop",
    howToMeasure:
      "Lay the garment flat with the front facing up and lay a ruler across the neck opening from shoulder seam to shoulder seam. Measure straight down from the ruler to the lowest point of the front neckline.",
    appliesWhen: [],
  },
  {
    id: "back-neck-drop",
    label: "Back neck drop",
    howToMeasure:
      "Lay the garment flat with the back facing up and lay a ruler across the neck opening from shoulder seam to shoulder seam. Measure straight down from the ruler to the lowest point of the back neckline.",
    appliesWhen: [],
  },
  {
    id: "collar-height",
    label: "Collar height",
    howToMeasure:
      "Lay the garment flat with the collar folded the way it is worn. Measure at the centre back, from the seam where the collar joins the neckline to the top edge of the collar.",
    appliesWhen: [{ option: "collar", in: ["polo-collar", "band-collar"] }],
    unavailableReason: "This garment has no collar, so there is no collar height to measure.",
  },
  {
    id: "placket-length",
    label: "Placket length",
    howToMeasure:
      "Lay the garment flat and close the placket. Measure down the centre front, from the neckline seam to the bottom end of the placket stitching.",
    appliesWhen: [{ option: "placket", in: ["buttons", "zip"] }],
    unavailableReason: "This garment has no placket, so there is no placket length to measure.",
  },
  {
    id: "placket-width",
    label: "Placket width",
    howToMeasure:
      "Lay the garment flat and close the placket. Measure straight across the placket, from one outer edge to the other, about halfway down its length.",
    appliesWhen: [{ option: "placket", in: ["buttons", "zip"] }],
    unavailableReason: "This garment has no placket, so there is no placket width to measure.",
  },
];
