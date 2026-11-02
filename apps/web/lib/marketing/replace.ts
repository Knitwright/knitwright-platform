import { fillSlot, type FilledLayout, type SlotFill } from "./assets";
import { MARKETING_RULE } from "./rules";
import type { MarketingSlot } from "./templates/types";

/**
 * REPLACE KEEPS THE SIZE AND THE COLOURS (spec F-L2: "**Replace** keeps size and colours (Kittl
 * pattern)"; plan v5 L4, decision 0094).
 *
 * It keeps them because it cannot do anything else. A slot carries its own rectangle and its own
 * colour role, and a fill carries neither (`assets.ts`): replacing what is in a slot changes the
 * contents and leaves the slot alone. There is no code path in which a replacement resizes a slot,
 * because a replacement is not a slot.
 *
 * Two things follow, and both are what the spec asks for:
 *
 *   * a picture sits in the rectangle it was given, cropped to fill it, so a bigger or a differently
 *     shaped photograph does not move anything. The spec's own words for a scene are that
 *     "placement inside a photo scene is fixed by the scene's garment slot" and "users cannot drag
 *     the print area" (F-L1), and this is the same rule in the layout;
 *   * the colours stay the brand's, because a colour role is the slot's and a fill only carries the
 *     hex that role currently resolves to.
 */

/** How a picture sits in a slot's own rectangle. One value, because the rectangle never moves. */
export const PICTURE_FIT = "cover" as const;

/** What a replacement keeps, which the panel shows beside the Replace button. */
export interface Kept {
  readonly width: number;
  readonly height: number;
  readonly colourRole: string;
  readonly fit: typeof PICTURE_FIT;
}

export type ReplaceVerdict =
  | Readonly<{ ok: true; fills: ReadonlyMap<string, SlotFill>; kept: Kept }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): ReplaceVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });

const keptOf = (slot: MarketingSlot): Kept => ({
  width: slot.rect.width,
  height: slot.rect.height,
  colourRole: slot.colourRole,
  fit: PICTURE_FIT,
});

/**
 * Put something else in one slot of a layout. The slot keeps its place, its size and its colour
 * role; everything else in the layout is untouched. A fill the slot does not take, or a picture a
 * model made, is refused in the words `fillSlot` gives.
 */
export function replaceFill(
  slots: readonly MarketingSlot[],
  filled: FilledLayout,
  slotId: string,
  next: SlotFill,
): ReplaceVerdict {
  const slot = slots.find((one) => one.id === slotId);
  if (!slot) return refuse("That slot is not in this layout.");
  const verdict = fillSlot(slot, next);
  if (!verdict.ok) return refuse(verdict.reason);
  const fills = new Map(filled.fills);
  fills.set(slot.id, verdict.fill);
  return { ok: true, fills, kept: keptOf(slot) };
}

/** Take what is in a slot out again, leaving the slot itself exactly as it was. */
export function clearSlot(slots: readonly MarketingSlot[], filled: FilledLayout, slotId: string): ReplaceVerdict {
  const slot = slots.find((one) => one.id === slotId);
  if (!slot) return refuse("That slot is not in this layout.");
  const fills = new Map(filled.fills);
  fills.delete(slot.id);
  return { ok: true, fills, kept: keptOf(slot) };
}

/**
 * The hex a slot shows: the brand's own colour for the slot's role, or the layout's when the brand
 * has none on file. A slot never carries a colour of its own, which is why one click of "Apply your
 * brand" changes every slot at once (`07`: templates use colour roles, never fixed colours).
 */
export function colourFor(slot: MarketingSlot, brand: Readonly<Record<string, string>>, fallback: Readonly<Record<string, string>>): string | null {
  return brand[slot.colourRole] ?? fallback[slot.colourRole] ?? null;
}
