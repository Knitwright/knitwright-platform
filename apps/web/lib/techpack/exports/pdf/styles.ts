/** Sizes and colours of the PDF. The colours are those of the screen: see plans/design-reference.md. */

export const COLOURS = {
  ink: "#0f1012",
  ink2: "#2a2c31",
  muted: "#62656d",
  line: "#d9d9dd",
  head: "#ededee",
  warn: "#9a5a08",
  warnWash: "#f8efdf",
} as const;

export const SIZES = {
  title: 20,
  section: 14,
  table: 10,
  body: 9,
  cell: 8,
  small: 6.5,
  footer: 7.5,
} as const;

/** A4 in points, 72 to the inch. */
export const A4 = { width: 595.28, height: 841.89 } as const;

export const MARGIN = { top: 40, bottom: 56, side: 36 } as const;

export const CONTENT_WIDTH = A4.width - 2 * MARGIN.side;
