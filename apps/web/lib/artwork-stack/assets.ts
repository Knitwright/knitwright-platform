/** How an uploaded file was colour managed. The print copy is always sRGB after intake; this names where it came from. */
export const ASSET_COLOUR_SPACES = ["srgb", "cmyk", "grey", "adobe-rgb", "display-p3", "unknown"] as const;
export type AssetColourSpace = (typeof ASSET_COLOUR_SPACES)[number];

/**
 * One user asset as the print files and the design reader see it. Interface only: the artwork intake (W7b) builds it.
 * A vector asset is stored as restricted vector JSON, never as SVG; its print copy is that JSON.
 */
export interface ArtworkAsset {
  readonly id: string;
  readonly kind: "raster" | "vector";
  readonly widthPx: number;
  readonly heightPx: number;
  /** The resolution the file states, or null when it states none. */
  readonly dpiMeta: number | null;
  readonly colourSpace: AssetColourSpace;
  readonly hasAlpha: boolean;
  /** The full resolution copy. Only the print files read it. */
  readPrintCopy(): Promise<Uint8Array>;
  /** The small copy a browser may be given. */
  readScreenCopy(): Promise<Uint8Array>;
}

export interface AssetReader {
  /** Null when there is no such asset for this brand. */
  getAsset(assetId: string): Promise<ArtworkAsset | null>;
}
