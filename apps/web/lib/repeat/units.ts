import { TILE_UNITS, type TileUnit } from "./types";

/**
 * Tile sizes in centimetres and inches, read into and written out of tenths of a millimetre.
 * `lib/projects/measurement-input.ts` does the same for a garment measurement in centimetres; a
 * tile also takes inches, and its range is its own, so the reading lives here.
 *
 * The smallest and largest tile are Knitwright's own defaults, labelled as such: no print house has
 * told us what it will hold, and the owner question in the decision record asks.
 */

export const TENTHS_PER_CM = 100;
export const TENTHS_PER_INCH = 254;

/** Knitwright default, not reviewed by a print house: 1 cm to 200 cm. */
export const TILE_MIN_TENTHS = 100;
export const TILE_MAX_TENTHS = 20_000;
export const TILE_RANGE_LABEL = "Knitwright default, not reviewed by a print house";

export const tenthsPerUnit = (unit: TileUnit): number => (unit === "cm" ? TENTHS_PER_CM : TENTHS_PER_INCH);

export const unitWord = (unit: TileUnit): string => (unit === "cm" ? "cm" : "in");

/** True for one of the two units a person may type in. Anything else is not a unit. */
export const isTileUnit = (value: unknown): value is TileUnit => TILE_UNITS.includes(value as TileUnit);

/** A size in a unit, to tenths of a millimetre, rounded to the nearest tenth. */
export const toTenths = (value: number, unit: TileUnit): number => Math.round(value * tenthsPerUnit(unit));

/** Tenths of a millimetre back to the unit, to two places, which is finer than any tile is cut. */
export const fromTenths = (tenths: number, unit: TileUnit): number => Math.round((tenths / tenthsPerUnit(unit)) * 100) / 100;

/** What a field shows: the size in its unit, with no trailing zeros. */
export const tileText = (tenths: number, unit: TileUnit): string => String(fromTenths(tenths, unit));

/** The size with its unit, for a sentence: "10 cm", "3.94 in". */
export const tileSentence = (tenths: number, unit: TileUnit): string => `${tileText(tenths, unit)} ${unitWord(unit)}`;

export type TileRead = Readonly<{ ok: true; tenths: number }> | Readonly<{ ok: false; reason: string }>;

const NUMBER_SHAPE = /^\d{1,4}(\.\d{1,2})?$/;

const rangeRule = (unit: TileUnit): string =>
  `Enter a tile size from ${tileText(TILE_MIN_TENTHS, unit)} to ${tileText(TILE_MAX_TENTHS, unit)} ${unitWord(unit)}.`;

/**
 * Reads what a person typed into a tile side. A side outside the range is refused with the range
 * in it, so the field never silently changes what they typed.
 */
export function parseTileInput(text: string, unit: TileUnit): TileRead {
  const trimmed = text.trim();
  if (!NUMBER_SHAPE.test(trimmed)) return { ok: false, reason: rangeRule(unit) };
  const tenths = toTenths(Number(trimmed), unit);
  if (tenths < TILE_MIN_TENTHS || tenths > TILE_MAX_TENTHS) return { ok: false, reason: rangeRule(unit) };
  return { ok: true, tenths };
}

/** The range a field shows beside itself, in the unit being typed. */
export const tileRangeSentence = (unit: TileUnit): string =>
  `Tile ${tileText(TILE_MIN_TENTHS, unit)} to ${tileText(TILE_MAX_TENTHS, unit)} ${unitWord(unit)} · ${TILE_RANGE_LABEL}`;

/** True when both sides of the tile are inside the range. */
export const tileInRange = (tenths: number): boolean => tenths >= TILE_MIN_TENTHS && tenths <= TILE_MAX_TENTHS;

/**
 * The resolution a picture lands at, at the size it is drawn: pixels across, over the width in
 * inches. Zero where the width is zero, so no check divides by nothing.
 */
export const effectiveDpi = (pixels: number, widthTenths: number): number =>
  widthTenths <= 0 ? 0 : Math.round((pixels / (widthTenths / TENTHS_PER_INCH)) * 10) / 10;
