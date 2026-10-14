import type { ArtworkRecord } from "./records";
import type { SeamReport } from "./tile";

/** Plain-English text for the artwork screens. */

export const FORMATS_HINT = "PNG, JPEG, TIFF, PDF or SVG, up to 50 MB. An Illustrator file needs 'Create PDF compatible file' ticked when it is saved.";

export const SVG_NOT_KEPT_NOTE = "An SVG is read into plain drawing data. The SVG file itself is not kept.";

const FORMAT_NAMES: Readonly<Record<ArtworkRecord["sourceFormat"], string>> = {
  png: "PNG picture",
  jpeg: "JPEG picture",
  tiff: "TIFF picture",
  pdf: "PDF page",
  ai: "Illustrator page",
  svg: "SVG drawing",
};

/** One line saying what a stored artwork is. */
export const describeArtwork = (artwork: ArtworkRecord): string => {
  const parts: string[] = [FORMAT_NAMES[artwork.sourceFormat]];
  if (artwork.kind === "raster") {
    parts.push(`${artwork.widthPx} x ${artwork.heightPx} pixels`);
    parts.push(artwork.dpiMeta === null ? "no resolution stated" : `${Math.round(artwork.dpiMeta)} dpi stated`);
    if (artwork.colourSpace === "cmyk") parts.push("CMYK turned into screen colours");
  } else {
    parts.push("prints sharp at any size");
  }
  if (artwork.hasAlpha) parts.push("has see-through parts");
  return parts.join(", ");
};

/** The dpi readout beside a size, to the nearest 1. */
export const dpiReadout = (dpi: number | null, widthMm: number): string =>
  dpi === null ? `At ${Math.round(widthMm)} mm wide this stays sharp, because it is drawn as shapes.` : `At ${Math.round(widthMm)} mm wide this prints at about ${Math.round(dpi)} dpi.`;

/** The seam verdict with its number. */
export const seamSentence = (report: SeamReport): string => `${report.verdict} The edges differ by ${report.mismatch} out of 100.`;

/** Before and after, for a change that was shown but not yet accepted. */
export const seamChangeSentence = (before: SeamReport, after: SeamReport): string =>
  `The edges differed by ${before.mismatch} out of 100 and now differ by ${after.mismatch}. ${after.verdict}`;
