/**
 * Where a committee pin sits (spec F-T3 "a pin on the panel", plan v5 Z7, decision 0087).
 *
 * A pin is held the way a design comment holds one (decision 0063): a panel, and a distance across
 * and down in millimetres. This file turns a press on a drawing into those two distances, and gives
 * nine named places so the same pin can be put down with a keyboard alone. No zod, so a browser
 * component can import it (`tests/architecture/client-weight.test.ts`).
 */

/** The nine places, as thirds across and down. A keyboard reaches every one of them. */
export const PIN_PLACES = [
  { id: "top-left", label: "Top left", across: 1, down: 1 },
  { id: "top-centre", label: "Top centre", across: 2, down: 1 },
  { id: "top-right", label: "Top right", across: 3, down: 1 },
  { id: "middle-left", label: "Middle left", across: 1, down: 2 },
  { id: "middle-centre", label: "Middle", across: 2, down: 2 },
  { id: "middle-right", label: "Middle right", across: 3, down: 2 },
  { id: "bottom-left", label: "Bottom left", across: 1, down: 3 },
  { id: "bottom-centre", label: "Bottom centre", across: 2, down: 3 },
  { id: "bottom-right", label: "Bottom right", across: 3, down: 3 },
] as const;

export type PinPlace = (typeof PIN_PLACES)[number];
export type PinPlaceId = PinPlace["id"];

export const isPinPlaceId = (value: unknown): value is PinPlaceId => PIN_PLACES.some((place) => place.id === value);

/** The box a drawing covers, in millimetres, as `lib/flat/model` gives it. */
export interface PointBounds {
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface PinPoint {
  readonly xMm: number;
  readonly yMm: number;
}

/** One tenth of a millimetre, which is as fine as the pin is kept. */
const round = (value: number): number => Math.round(value * 10) / 10;

const clamp = (value: number, highest: number): number => Math.min(Math.max(value, 0), highest);

/** The middle of the named third of the box, which is where a keyboard puts a pin. */
export function pointOfPlace(place: PinPlace, bounds: PointBounds): PinPoint {
  const third = (step: number, length: number): number => (length * (step * 2 - 1)) / 6;
  return { xMm: round(third(place.across, bounds.widthMm)), yMm: round(third(place.down, bounds.heightMm)) };
}

/**
 * The point a press landed on. The press is given as a fraction of the picture's own box, which the
 * browser measures, so the picture's size on screen never changes where the pin lands.
 */
export function pointOfPress(fraction: Readonly<{ x: number; y: number }>, bounds: PointBounds): PinPoint {
  return {
    xMm: round(clamp(fraction.x * bounds.widthMm, bounds.widthMm)),
    yMm: round(clamp(fraction.y * bounds.heightMm, bounds.heightMm)),
  };
}

/** The named place a point falls in, so a press and the radio buttons always agree. */
export function placeOfPoint(point: PinPoint, bounds: PointBounds): PinPlace {
  const step = (value: number, length: number): number => (length <= 0 ? 2 : Math.min(3, Math.max(1, Math.floor((value / length) * 3) + 1)));
  const across = step(point.xMm, bounds.widthMm);
  const down = step(point.yMm, bounds.heightMm);
  return PIN_PLACES.find((place) => place.across === across && place.down === down) ?? PIN_PLACES[4];
}

/** Where to draw a pin on the picture, as a percentage from the left and the top. */
export function pinStyle(point: PinPoint, bounds: PointBounds): Readonly<{ left: string; top: string }> {
  const share = (value: number, length: number): string => `${length <= 0 ? 50 : round(clamp((value / length) * 100, 100))}%`;
  return { left: share(point.xMm, bounds.widthMm), top: share(point.yMm, bounds.heightMm) };
}

/** What a pin reads as in a list: who, where, and what they want changed. */
export const pinSummary = (name: string, panelLabel: string, placeLabel: string): string =>
  `${name}, on the ${panelLabel.toLowerCase()}, ${placeLabel.toLowerCase()}`;
