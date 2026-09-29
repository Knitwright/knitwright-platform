import type { PointOfMeasure } from "../../definitions";
import { onlyWhen, when } from "../shared";
import { TOPS_POINTS_OF_MEASURE } from "../tops/points-of-measure";

/** The body, sleeve and neck points a hoodie or jacket shares with a top, measured the same way. */
const FROM_TOPS = [
  "chest-width",
  "body-length",
  "shoulder-width",
  "sleeve-length",
  "armhole",
  "upper-arm",
  "sleeve-opening",
  "hem-width",
  "neck-width",
  "front-neck-drop",
  "back-neck-drop",
] as const;

const shared: readonly PointOfMeasure[] = FROM_TOPS.flatMap((id) => TOPS_POINTS_OF_MEASURE.filter((point) => point.id === id));

const HOOD = [when("hood", ["single-layer", "lined"])];
const NO_HOOD = "This garment has no hood, so there is no hood to measure.";

/**
 * Points of measure for outerwear: those of a top, and the points the plan adds for hoods,
 * zips, pockets and rib bands. Measurements of the finished garment lying flat.
 */
export const OUTERWEAR_POINTS_OF_MEASURE: readonly PointOfMeasure[] = [
  ...shared,
  onlyWhen(
    "hood-height",
    "Hood height",
    "hood",
    "Lay the hood flat, folded along its centre seam. Measure straight up from the seam where the hood joins the neckline, at the side of the neck, to the highest point of the hood.",
    HOOD,
    NO_HOOD,
  ),
  onlyWhen(
    "hood-width",
    "Hood width",
    "hood",
    "Lay the hood flat, folded along its centre seam. Measure straight across the widest part of the hood, from the front edge of the opening to the centre back seam.",
    HOOD,
    NO_HOOD,
  ),
  onlyWhen(
    "zip-length",
    "Zip length",
    "zip",
    "Lay the garment flat with the front facing up and close the zip. Measure the zip teeth from the top stop to the bottom stop, not counting the tape beyond them.",
    [when("front-opening", ["full-zip"])],
    "This garment has no front zip, so there is no zip length to measure.",
  ),
  onlyWhen(
    "pocket-opening",
    "Pocket opening",
    "pocket",
    "Lay the garment flat with the front facing up. Measure along one pocket opening, from the end of the stitching at the top to the end of the stitching at the bottom.",
    [when("pockets", ["kangaroo", "side-seam", "zip-side"])],
    "This garment has no pockets, so there is no pocket opening to measure.",
  ),
  onlyWhen(
    "pocket-width",
    "Pocket width",
    "pocket",
    "Lay the garment flat with the front facing up. Measure straight across the kangaroo pocket at its widest, from one outer edge to the other.",
    [when("pockets", ["kangaroo"])],
    "Only a kangaroo pocket has a width to measure on the front of the garment.",
  ),
  onlyWhen(
    "pocket-height",
    "Pocket height",
    "pocket",
    "Lay the garment flat with the front facing up. Measure straight up the centre of the kangaroo pocket, from its bottom seam to its top edge.",
    [when("pockets", ["kangaroo"])],
    "Only a kangaroo pocket has a height to measure on the front of the garment.",
  ),
  onlyWhen(
    "cuff-height",
    "Cuff height",
    "rib",
    "Lay the garment flat and spread one sleeve straight out. Measure the ribbed cuff straight along the sleeve, from the seam that joins it to the sleeve to its outer edge.",
    [when("cuffs", ["rib-cuff"])],
    "The sleeves are hemmed with no ribbed cuff, so there is no cuff height to measure.",
  ),
  onlyWhen(
    "hem-band-height",
    "Hem band height",
    "rib",
    "Lay the garment flat with the front facing up. Measure the ribbed hem band straight down, from the seam that joins it to the body to its bottom edge.",
    [when("hem-finish", ["rib-band"])],
    "The body has a plain hem with no ribbed band, so there is no band height to measure.",
  ),
  onlyWhen(
    "collar-height",
    "Collar height",
    "neck",
    "Lay the garment flat with the collar standing up and the zip closed. Measure at the centre back, from the seam where the collar joins the neckline to the top edge of the collar.",
    [when("collar", ["stand-collar"])],
    "This garment has no collar, so there is no collar height to measure.",
  ),
];
