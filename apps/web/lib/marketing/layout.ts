import type { Size } from "@/lib/launch";
import { MARKETING_RULE } from "./rules";
import type { MarketingSlot, SlotRect } from "./templates/types";

/**
 * FRACTIONS INTO PIXELS (plan v5 L4, decision 0094).
 *
 * A slot is a fraction of the artboard (`templates/types.ts`), so one layout fits every format `07`
 * gives it. This file is the one place that turns a fraction into a rectangle on an artboard of a
 * given size, and the one place that says whether a layout fits.
 *
 * The mockup slot is the fixed point. The spec's own words for the campaign workflow are that "AI
 * here may restyle the layout and background, but placed mockups stay pixel-locked", so a placed
 * picture's rectangle is never moved, scaled to fit text, or cropped to make room: anything that
 * would overlap it is refused by `placementVerdict` instead.
 */

/** One slot on a real artboard, in whole pixels from the artboard's top left. */
export interface PlacedSlot {
  readonly slot: MarketingSlot;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const whole = (value: number): number => Math.round(value);

/** The rectangle a fraction means on an artboard of this size. */
export const placeRect = (rect: SlotRect, size: Size): Omit<PlacedSlot, "slot"> => ({
  x: whole(rect.x * size.width),
  y: whole(rect.y * size.height),
  width: whole(rect.width * size.width),
  height: whole(rect.height * size.height),
});

/** Every slot of a layout, on an artboard of this size, in the order the layout lists them. */
export const place = (slots: readonly MarketingSlot[], size: Size): readonly PlacedSlot[] =>
  slots.map((one) => ({ slot: one, ...placeRect(one.rect, size) }));

/** The percentages a preview uses, so the panel can draw a layout at any size without maths of its own. */
export const asPercent = (rect: SlotRect): Readonly<Record<"left" | "top" | "width" | "height", string>> => ({
  left: `${(rect.x * 100).toFixed(3)}%`,
  top: `${(rect.y * 100).toFixed(3)}%`,
  width: `${(rect.width * 100).toFixed(3)}%`,
  height: `${(rect.height * 100).toFixed(3)}%`,
});

const inside = (rect: SlotRect): boolean =>
  rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 1.0001 && rect.y + rect.height <= 1.0001;

const overlaps = (a: SlotRect, b: SlotRect): boolean =>
  a.x < b.x + b.width - 0.0001 && b.x < a.x + a.width - 0.0001 && a.y < b.y + b.height - 0.0001 && b.y < a.y + a.height - 0.0001;

/** A slot that covers the whole artboard, which is the background rather than something placed on it. */
const isBackdrop = (one: MarketingSlot): boolean => one.kind === "shape" && one.rect.width >= 1 && one.rect.height >= 1;

export type PlacementVerdict =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

/**
 * Whether a set of slots can be laid out as it stands: every slot inside the artboard, and nothing
 * over a pixel-locked picture. A layout that fails is refused with the slot named, because a layout
 * that quietly moved a mockup would have redrawn the garment's place in the picture.
 */
export function placementVerdict(slots: readonly MarketingSlot[]): PlacementVerdict {
  const refuse = (reason: string): PlacementVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });
  const placed = slots.filter((one) => !isBackdrop(one));
  for (const one of placed) {
    if (!inside(one.rect)) return refuse(`${one.label} does not fit on the artboard.`);
  }
  const locked = placed.filter((one) => one.pixelLocked);
  for (const one of locked) {
    const clash = placed.find((other) => other !== one && !other.pixelLocked && overlaps(one.rect, other.rect));
    if (clash) return refuse(`${clash.label} would cover ${one.label}, and a placed mockup is never moved or covered.`);
  }
  return { ok: true };
}

/** The pixel-locked slots of a layout: the pictures the platform drew, which nothing redraws. */
export const lockedSlots = (slots: readonly MarketingSlot[]): readonly MarketingSlot[] => slots.filter((one) => one.pixelLocked);

/** How many mockups a layout expects, which is how many boards may feed its marketing board. */
export const mockupCount = (slots: readonly MarketingSlot[]): number => lockedSlots(slots).length;
