import { DEFAULT_MIN_DPI } from "./settings";

const MM_PER_INCH = 25.4;

/** Pixels over the printed width in inches. */
export const effectiveDpi = (asset: Readonly<{ widthPx: number }>, widthMm: number): number => {
  if (!Number.isFinite(widthMm) || widthMm <= 0) throw new Error("The printed width must be more than 0 mm.");
  return asset.widthPx / (widthMm / MM_PER_INCH);
};

/** The widest print, in mm, at which the file still meets `minDpi`. */
export const largestWidthMm = (asset: Readonly<{ widthPx: number }>, minDpi: number): number =>
  (asset.widthPx / minDpi) * MM_PER_INCH;

/**
 * The warning for a picture placed too large for its pixels, or null. A vector never warns.
 * `minDpi` is the print house's, or Knitwright's default (150) until the owner supplies one.
 */
export const dpiWarning = (
  asset: Readonly<{ kind: "raster" | "vector"; widthPx: number }>,
  widthMm: number,
  minDpi: number = DEFAULT_MIN_DPI,
): string | null => {
  if (asset.kind === "vector") return null;
  const dpi = effectiveDpi(asset, widthMm);
  if (dpi >= minDpi) return null;
  const largest = Math.round(largestWidthMm(asset, minDpi));
  return (
    `This picture would print at about ${Math.round(dpi)} dpi at this size. ` +
    `Your print house asks for ${minDpi} or more, so it may look soft. ` +
    `Use a larger file, or make it smaller on the shirt. ` +
    `The largest size at which it still meets ${minDpi} dpi is about ${largest} mm wide.`
  );
};
