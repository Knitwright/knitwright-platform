import sharp, { type Metadata } from "sharp";
import type { AssetColourSpace } from "@/lib/artwork-stack/assets";
import { AppError } from "@/lib/server/core/errors";
import { colourSpaceOf, readProfile } from "./icc";
import { ARTWORK_LIMITS } from "./limits";
import { hasWhiteBox } from "./white-box";

/**
 * Reads a picture (PNG, JPEG, TIFF) and writes it out again as pixels only: no camera or location
 * details, no script, nothing appended. Two copies come out: a print copy at full resolution in sRGB
 * and a small screen copy for browsers. The pixel count is checked from the header before anything is
 * decoded, so a small file that opens into a huge picture is refused first.
 */

export type RasterIntake = Readonly<{
  print: Buffer;
  screen: Buffer;
  screenType: "image/png" | "image/jpeg";
  screenExtension: "png" | "jpg";
  /** Of the print copy. */
  widthPx: number;
  heightPx: number;
  /** The resolution the file stated, or null. */
  dpiMeta: number | null;
  colourSpace: AssetColourSpace;
  profileName: string | null;
  hasAlpha: boolean;
  /** A logo on an opaque white box. */
  whiteBackground: boolean;
  warnings: readonly string[];
}>;

export const TOO_LARGE_PICTURE = `That picture is too large. Use one under ${ARTWORK_LIMITS.maxPixels / 1_000_000} megapixels and ${ARTWORK_LIMITS.maxEdge.toLocaleString("en-AU")} pixels on its longest side.`;
export const TOO_MANY_BYTES = `Files can be ${ARTWORK_LIMITS.maxBytes / (1024 * 1024)} MB at most.`;
export const NOT_READABLE = "That file could not be read as a picture.";

const NO_PROFILE = "No colour profile was in this file, so its colours were treated as sRGB.";
const NO_PROFILE_CMYK = "This CMYK picture had no colour profile, so an average conversion to sRGB was used. Colours may shift.";

const unreadable = () => new AppError("invalid_input", NOT_READABLE);

/** The header only: this does not decode the picture, so it is safe to ask before the limits are applied. */
async function readHeader(bytes: Uint8Array): Promise<Metadata> {
  try {
    return await sharp(bytes, { limitInputPixels: false }).metadata();
  } catch {
    throw unreadable();
  }
}

function checkSize(meta: Metadata): { width: number; height: number } {
  const width = meta.width ?? 0;
  const height = meta.pageHeight ?? meta.height ?? 0;
  if (width < 1 || height < 1) throw unreadable();
  if (width * height > ARTWORK_LIMITS.maxPixels || Math.max(width, height) > ARTWORK_LIMITS.maxEdge) {
    throw new AppError("too_large", TOO_LARGE_PICTURE);
  }
  return { width, height };
}

const plausibleDpi = (density: number | undefined): number | null =>
  density !== undefined && density >= 10 && density <= 10_000 ? Math.round(density) : null;

const formatSize = (width: number, height: number): string => `${width} x ${height}`;

const tiffOptions = (dpi: number | null, scale: number) => ({
  compression: "deflate" as const,
  predictor: "horizontal" as const,
  ...(dpi === null ? {} : { xres: (dpi * scale) / 25.4, yres: (dpi * scale) / 25.4 }),
});

/** Opens the file once and writes the print copy as a lossless TIFF in sRGB, turned upright. */
async function firstPrintCopy(bytes: Uint8Array, dpi: number | null): Promise<{ bytes: Buffer; width: number; height: number }> {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: ARTWORK_LIMITS.maxPixels, failOn: "error", page: 0 })
      // Turns the picture as its orientation note says; the note is not kept.
      .rotate()
      .toColourspace("srgb")
      .tiff(tiffOptions(dpi, 1))
      .withIccProfile("srgb")
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch {
    throw unreadable();
  }
}

/** Reduces the print copy step by step, only when it would not fit in storage. */
async function fitPrintCopy(
  first: { bytes: Buffer; width: number; height: number },
  dpi: number | null,
  warnings: string[],
): Promise<{ bytes: Buffer; width: number; height: number }> {
  let current = first;
  let scale = 1;
  for (let attempt = 0; attempt < 5 && current.bytes.length > ARTWORK_LIMITS.maxPrintCopyBytes; attempt += 1) {
    scale *= Math.sqrt(ARTWORK_LIMITS.maxPrintCopyBytes / current.bytes.length) * 0.92;
    const width = Math.max(1, Math.round(first.width * scale));
    const height = Math.max(1, Math.round(first.height * scale));
    const { data } = await sharp(first.bytes, { limitInputPixels: ARTWORK_LIMITS.maxPixels })
      .resize({ width, height, fit: "fill" })
      .tiff(tiffOptions(dpi, scale))
      .withIccProfile("srgb")
      .toBuffer({ resolveWithObject: true });
    current = { bytes: data, width, height };
  }
  if (current.bytes.length > ARTWORK_LIMITS.maxPrintCopyBytes) throw new AppError("too_large", TOO_LARGE_PICTURE);
  if (current !== first) {
    warnings.push(
      `The print copy was reduced from ${formatSize(first.width, first.height)} to ${formatSize(current.width, current.height)} pixels to fit in storage.`,
    );
  }
  return current;
}

type ScreenCopy = Pick<RasterIntake, "screen" | "screenType" | "screenExtension">;

const SCREEN_PNG_LIMIT = 6 * 1024 * 1024;

/** The small copy: PNG where there is see-through or flat colour, JPEG for a photograph that is large as PNG. */
async function encodeScreen(print: Buffer, hasAlpha: boolean, wasJpeg: boolean): Promise<ScreenCopy> {
  const small = sharp(print, { limitInputPixels: ARTWORK_LIMITS.maxPixels }).resize({
    width: ARTWORK_LIMITS.screenEdge,
    height: ARTWORK_LIMITS.screenEdge,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (!hasAlpha && wasJpeg) {
    return { screen: await small.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), screenType: "image/jpeg", screenExtension: "jpg" };
  }
  const png = await small.clone().png({ compressionLevel: 9 }).toBuffer();
  if (hasAlpha || png.length <= SCREEN_PNG_LIMIT) return { screen: png, screenType: "image/png", screenExtension: "png" };
  return { screen: await small.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer(), screenType: "image/jpeg", screenExtension: "jpg" };
}

async function whiteBoxIn(screen: Buffer): Promise<boolean> {
  const { data, info } = await sharp(screen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return hasWhiteBox({ data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height });
}

export async function ingestRaster(bytes: Uint8Array, format: "png" | "jpeg" | "tiff"): Promise<RasterIntake> {
  if (bytes.byteLength > ARTWORK_LIMITS.maxBytes) throw new AppError("too_large", TOO_MANY_BYTES);
  const meta = await readHeader(bytes);
  checkSize(meta);

  const profile = readProfile(meta.icc);
  const colourSpace = colourSpaceOf(profile, meta.space);
  const dpiMeta = plausibleDpi(meta.density);
  const warnings: string[] = [];
  if (!profile) warnings.push(colourSpace === "cmyk" ? NO_PROFILE_CMYK : NO_PROFILE);
  if ((meta.pages ?? 1) > 1) warnings.push("This file has more than one page. Only the first was used.");
  if (meta.depth === "ushort" || meta.depth === "float") warnings.push("The picture had more than 8 bits per colour. It was reduced to 8.");

  const hasAlpha = meta.hasAlpha === true;
  const print = await fitPrintCopy(await firstPrintCopy(bytes, dpiMeta), dpiMeta, warnings);
  const screen = await encodeScreen(print.bytes, hasAlpha, format === "jpeg");
  const whiteBackground = await whiteBoxIn(screen.screen);
  if (whiteBackground) {
    warnings.push("This picture sits on a white box. Sublimation prints no white ink, so the box would show as the fabric's own colour. You can remove the white background.");
  }

  return {
    ...screen,
    print: print.bytes,
    widthPx: print.width,
    heightPx: print.height,
    dpiMeta,
    colourSpace,
    profileName: profile?.name ?? null,
    hasAlpha,
    whiteBackground,
    warnings,
  };
}
