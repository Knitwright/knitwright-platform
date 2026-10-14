/**
 * The limits of artwork intake. They are settings, not measurements: a print house may want others
 * (open item P14). Every one is applied before the work it guards, so a hostile file costs little.
 */
export const ARTWORK_LIMITS = {
  /** Largest upload, in bytes. */
  maxBytes: 50 * 1024 * 1024,
  /** Refused before the picture is opened, so a small file that expands hugely is never decoded. */
  maxPixels: 100_000_000,
  maxEdge: 12_000,
  /** The small copy a browser is given. */
  screenEdge: 2048,
  /** The "exports" bucket holds 50 MB at most; the print copy stays under this. */
  maxPrintCopyBytes: 45 * 1024 * 1024,
  /** The largest picture the white box can be removed from in one request (it is held in memory as pixels). */
  maxRemoveWhitePixels: 30_000_000,
  /** The warning below this resolution. "Knitwright default, not from your print house" (open item P5). */
  minDpi: 150,
  /** Conversions running for one brand at once. */
  maxConversionsPerBrand: 2,
  vector: {
    maxFileBytes: 5 * 1024 * 1024,
    /** A PDF is read for its drawing only; its size is held lower than a picture's. */
    maxPdfBytes: 15 * 1024 * 1024,
    maxElements: 20_000,
    maxDepth: 32,
    maxPathCommands: 200_000,
    maxJsonBytes: 4 * 1024 * 1024,
    maxEmbeddedImages: 8,
    maxUseDepth: 8,
    /** Time allowed for reading one file. */
    maxParseMs: 5000,
  },
} as const;

export const MINIMUM_DPI_LABEL = "Knitwright default, not from your print house";
