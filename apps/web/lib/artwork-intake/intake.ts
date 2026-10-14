import { createHash } from "node:crypto";
import { AppError } from "@/lib/server/core/errors";
import type { AssetColourSpace } from "@/lib/artwork-stack";
import { labelFrom } from "./label";
import { REFUSALS } from "./messages";
import { rasterisePdf } from "./pdf/rasterise";
import { readRaster, type RasterIntake } from "./raster/read";
import { INTAKE_LIMITS } from "./settings";
import { sniffArtwork } from "./sniff";
import { reencodeEmbedded, renderPreview } from "./vector/embed";
import { parseSvg } from "./vector/parse";
import { withDeadline } from "./deadline";

export type SourceFormat = "png" | "jpeg" | "tiff" | "pdf" | "svg" | "ai";

export type Copy = Readonly<{ bytes: Buffer; contentType: string; extension: string }>;

/** What an upload becomes, ready to store. For a raster, `print` is a TIFF; for a vector, `vector` is JSON. Never an SVG. */
export type Intake = Readonly<{
  kind: "raster" | "vector";
  sourceFormat: SourceFormat;
  label: string;
  /** Of the file as it came in. The original is not kept. */
  sourceSha256: string;
  /** Of the print copy, or of the vector JSON. */
  printSha256: string;
  widthPx: number;
  heightPx: number;
  dpiMeta: number | null;
  colourSpace: AssetColourSpace;
  profileName: string | null;
  hasAlpha: boolean;
  print: Copy | null;
  vector: Copy | null;
  screen: Copy & { width: number; height: number };
  whiteBackground: boolean;
  /** The size a PDF page or an SVG states in a real unit, or null. */
  statedSizeMm: Readonly<{ width: number; height: number }> | null;
  warnings: readonly string[];
}>;

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** A raster the reader made, as an intake. Also how a changed picture (white box removed, made seamless) becomes a new artwork. */
export const intakeFromRaster = (
  raster: RasterIntake,
  origin: Readonly<{ sourceFormat: SourceFormat; label: string; sourceSha256: string }>,
): Intake => {
  return {
    kind: "raster",
    sourceFormat: origin.sourceFormat,
    label: origin.label,
    sourceSha256: origin.sourceSha256,
    printSha256: raster.print.sha256,
    widthPx: raster.widthPx,
    heightPx: raster.heightPx,
    dpiMeta: raster.dpiMeta,
    colourSpace: raster.colourSpace,
    profileName: raster.profileName,
    hasAlpha: raster.hasAlpha,
    print: raster.print,
    vector: null,
    screen: raster.screen,
    whiteBackground: raster.whiteBackground,
    statedSizeMm: null,
    warnings: raster.warnings,
  };
};

const rasterIntake = async (bytes: Uint8Array, format: "png" | "jpeg" | "tiff", label: string): Promise<Intake> =>
  intakeFromRaster(await readRaster(bytes, format), { sourceFormat: format, label, sourceSha256: sha256(bytes) });

const pdfIntake = async (bytes: Uint8Array, label: string, named: SourceFormat): Promise<Intake> => {
  const page = await rasterisePdf(bytes);
  const inner = await rasterIntake(page.png, "png", label);
  return {
    ...inner,
    sourceFormat: named,
    sourceSha256: sha256(bytes),
    // A page is drawn, not photographed: it is as sharp as the dpi it was drawn at, and that is its resolution.
    dpiMeta: page.dpi,
    statedSizeMm: page.pageSizeMm,
    warnings: [`This ${named === "ai" ? "Illustrator" : "PDF"} page was turned into a picture at ${page.dpi} dpi.`, ...page.notes, ...inner.warnings],
  };
};

const svgIntake = async (bytes: Uint8Array, label: string): Promise<Intake> => {
  const { model, warnings } = await parseSvg(bytes, reencodeEmbedded);
  const json = Buffer.from(JSON.stringify(model), "utf8");
  const preview = await renderPreview(model);
  return {
    kind: "vector",
    sourceFormat: "svg",
    label,
    sourceSha256: sha256(bytes),
    printSha256: sha256(json),
    widthPx: preview.widthPx,
    heightPx: preview.heightPx,
    dpiMeta: null,
    colourSpace: "srgb",
    profileName: null,
    hasAlpha: true,
    print: null,
    vector: { bytes: json, contentType: "application/json", extension: "json" },
    screen: { bytes: preview.png, contentType: "image/png", extension: "png", width: preview.widthPx, height: preview.heightPx },
    whiteBackground: false,
    statedSizeMm: model.statedSizeMm,
    warnings,
  };
};

/**
 * Takes in one upload. The type is read from the first bytes, never from the name or the stated type. A raster
 * becomes an sRGB print copy and a screen copy; a vector becomes restricted vector JSON and a screen picture.
 * Throws an AppError with a plain sentence for anything refused, before anything is stored.
 */
export const intakeArtwork = async (bytes: Uint8Array, fileName: string): Promise<Intake> => {
  if (bytes.byteLength > INTAKE_LIMITS.maxFileBytes) throw new AppError("too_large", REFUSALS.tooBig);
  const label = labelFrom(fileName);
  const type = sniffArtwork(bytes);
  if (type === null) throw new AppError("invalid_input", REFUSALS.notAccepted);
  if (type === "ai-native") throw new AppError("invalid_input", REFUSALS.nativeAi);
  if (type === "svg") return withDeadline(svgIntake(bytes, label), INTAKE_LIMITS.maxReadMs);
  if (type === "pdf") return pdfIntake(bytes, label, /\.ai$/i.test(fileName) ? "ai" : "pdf");
  return rasterIntake(bytes, type, label);
};
