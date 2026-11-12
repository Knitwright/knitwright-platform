/**
 * Where a rail menu's panel sits (decision 0138). The rail scrolls when Orders, Store and Team are
 * open on a short window, and a scrolling box clips anything positioned inside it, so a rail menu's
 * panel is fixed to the window instead: 8 px to the right of its trigger (10 §8), its top level with
 * the trigger's top, or for a menu at the foot of the rail its bottom level with the trigger's bottom.
 */

export interface Box {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type FixedPlace = Readonly<{ left: number; top?: number; bottom?: number }>;

/** The gap between a trigger and its panel (10 §8: "anchored 8 px" from its trigger). */
export const PANEL_GAP = 8;

export const besideTrigger = (trigger: Box, align: "start" | "end", windowHeight: number): FixedPlace =>
  align === "start"
    ? { left: trigger.right + PANEL_GAP, top: Math.max(PANEL_GAP, trigger.top) }
    : { left: trigger.right + PANEL_GAP, bottom: Math.max(PANEL_GAP, windowHeight - trigger.bottom) };
