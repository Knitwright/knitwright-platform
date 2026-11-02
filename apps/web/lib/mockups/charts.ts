import sharp from "sharp";

/**
 * The two cards F-L1 asks the mockup library for: a **size-chart card** and a **colour-chart card**.
 *
 * They are drawn, not generated, and they state nothing they were not given. A size a brand has not
 * filled in reads "To be confirmed" -- the words this app already uses for a missing value -- rather
 * than a number somebody guessed, because a measurement nobody typed is not a measurement (plan
 * rule: no invented measurement). A colour with no swatch shows its code and an empty chip.
 *
 * The card is an SVG this file writes and sharp rasterises. The text uses whatever sans-serif the
 * host has, because no font may be committed to this repository; nothing about the card's meaning
 * depends on which one it is.
 */

/** The words this app uses for a value nobody has filled in. */
export const TO_BE_CONFIRMED = "To be confirmed";

export interface SizeChartRow {
  /** The point of measure, in the brand's own words. */
  readonly label: string;
  /** One value per size, in the order of `sizes`. Null for a size with no value on file. */
  readonly values: readonly (string | null)[];
}

export interface SizeChartCard {
  readonly title: string;
  readonly sizes: readonly string[];
  readonly rows: readonly SizeChartRow[];
  /** Where the figures came from. Never reads as settled. */
  readonly note: string;
}

export interface ColourSwatch {
  readonly name: string;
  /** `#rrggbb`, or null for a colour with a code and no swatch. */
  readonly hex: string | null;
  /** The brand's own colour code, such as a Pantone name. May be empty. */
  readonly code: string;
}

export interface ColourChartCard {
  readonly title: string;
  readonly swatches: readonly ColourSwatch[];
  readonly note: string;
}

/** The card's own size in pixels. A labelled default; a caller may ask for another. */
export const CARD = { width: 1024, height: 1024, pad: 56 } as const;

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const line = (x: number, y: number, size: number, weight: string, fill: string, text: string, anchor = "start"): string =>
  `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escape(text)}</text>`;

const INK = "#14181f";
const MUTED = "#5b636f";
const RULE = "#d8dbe0";

/** The size-chart card as an SVG. Pure: the same card gives the same string every time. */
export function sizeChartSvg(card: SizeChartCard, width: number = CARD.width, height: number = CARD.height): string {
  const { pad } = CARD;
  const columns = card.sizes.length + 1;
  const columnWidth = (width - pad * 2) / Math.max(1, columns);
  const top = pad + 120;
  const rowHeight = Math.min(64, (height - top - pad - 60) / Math.max(1, card.rows.length + 1));
  const head = card.sizes.map((size, at) => line(pad + columnWidth * (at + 1.5), top, 26, "600", INK, size, "middle")).join("");
  const body = card.rows
    .map((row, index) => {
      const y = top + rowHeight * (index + 1);
      const cells = card.sizes
        .map((_, at) => line(pad + columnWidth * (at + 1.5), y, 24, "400", row.values[at] === null || row.values[at] === undefined ? MUTED : INK, row.values[at] ?? TO_BE_CONFIRMED, "middle"))
        .join("");
      return `<line x1="${pad}" y1="${y - rowHeight * 0.68}" x2="${width - pad}" y2="${y - rowHeight * 0.68}" stroke="${RULE}" stroke-width="1"/>${line(pad, y, 24, "500", INK, row.label)}${cells}`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    line(pad, pad + 46, 44, "600", INK, card.title) +
    line(pad, pad + 86, 22, "400", MUTED, card.note) +
    head +
    body +
    `</svg>`
  );
}

/** The colour-chart card as an SVG. A colour with no swatch shows an empty chip and its code. */
export function colourChartSvg(card: ColourChartCard, width: number = CARD.width, height: number = CARD.height): string {
  const { pad } = CARD;
  const perRow = 3;
  const gap = 28;
  const chip = (width - pad * 2 - gap * (perRow - 1)) / perRow;
  const top = pad + 120;
  const chips = card.swatches
    .slice(0, perRow * 3)
    .map((swatch, at) => {
      const x = pad + (at % perRow) * (chip + gap);
      const y = top + Math.floor(at / perRow) * (chip + 86);
      const fill = swatch.hex ?? "#ffffff";
      const dashed = swatch.hex === null ? ` stroke-dasharray="8 6"` : "";
      return (
        `<rect x="${x}" y="${y}" width="${chip}" height="${chip}" rx="18" fill="${fill}" stroke="${RULE}" stroke-width="2"${dashed}/>` +
        line(x, y + chip + 32, 24, "500", INK, swatch.name) +
        line(x, y + chip + 60, 20, "400", MUTED, swatch.code === "" ? TO_BE_CONFIRMED : swatch.code)
      );
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    line(pad, pad + 46, 44, "600", INK, card.title) +
    line(pad, pad + 86, 22, "400", MUTED, card.note) +
    chips +
    `</svg>`
  );
}

/** An SVG card as a PNG, which is what a chart scene puts in its garment slot. */
export async function drawCard(svg: string): Promise<Uint8Array> {
  const out = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return new Uint8Array(out);
}

/** How many colours a card shows before it stops. The rest are in the tech pack, not on a card. */
export const COLOUR_CHIPS_SHOWN = 9;

/** How many rows of measurements a card shows before it stops. */
export const SIZE_ROWS_SHOWN = 10;
