import type { LayerState, MarketingBoardSettings } from "./board";
import { MARKETING_RULE } from "./rules";
import type { MarketingSlot } from "./templates/types";

/**
 * THE LAYERS PANEL (spec Launch shell: "Layers -- what is on the selected artboard, in order, with
 * opacity and locking"; plan v5 L4, decision 0094).
 *
 * A layer is a slot of the layout. The list is the layout's own order, which is the order the
 * drawing is made in, and the panel shows it top first because that is how a person reads a stack.
 *
 * **A pixel-locked slot cannot be unlocked.** The lock in the Layers panel is a person's own lock,
 * which they may put on and take off; the lock on a mockup is the garment lock, which they may not.
 * The row says which it is, so the panel never shows a control that would do nothing.
 */

export interface LayerRow {
  readonly slot: MarketingSlot;
  /** 1 for the bottom of the stack, counting up, as the drawing is made. */
  readonly depth: number;
  readonly hidden: boolean;
  readonly locked: boolean;
  readonly opacity: number;
  /** True when the lock is the garment lock and not a person's own. */
  readonly lockedByTheGarment: boolean;
  /** What the row says about itself, in one short line. */
  readonly note: string;
  readonly ruleId: string;
}

const stateOf = (settings: MarketingBoardSettings, slotId: string): LayerState | undefined => settings.layers.find((one) => one.slotId === slotId);

const noteOf = (slot: MarketingSlot, hidden: boolean): string => {
  if (hidden) return "Hidden; it is left out of the export.";
  if (slot.pixelLocked) return "A picture the platform drew. It is never moved, recoloured or redrawn.";
  if (slot.kind === "text") return `Text in your ${slot.style} style.`;
  if (slot.kind === "shape") return `Filled with your ${slot.colourRole} colour.`;
  return slot.label;
};

/** The layers of one artboard, top of the stack first. */
export function layerRows(slots: readonly MarketingSlot[], settings: MarketingBoardSettings): readonly LayerRow[] {
  return slots
    .map((slot, index) => {
      const state = stateOf(settings, slot.id);
      const hidden = state?.hidden ?? false;
      return {
        slot,
        depth: index + 1,
        hidden,
        locked: slot.pixelLocked || (state?.locked ?? false),
        opacity: state?.opacity ?? 100,
        lockedByTheGarment: slot.pixelLocked,
        note: noteOf(slot, hidden),
        ruleId: MARKETING_RULE,
      };
    })
    .reverse();
}

export type LayerVerdict =
  | Readonly<{ ok: true; settings: MarketingBoardSettings }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): LayerVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });

const withState = (settings: MarketingBoardSettings, slotId: string, change: Partial<LayerState>): MarketingBoardSettings => {
  const current = stateOf(settings, slotId) ?? { slotId, hidden: false, locked: false, opacity: 100 };
  const next = { ...current, ...change, slotId };
  return { ...settings, layers: [...settings.layers.filter((one) => one.slotId !== slotId), next] };
};

/** Hide or show one layer. A hidden layer is left out of the drawing and so out of every export. */
export const setHidden = (settings: MarketingBoardSettings, slot: MarketingSlot, hidden: boolean): LayerVerdict => ({
  ok: true,
  settings: withState(settings, slot.id, { hidden }),
});

/** Lock or unlock one layer. The garment's own lock cannot be taken off here, and says so. */
export function setLocked(settings: MarketingBoardSettings, slot: MarketingSlot, locked: boolean): LayerVerdict {
  if (slot.pixelLocked && !locked) {
    return refuse(`${slot.label} holds a picture the platform drew. That lock is not yours to take off.`);
  }
  return { ok: true, settings: withState(settings, slot.id, { locked }) };
}

/** How solid one layer is, from 0 to 100. Anything outside that is refused with the bounds. */
export function setOpacity(settings: MarketingBoardSettings, slot: MarketingSlot, opacity: number): LayerVerdict {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) return refuse("Opacity goes from 0 to 100.");
  return { ok: true, settings: withState(settings, slot.id, { opacity: Math.round(opacity) }) };
}

/** The slots the drawing leaves out: the hidden ones. */
export const hiddenSlots = (slots: readonly MarketingSlot[], settings: MarketingBoardSettings): readonly string[] =>
  slots.filter((slot) => stateOf(settings, slot.id)?.hidden === true).map((slot) => slot.id);

/** The slots that are drawn, in the layout's own order. */
export const drawnSlots = (slots: readonly MarketingSlot[], settings: MarketingBoardSettings): readonly MarketingSlot[] => {
  const hidden = new Set(hiddenSlots(slots, settings));
  return slots.filter((slot) => !hidden.has(slot.id));
};
