import { createHash } from "node:crypto";
import sharp, { type Sharp } from "sharp";
import type { AssetColourSpace } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";
import { withDeadline } from "../deadline";
import { NOTES, REFUSALS } from "../messages";
import { INTAKE_LIMITS } from "../settings";
import { claimedSize } from "./header";
import { classifyColour, iccProfileName } from "./icc";
import { hasWhiteBackground } from "./white";

/** What a raster upload becomes: a full resolution sRGB print copy, a screen copy, and what was found. */
export type RasterIntake = Readonly<{
  kind: "raster";
  widthPx: number;
  heightPx: number;
  dpiMeta: number | null;
  colourSpace: AssetColourSpace;
  profileName: string | null;
  hasAlpha: boolean;
  print: Readonly<{ bytes: Buffer; contentType: "image/tiff"; extension: "tiff"; sha256: string }>;
  screen: Readonly<{ bytes: Buffer; contentType: "image/png" | "image/jpeg"; extension: "png" | "jpg"; width: number; height: number }>;
  whiteBackground: boolean;
  warnings: readonly string[];
}>;

const unreadable = () => new AppError("invalid_input", REFUSALS.unreadable);

const sanitiseDpi = (density: number | undefined): number | null =>
  density !== undefined && Number.isFinite(density) && density >= 1 && density <= 100_000 ? Math.round(density * 100) / 100 : null;

const tiffOptions = (dpi: number | null, hasAlpha: boolean, jpeg: boolean) => ({
  compression: jpeg && !hasAlpha ? ("jpeg" as const) : ("deflate" as const),
  ...(jpeg && !hasAlpha ? { quality: 95 } : { predictor: "horizontal" as const }),
  ...(dpi ? { xres: dpi / 25.4, yres: dpi / 25.4, resolutionUnit: "inch" as const } : {}),
});

const encodePrint = async (pipeline: Sharp, dpi: number | null, hasAlpha: boolean): Promise<Buffer> => {
  // Lossless first. A picture too big that way is kept as high quality JPEG inside the TIFF, if it has no see-through parts.
  const lossless = await pipeline.clone().tiff(tiffOptions(dpi, hasAlpha, false)).toBuffer();
  if (lossless.byteLength <= INTAKE_LIMITS.maxPrintCopyBytes) return lossless;
  if (hasAlpha) throw new AppError("too_large", REFUSALS.printCopyTooBig);
  const lossy = await pipeline.clone().tiff(tiffOptions(dpi, hasAlpha, true)).toBuffer();
  if (lossy.byteLength > INTAKE_LIMITS.maxPrintCopyBytes) throw new AppError("too_large", REFUSALS.printCopyTooBig);
  return lossy;
};

const colourNotes = (space: string | undefined, profile: string | null, hasProfile: boolean, depth: string | undefined): string[] => {
  const notes: string[] = [];
  if (hasProfile) notes.push(profile ? NOTES.profileUsed(profile) : NOTES.profileUnnamed);
  else notes.push(space === "cmyk" ? NOTES.cmykNoProfile : NOTES.noProfile);
  if (depth === "ushort" || depth === "uint" || depth === "float" || depth === "double") notes.push(NOTES.sixteenBit);
  return notes;
};

/** Makes the small copy a browser may be given, from the print copy. */
export const makeScreenCopy = async (print: Buffer, hasAlpha: boolean, asPng: boolean): Promise<RasterIntake["screen"]> => {
  const resized = sharp(print, { limitInputPixels: INTAKE_LIMITS.maxPixels })
    .resize({ width: INTAKE_LIMITS.screenEdgePx, height: INTAKE_LIMITS.screenEdgePx, fit: "inside", withoutEnlargement: true });
  const usePng = asPng || hasAlpha;
  const { data, info } = await (usePng
    ? resized.png({ compressionLevel: 9 })
    : resized.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true })
  ).toBuffer({ resolveWithObject: true });
  return usePng
    ? { bytes: data, contentType: "image/png", extension: "png", width: info.width, height: info.height }
    : { bytes: data, contentType: "image/jpeg", extension: "jpg", width: info.width, height: info.height };
};

const headerOf = async (bytes: Uint8Array) => {
  try {
    // Reads the header only. The pixel cap is applied by hand below, before anything is decoded.
    return await sharp(bytes, { limitInputPixels: false }).metadata();
  } catch {
    throw unreadable();
  }
};

/** Looks at the white box question on the screen copy, which is small. */
const whiteBox = async (screen: Buffer): Promise<boolean> => {
  const { data, info } = await sharp(screen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return hasWhiteBackground({ data, width: info.width, height: info.height, channels: 4 });
};

const overTheCap = (size: { width: number; height: number }): boolean =>
  size.width * size.height > INTAKE_LIMITS.maxPixels || Math.max(size.width, size.height) > INTAKE_LIMITS.maxEdgePx;

const read = async (bytes: Uint8Array, source: "png" | "jpeg" | "tiff"): Promise<RasterIntake> => {
  const asPng = source === "png";
  if (bytes.byteLength > INTAKE_LIMITS.maxFileBytes) throw new AppError("too_large", REFUSALS.tooBig);
  // The size the file claims is read by hand first, so a bomb is refused before the image library opens it.
  const claimed = claimedSize(bytes, source);
  if (!claimed) throw unreadable();
  if (overTheCap(claimed)) throw new AppError("too_large", REFUSALS.tooManyPixels);
  const meta = await headerOf(bytes);
  if (!meta.width || !meta.height) throw unreadable();
  if (overTheCap({ width: meta.width, height: meta.height })) throw new AppError("too_large", REFUSALS.tooManyPixels);
  const profile = iccProfileName(meta.icc);
  const hasAlpha = meta.hasAlpha === true;
  const dpi = sanitiseDpi(meta.density);
  // The embedded profile is applied when the picture is converted to sRGB. No metadata is carried over.
  const pipeline = sharp(bytes, { limitInputPixels: INTAKE_LIMITS.maxPixels, failOn: "error" }).rotate().toColourspace("srgb");
  try {
    const printBytes = await encodePrint(pipeline, dpi, hasAlpha);
    const info = await sharp(printBytes).metadata();
    const screen = await makeScreenCopy(printBytes, hasAlpha, asPng);
    const notes = colourNotes(meta.space, profile, meta.hasProfile === true, meta.depth);
    const white = await whiteBox(screen.bytes);
    return {
      kind: "raster",
      widthPx: info.width ?? meta.width,
      heightPx: info.height ?? meta.height,
      dpiMeta: dpi,
      colourSpace: classifyColour(meta.space, profile),
      profileName: profile,
      hasAlpha,
      print: { bytes: printBytes, contentType: "image/tiff", extension: "tiff", sha256: createHash("sha256").update(printBytes).digest("hex") },
      screen,
      whiteBackground: white,
      warnings: [...notes, ...(hasAlpha ? [NOTES.keptAlpha] : []), ...(white ? [NOTES.whiteBox] : [])],
    };
  } catch (error) {
    throw error instanceof AppError ? error : unreadable();
  }
};

/**
 * Reads a PNG, JPEG or TIFF as pixels. The size is checked from the header before anything is decoded; the
 * embedded colour profile is applied; the result is 8-bit sRGB with no metadata, so only pixels remain.
 */
export const readRaster = (bytes: Uint8Array, source: "png" | "jpeg" | "tiff"): Promise<RasterIntake> =>
  withDeadline(read(bytes, source), INTAKE_LIMITS.maxReadMs);
