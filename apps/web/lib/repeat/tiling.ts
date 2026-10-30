import type { RepeatStyle, TileSize } from "./types";

/**
 * Where the tile goes. One tile and one style give every other tile's place, so the preview, the
 * print file and the 3D texture all lay a repeat out the same way and nobody lays it out by hand.
 *
 * The four styles (spec F-S4):
 *   full drop  the tile repeats straight across and straight down;
 *   half drop  every second column drops by half the tile's height;
 *   brick      every second row shifts across by half the tile's width;
 *   mirror     every second column is flipped across, every second row flipped down.
 */

/** One laid tile: where its top-left corner is, which column and row it is, and how it is flipped. */
export type Placement = Readonly<{
  column: number;
  row: number;
  /** Tenths of a millimetre from the covered area's top-left corner. */
  xTenths: number;
  yTenths: number;
  flipX: boolean;
  flipY: boolean;
}>;

const isOdd = (n: number): boolean => Math.abs(n % 2) === 1;

/** How far the tile at this column and row is moved from the plain grid, in tenths of a millimetre. */
export function styleShift(style: RepeatStyle, column: number, row: number, tile: TileSize): Readonly<{ dx: number; dy: number }> {
  if (style === "half-drop") return { dx: 0, dy: isOdd(column) ? Math.round(tile.heightTenths / 2) : 0 };
  if (style === "brick") return { dx: isOdd(row) ? Math.round(tile.widthTenths / 2) : 0, dy: 0 };
  return { dx: 0, dy: 0 };
}

/** Whether the tile at this column and row is flipped. Only a mirror repeat flips anything. */
export function styleFlip(style: RepeatStyle, column: number, row: number): Readonly<{ flipX: boolean; flipY: boolean }> {
  if (style !== "mirror") return { flipX: false, flipY: false };
  return { flipX: isOdd(column), flipY: isOdd(row) };
}

/**
 * The smallest block that repeats without change: what a print file has to hold once. A full drop
 * repeats the tile itself; a half drop takes two columns, a brick two rows, and a mirror both.
 */
export function repeatPeriod(style: RepeatStyle, tile: TileSize): TileSize {
  const across = style === "half-drop" || style === "mirror" ? 2 : 1;
  const down = style === "brick" || style === "mirror" ? 2 : 1;
  return { widthTenths: tile.widthTenths * across, heightTenths: tile.heightTenths * down };
}

/** The area a repeat is laid across, in tenths of a millimetre. */
export type Area = Readonly<{ widthTenths: number; heightTenths: number }>;

const MAX_PLACEMENTS = 4096;

/**
 * Every tile needed to cover the area, in reading order. A style that shifts tiles starts one
 * column or row early, so the shifted tiles still cover the top and left edges rather than
 * leaving a bare strip. Never more than `MAX_PLACEMENTS` tiles: a tile a tenth of a millimetre
 * wide across a pitch would be millions, and a preview is not worth freezing a browser for.
 */
export function placements(style: RepeatStyle, tile: TileSize, area: Area): readonly Placement[] {
  if (tile.widthTenths <= 0 || tile.heightTenths <= 0) return [];
  const shiftsDown = style === "half-drop" || style === "mirror";
  const shiftsAcross = style === "brick" || style === "mirror";
  const firstColumn = shiftsDown ? -1 : 0;
  const firstRow = shiftsAcross ? -1 : 0;
  const lastColumn = Math.ceil(area.widthTenths / tile.widthTenths);
  const lastRow = Math.ceil(area.heightTenths / tile.heightTenths);
  const out: Placement[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (out.length >= MAX_PLACEMENTS) return out;
      const shift = styleShift(style, column, row, tile);
      const flip = styleFlip(style, column, row);
      out.push({
        column,
        row,
        xTenths: column * tile.widthTenths + shift.dx,
        yTenths: row * tile.heightTenths + shift.dy,
        flipX: flip.flipX,
        flipY: flip.flipY,
      });
    }
  }
  return out;
}

/** How many tiles cover the area, which is what the panel shows beside the tile size. */
export const tileCount = (style: RepeatStyle, tile: TileSize, area: Area): number => placements(style, tile, area).length;
