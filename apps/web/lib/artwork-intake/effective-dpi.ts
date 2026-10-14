import type { ArtworkStack, AssetReader } from "@/lib/artwork-stack";
import { ARTWORK_LIMITS, MINIMUM_DPI_LABEL } from "./limits";

const MM_PER_INCH = 25.4;

/** What an asset needs to know for a resolution check. */
export type SizedAsset = Readonly<{ kind: "raster" | "vector"; widthPx: number; dpiMeta?: number | null }>;

export type DpiCheck = Readonly<{
  /** False for a vector: it has no resolution, so it never warns. */
  applies: boolean;
  /** Pixels per inch at the printed width, to the nearest whole number. Null for a vector. */
  dpi: number | null;
  minDpi: number;
  meets: boolean;
  /** The widest the file can print and still meet the minimum, in millimetres. Null for a vector. */
  largestWidthMm: number | null;
  /** The sentence to show, or null when there is nothing to warn about. */
  warning: string | null;
  /** Where the minimum came from. */
  minDpiSource: string;
}>;

/** Pixels divided by the printed width in inches. */
export function effectiveDpi(asset: Pick<SizedAsset, "widthPx">, widthMm: number): number {
  if (!(widthMm > 0) || !Number.isFinite(widthMm)) throw new RangeError("The printed width must be more than zero.");
  return asset.widthPx / (widthMm / MM_PER_INCH);
}

/** The widest print, in mm, at which `widthPx` still gives `minDpi`. */
export const largestWidthMm = (widthPx: number, minDpi: number): number => Math.floor((widthPx / minDpi) * MM_PER_INCH);

export function dpiCheck(asset: SizedAsset, widthMm: number, minDpi: number = ARTWORK_LIMITS.minDpi): DpiCheck {
  if (asset.kind === "vector") {
    return { applies: false, dpi: null, minDpi, meets: true, largestWidthMm: null, warning: null, minDpiSource: MINIMUM_DPI_LABEL };
  }
  const dpi = Math.round(effectiveDpi(asset, widthMm));
  const largest = largestWidthMm(asset.widthPx, minDpi);
  const meets = effectiveDpi(asset, widthMm) >= minDpi;
  const warning = meets
    ? null
    : `This picture would print at about ${dpi} dpi at this size. Your print house asks for ${minDpi} or more, so it may look soft. ` +
      `Use a larger file, or make it smaller on the shirt. At ${minDpi} dpi this file can print up to ${largest} mm wide.`;
  return { applies: true, dpi, minDpi, meets, largestWidthMm: largest, warning, minDpiSource: MINIMUM_DPI_LABEL };
}

export type PrintScale = Readonly<{ x: number; y: number }>;

export type PlacedImageCheck = Readonly<{ layerId: string; assetId: string; widthMm: number; check: DpiCheck; note: string | null }>;

const NO_RESOLUTION_NOTE = "This file does not state its resolution, so 72 dpi was taken as its natural size.";

/**
 * The resolution of every placed picture in a stack, at the size it will print. `printScale` is the
 * shrink scale of the fabric (W2): a file printed larger than it is on the shirt has fewer dots per inch.
 * A missing asset (or another brand's) is left out, so the caller can say it is missing.
 */
export async function checkStackImages(
  stack: ArtworkStack,
  reader: AssetReader,
  options: Readonly<{ minDpi?: number; printScale?: PrintScale }> = {},
): Promise<readonly PlacedImageCheck[]> {
  const scale = options.printScale ?? { x: 1, y: 1 };
  const checks: PlacedImageCheck[] = [];
  for (const layer of stack.layers) {
    const placed =
      layer.kind === "graphic" && layer.source.kind === "asset"
        ? { assetId: layer.source.assetId, widthMm: layer.widthMm, natural: false }
        : layer.kind === "image-fill"
          ? { assetId: layer.assetId, widthMm: 0, natural: true, scale: layer.scale }
          : null;
    if (!placed) continue;
    const asset = await reader.getAsset(placed.assetId);
    if (!asset) continue;
    const naturalDpi = asset.dpiMeta ?? 72;
    const naturalMm = (asset.widthPx / naturalDpi) * MM_PER_INCH;
    const widthMm = placed.natural ? naturalMm * (placed.scale ?? 1) : placed.widthMm;
    checks.push({
      layerId: layer.id,
      assetId: placed.assetId,
      widthMm,
      check: dpiCheck(asset, widthMm * scale.x, options.minDpi),
      note: placed.natural && asset.dpiMeta === null && asset.kind === "raster" ? NO_RESOLUTION_NOTE : null,
    });
  }
  return checks;
}
