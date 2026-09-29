/**
 * Limits on a size chart file a brand imports. A chart has one row for each point of
 * measure and one column for each size, so these leave plenty of room and still keep a
 * hostile file small. Every limit is checked before any value is read.
 */
export const CHART_IMPORT_LIMITS = {
  /** The largest file accepted, in bytes. */
  maxBytes: 512 * 1024,
  /** Rows with something in them, the heading row included. */
  maxRows: 100,
  maxColumns: 40,
  /** The most characters one cell may hold. */
  maxCellLength: 100,
  /** A spreadsheet is a zip archive. These cap what it may unpack to. */
  maxZipEntries: 200,
  maxUnpackedBytes: 8 * 1024 * 1024,
  /** The most each byte of a packed entry may grow to. Ordinary sheets stay well under this. */
  maxPackingRatio: 200,
} as const;
