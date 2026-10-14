/**
 * The limits of artwork intake. They are settings, not measurements: Knitwright's own defaults until a
 * print house gives its own (owner input P5 and P14).
 */
export const INTAKE_LIMITS = {
  /** The largest file taken in. */
  maxFileBytes: 50 * 1024 * 1024,
  /** Counted from the header, before the picture is decoded (decompression-bomb guard). */
  maxPixels: 100_000_000,
  maxEdgePx: 12_000,
  /** The screen copy, the same size as the older logo path keeps. */
  screenEdgePx: 2048,
  /** The biggest print copy kept. The exports bucket allows 50 MB, so there is room to spare. */
  maxPrintCopyBytes: 48 * 1024 * 1024,
  /** A vector file is text; this is far more than a logo needs. */
  maxVectorFileBytes: 5 * 1024 * 1024,
  /** The most time one file may take to read. */
  maxReadMs: 20_000,
  /** The most files being read at once for one brand. */
  maxInFlightPerBrand: 2,
} as const;

/** Limits on a vector file's structure. A file over any of them is refused. */
export const VECTOR_LIMITS = {
  maxNodes: 20_000,
  maxDepth: 32,
  maxPathCommands: 200_000,
  /** Copies made through `use`, counted over the whole file. */
  maxUseExpansions: 2_000,
  maxEmbeddedImages: 8,
  maxEmbeddedImageBytes: 4 * 1024 * 1024,
  maxGradientStops: 32,
  maxAttributeLength: 400_000,
} as const;

/** The dpi a print house is asked for. "Knitwright default, not from your print house" (P5, P14). */
export const DEFAULT_MIN_DPI = 150;

/** The dpi a PDF page is read at, and the most it may be read at. */
export const PDF_READ_DPI = 300;
