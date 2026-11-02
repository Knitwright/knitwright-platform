import type { LaunchContext } from "@/lib/launch";
import type { BoardView } from "@/lib/launch";
import { marketingSettings, type MarketingBoardSettings } from "./board";
import { buildLayouts } from "./templates/plans";
import type { MarketingLayout, MarketingSlot } from "./templates/types";

/**
 * WHAT A PANEL IS LOOKING AT (plan v5 L4, decision 0094).
 *
 * A panel is handed the whole `LaunchContext` and has to work out, every render, whether the thing
 * selected is a marketing board, which layout it is on, and what is in it. That is a question with
 * one answer, so it is answered here and tested here rather than in five components.
 *
 * The layout comes from the layout key in the board's settings and the layouts this code builds --
 * the same builder the 50 rows were seeded from (`templates/build.ts`). A board whose key names no
 * layout is a board with no layout: the panel then offers the one action that fixes it.
 */

export interface SelectedMarketing {
  readonly board: BoardView;
  readonly settings: MarketingBoardSettings;
  /** The layout the board is on, or null when it has none yet. */
  readonly layout: MarketingLayout | null;
  /** The layout's slots, or none. */
  readonly slots: readonly MarketingSlot[];
  /** True when the board's picture is selected rather than the board itself. */
  readonly image: boolean;
}

/** The marketing board the person has selected, or null for anything else (or nothing). */
export function selectedMarketing(context: LaunchContext, layouts: readonly MarketingLayout[] = buildLayouts()): SelectedMarketing | null {
  const selection = context.selection;
  if (selection === null || selection.board.kind !== "marketing") return null;
  const settings = marketingSettings(selection.board.settings);
  const layout = layouts.find((one) => one.key === settings.layoutKey) ?? null;
  return { board: selection.board, settings, layout, slots: layout?.slots ?? [], image: selection.image };
}

/** The marketing boards on the canvas, for a panel that offers to put something on one of them. */
export const marketingBoards = (context: LaunchContext): readonly BoardView[] =>
  context.project.boards.filter((board) => board.kind === "marketing");

/** The text and QR slots of a layout, which are the fields a person writes in. */
export const writableSlots = (slots: readonly MarketingSlot[]): readonly MarketingSlot[] =>
  slots.filter((slot) => slot.kind === "text" || slot.kind === "qr");

/** The slots a picture goes in: the mockups and the logo. */
export const pictureSlots = (slots: readonly MarketingSlot[]): readonly MarketingSlot[] =>
  slots.filter((slot) => slot.kind === "mockup" || slot.kind === "logo");

/** The slots a repeat print or a colour fills. */
export const shapeSlots = (slots: readonly MarketingSlot[]): readonly MarketingSlot[] => slots.filter((slot) => slot.kind === "shape");
