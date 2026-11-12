/**
 * The keyboard rules the library's widgets share, apart from React so they can be tested. They
 * follow the WAI-ARIA authoring practices: arrows move, Home and End jump, and the move wraps.
 */

export type Orientation = "horizontal" | "vertical";

const FORWARD: Readonly<Record<Orientation, string>> = { horizontal: "ArrowRight", vertical: "ArrowDown" };
const BACK: Readonly<Record<Orientation, string>> = { horizontal: "ArrowLeft", vertical: "ArrowUp" };

/**
 * The index a key moves to in a row of `count` items, skipping the ones `enabled` says no to.
 * Null when the key is not a move key, or nothing can take the move.
 */
export function moveIndex(
  current: number,
  key: string,
  count: number,
  orientation: Orientation = "horizontal",
  enabled: (index: number) => boolean = () => true,
): number | null {
  if (count <= 0) return null;
  if (key === "Home") return firstFrom(0, 1, count, enabled);
  if (key === "End") return firstFrom(count - 1, -1, count, enabled);
  const step = key === FORWARD[orientation] ? 1 : key === BACK[orientation] ? -1 : 0;
  if (step === 0) return null;
  const start = current < 0 ? (step === 1 ? 0 : count - 1) : (current + step + count) % count;
  return firstFrom(start, step, count, enabled);
}

function firstFrom(start: number, step: 1 | -1, count: number, enabled: (index: number) => boolean): number | null {
  for (let tries = 0, index = start; tries < count; tries += 1, index = (index + step + count) % count) {
    if (enabled(index)) return index;
  }
  return null;
}

/**
 * Where Tab goes inside a focus trap of `count` focusable elements (a modal, §8): past the last
 * it wraps to the first, before the first (Shift+Tab) to the last. Focus outside the trap
 * (`current` is -1) comes back to the first, or the last going backwards.
 */
export function trapIndex(current: number, count: number, backwards: boolean): number | null {
  if (count === 0) return null;
  if (current < 0) return backwards ? count - 1 : 0;
  if (backwards) return current === 0 ? count - 1 : null;
  return current === count - 1 ? 0 : null;
}

/** The elements a trap may send focus to, in order. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A number field's arrow keys (§8 "Number with unit"): up and down step by 1, by 10 with Shift,
 * and the value stays inside min and max. Null for any other key.
 */
export function stepNumber(
  value: number,
  key: string,
  shift: boolean,
  bounds: Readonly<{ min?: number; max?: number; step?: number; bigStep?: number }> = {},
): number | null {
  const direction = key === "ArrowUp" ? 1 : key === "ArrowDown" ? -1 : 0;
  if (direction === 0) return null;
  const size = shift ? (bounds.bigStep ?? 10) : (bounds.step ?? 1);
  return clamp(roundTo(value + direction * size, Math.max(decimalsOf(size), decimalsOf(value))), bounds.min, bounds.max);
}

/** Keeps a value inside optional bounds. */
export const clamp = (value: number, min?: number, max?: number): number =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));

const decimalsOf = (value: number): number => (String(value).split(".")[1] ?? "").length;

/** Removes the float noise a step leaves (0.1 + 0.2), never dropping a decimal the value had. */
const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));
