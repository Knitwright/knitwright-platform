import { LAUNCH_GAP_RULE } from "./boards";
import type { ArtboardPreset, Size } from "./types";

/**
 * The artboard size field of the right inspector (spec Launch shell): width and height in pixels,
 * inches or millimetres, with the presets beside them.
 *
 * The canvas itself is in pixels. A unit is only how a size is written and read, so switching from
 * millimetres to pixels never changes the artboard -- exactly as the editor's centimetre and inch
 * toggle never changes a design (`lib/units/length.ts`).
 *
 * **Every preset is a row, never a literal here.** `listArtboardPresets` reads
 * `launch_artboard_presets`, which the migration seeds with the sizes the spec names and a note on
 * each saying it was not reviewed by anyone. A size this file invented would be a number nobody
 * agreed to.
 */

export const ARTBOARD_UNITS = ["px", "in", "mm"] as const;
export type ArtboardUnit = (typeof ARTBOARD_UNITS)[number];

export const UNIT_LABELS: Readonly<Record<ArtboardUnit, string>> = { px: "Pixels", in: "Inches", mm: "Millimetres" };

/** The short form beside a number in a field. */
export const UNIT_SUFFIX: Readonly<Record<ArtboardUnit, string>> = { px: "px", in: "in", mm: "mm" };

export const MM_PER_INCH = 25.4;

/**
 * The dots per inch a physical size is read at. The spec's export panel offers exactly two: 72 for
 * a screen and 300 for print. Anything else would be a number the spec does not give.
 */
export const DPI_CHOICES: readonly number[] = [72, 300];
export const DEFAULT_DPI = 72;

/**
 * The smallest and largest artboard, in pixels. These are not prices or presets: they are the
 * bounds the canvas can draw and the database stores, and the migration's own checks match them.
 */
export const MIN_ARTBOARD_PX = 16;
export const MAX_ARTBOARD_PX = 20_000;

const INCHES_PER_PX = (dpi: number): number => 1 / dpi;

/** A length in pixels, written in the unit asked for, at the given dots per inch. */
export function fromPixels(px: number, unit: ArtboardUnit, dpi: number = DEFAULT_DPI): number {
  if (unit === "px") return px;
  const inches = px * INCHES_PER_PX(dpi);
  return unit === "in" ? inches : inches * MM_PER_INCH;
}

/** A length written in a unit, back in pixels. */
export function toPixels(value: number, unit: ArtboardUnit, dpi: number = DEFAULT_DPI): number {
  if (unit === "px") return value;
  const inches = unit === "in" ? value : value / MM_PER_INCH;
  return inches * dpi;
}

/** How many decimal places a unit is written to: pixels are whole, a physical size is not. */
const PLACES: Readonly<Record<ArtboardUnit, number>> = { px: 0, in: 2, mm: 1 };

/** A length in pixels, written for a field in the unit asked for. */
export const writeLength = (px: number, unit: ArtboardUnit, dpi: number = DEFAULT_DPI): string =>
  fromPixels(px, unit, dpi).toFixed(PLACES[unit]);

/** The live print size the export panel shows under the fields, such as "16.67 in × 16.67 in". */
export function printSize(size: Size, unit: ArtboardUnit, dpi: number = DEFAULT_DPI): string {
  const suffix = UNIT_SUFFIX[unit];
  return `${writeLength(size.width, unit, dpi)} ${suffix} × ${writeLength(size.height, unit, dpi)} ${suffix}`;
}

export type SizeVerdict = Readonly<{ ok: true; size: Size }> | Readonly<{ ok: false; reason: string; ruleId: string }>;

const whole = (value: number): number => Math.round(value);

/**
 * The size a typed width and height mean, in pixels, or why they cannot be used. Nothing is
 * silently clamped: a number outside the bounds is refused with the bounds in the message, so the
 * person sees what happened rather than finding a different size than they typed.
 */
export function readSize(width: number, height: number, unit: ArtboardUnit, dpi: number = DEFAULT_DPI): SizeVerdict {
  const refuse = (reason: string): SizeVerdict => ({ ok: false, reason, ruleId: LAUNCH_GAP_RULE });
  if (!Number.isFinite(width) || !Number.isFinite(height)) return refuse("Give a width and a height.");
  if (width <= 0 || height <= 0) return refuse("A width and a height are more than nothing.");
  const size = { width: whole(toPixels(width, unit, dpi)), height: whole(toPixels(height, unit, dpi)) };
  const smallest = writeLength(MIN_ARTBOARD_PX, unit, dpi);
  const largest = writeLength(MAX_ARTBOARD_PX, unit, dpi);
  if (size.width < MIN_ARTBOARD_PX || size.height < MIN_ARTBOARD_PX) return refuse(`The smallest artboard is ${smallest} ${UNIT_SUFFIX[unit]}.`);
  if (size.width > MAX_ARTBOARD_PX || size.height > MAX_ARTBOARD_PX) return refuse(`The largest artboard is ${largest} ${UNIT_SUFFIX[unit]}.`);
  return { ok: true, size };
}

/** The size a preset row means, in pixels. */
export const presetSize = (preset: ArtboardPreset): Size => ({
  width: whole(toPixels(preset.width, preset.unit, preset.dpi)),
  height: whole(toPixels(preset.height, preset.unit, preset.dpi)),
});

/** The preset the artboard matches now, so the list can mark it, or null for a size of its own. */
export function matchingPreset(size: Size, presets: readonly ArtboardPreset[]): ArtboardPreset | null {
  return presets.find((preset) => {
    const theirs = presetSize(preset);
    return theirs.width === size.width && theirs.height === size.height;
  }) ?? null;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The aspect of a size in its simplest whole numbers, such as "4:5". Shown beside the fields. */
export function aspectOf(size: Size): string {
  const divisor = gcd(Math.max(size.width, size.height), Math.min(size.width, size.height)) || 1;
  return `${size.width / divisor}:${size.height / divisor}`;
}

const isUnit = (value: string): value is ArtboardUnit => (ARTBOARD_UNITS as readonly string[]).includes(value);

/** The unit a stored project or an address names. Anything unknown means pixels. */
export const artboardUnit = (value: unknown): ArtboardUnit => (typeof value === "string" && isUnit(value) ? value : "px");
