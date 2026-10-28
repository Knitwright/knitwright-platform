import { AppError } from "@/lib/server/core/errors";
import { REFUSALS } from "./messages";
import { toPixels, toPng, type Pixels } from "./raster/pixels";
import { readRaster, type RasterIntake } from "./raster/read";
import { removeWhiteBackground } from "./raster/white";
import { INTAKE_LIMITS } from "./settings";
import { makeSeamless, previewGrid, seamReport, type SeamlessMethod, type SeamReport } from "./tile";

/** The biggest picture changed here. Changes read every pixel into memory, so they are held to a smaller size. */
const CONVERT_MAX_PIXELS = 16_000_000;

const decode = async (print: Uint8Array): Promise<Pixels> => {
  try {
    return await toPixels(print, CONVERT_MAX_PIXELS);
  } catch {
    throw new AppError("too_large", REFUSALS.convertTooBig);
  }
};

/** A changed picture becomes a new artwork copy through the same reader as any upload. */
const reread = async (pixels: Pixels, dpiMeta: number | null): Promise<RasterIntake> => {
  const again = await readRaster(await toPng(pixels), "png");
  return { ...again, dpiMeta: dpiMeta ?? again.dpiMeta };
};

/** Makes the white that touches the edge of the picture see-through. The artwork it came from is not changed. */
export const removeWhite = async (print: Uint8Array, dpiMeta: number | null): Promise<RasterIntake> => {
  const { pixels, removed } = removeWhiteBackground(await decode(print));
  if (removed === 0) throw new AppError("invalid_input", REFUSALS.nothingToRemove);
  return reread(pixels, dpiMeta);
};

export type SeamlessPreview = Readonly<{
  before: SeamReport;
  after: SeamReport;
  method: SeamlessMethod;
  /** The result laid out 3 x 3, as a PNG. */
  preview: Buffer;
  widthPx: number;
  heightPx: number;
  /** The limit, said plainly with every verdict. */
  limit: string;
  pixels: Pixels;
}>;

export const SEAMLESS_LIMIT =
  "Photographs and drawings with large detail cannot be fixed convincingly. Look at the 3 x 3 preview before you accept.";

/** Measures a tile, makes it seamless by the chosen method and lays the result out 3 x 3, without storing anything. */
export const seamlessPreview = async (print: Uint8Array, method: SeamlessMethod): Promise<SeamlessPreview> => {
  const tile = await decode(print);
  const before = seamReport(tile);
  const fixed = makeSeamless(tile, method);
  if (fixed.width > INTAKE_LIMITS.maxEdgePx || fixed.height > INTAKE_LIMITS.maxEdgePx) {
    throw new AppError("too_large", REFUSALS.convertTooBig);
  }
  return {
    before,
    after: seamReport(fixed),
    method,
    preview: await previewGrid(fixed),
    widthPx: fixed.width,
    heightPx: fixed.height,
    limit: SEAMLESS_LIMIT,
    pixels: fixed,
  };
};

/** The seam report of the stored picture as it is. */
export const checkTile = async (print: Uint8Array): Promise<SeamReport> => seamReport(await decode(print));

/** The seamless picture as a new artwork copy. */
export const applySeamless = (preview: SeamlessPreview, dpiMeta: number | null): Promise<RasterIntake> =>
  reread(preview.pixels, dpiMeta);
