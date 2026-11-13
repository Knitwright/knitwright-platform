import type { AddItem, TaskBar, TaskItem } from "@/lib/launch";
import { worldToScreen, type Rect, type Size, type Viewport } from "@/lib/canvas";

/**
 * THE FLOATING TASK BAR (`08` §5.5; prototype e15 and e37; decision 0146).
 *
 * The bar's content is still the launch shell's (`lib/launch/task-bar.ts`, with `offeredBar` taking
 * off what has nothing behind it); this file only lays it out as Kittl does:
 *
 *   [up to three named actions] [n more ▾] | [duplicate] [download] [⋯]
 *
 * The named actions are the boards the selection can feed first ("AI Image board", "Mockup"…),
 * then the bar's own front items. Whatever does not fit goes behind "n more", which says how many.
 * Duplicate and Download are always icons at the end, and Delete lives in the ⋯ menu.
 */

export const FRONT_SLOTS = 3;

export type BarEntry = Readonly<{ kind: "add"; add: AddItem }> | Readonly<{ kind: "item"; item: TaskItem }>;

export interface LaidOutBar {
  readonly front: readonly BarEntry[];
  readonly more: readonly BarEntry[];
  /** "2 more", or null when nothing is behind it. */
  readonly moreLabel: string | null;
  readonly duplicate: TaskItem | null;
  readonly download: TaskItem | null;
  readonly remove: TaskItem | null;
}

const PINNED = new Set(["duplicate", "download", "remove"]);

export function layOutBar(bar: TaskBar, slots: number = FRONT_SLOTS): LaidOutBar {
  const named: BarEntry[] = [
    ...bar.add.map((add): BarEntry => ({ kind: "add", add })),
    ...bar.items.filter((item) => !PINNED.has(item.id) && !item.inMore).map((item): BarEntry => ({ kind: "item", item })),
  ];
  const tucked: BarEntry[] = bar.items.filter((item) => !PINNED.has(item.id) && item.inMore).map((item) => ({ kind: "item", item }));
  const front = named.slice(0, slots);
  const more = [...named.slice(slots), ...tucked];
  const find = (id: string): TaskItem | null => bar.items.find((item) => item.id === id) ?? null;
  return {
    front,
    more,
    moreLabel: more.length === 0 ? null : `${more.length} more`,
    duplicate: find("duplicate"),
    download: find("download"),
    remove: find("remove"),
  };
}

export const entryKey = (entry: BarEntry): string => (entry.kind === "add" ? `add-${entry.add.kind}` : entry.item.id);
export const entryLabel = (entry: BarEntry): string => (entry.kind === "add" ? entry.add.label : entry.item.label);

/** How far above a board's top edge the bar floats, in screen pixels (label 20 + gap). */
export const BAR_LIFT = 64;
export const BAR_MARGIN = 8;

/**
 * Where the bar's top-left corner goes on the canvas, in screen pixels: over the board's top-left,
 * lifted above its label, and held inside the canvas so it is never cut off. A board scrolled above
 * the screen keeps the bar at the top margin rather than losing it.
 */
export function barPlace(view: Viewport, box: Rect, screen: Size, barWidth: number): Readonly<{ left: number; top: number }> {
  const corner = worldToScreen(view, { x: box.x, y: box.y });
  const most = Math.max(BAR_MARGIN, screen.width - barWidth - BAR_MARGIN);
  return {
    left: Math.round(Math.min(Math.max(BAR_MARGIN, corner.x), most)),
    top: Math.round(Math.max(BAR_MARGIN, corner.y - BAR_LIFT)),
  };
}
