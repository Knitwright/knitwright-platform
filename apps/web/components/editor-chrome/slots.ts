import type { ComponentType } from "react";
import { ExportSlot, OrderSlot, ShareSlot } from "@/components/order-boards/ProjectPanels";
import { PromptBar, type PromptBarProps } from "@/components/prompt-bar/PromptBar";
import type { LaunchPanelProps } from "@/lib/launch";

/**
 * THE EDITOR CHROME'S MOUNT POINTS (plan v6 E2, decision 0146), for the three workstreams that build
 * beside it in the same wave:
 *
 *   * **E4** fills the right panel's **Share**, **Export** and **Order** popovers (e27–e30) with its
 *     Share popover, Export popover and Order drawer (decision 0148), which keep every door the
 *     interim popovers offered.
 *   * **E5**'s prompt bar (e34, decision 0149) is `PROMPT_BAR`, mounted over the dock; the selected
 *     board's Run button and its cost sit beside it (`PromptPill.tsx`).
 *   * **E3** fills the inspector of each selection in `components/launch/Inspector.tsx` as before;
 *     the right panel mounts it under the Share · Export · Order row whenever a board is selected.
 *
 * Each is one line in this file, so the three pull requests do not meet anywhere else. A component
 * is given the panel contract's props (`lib/launch/panels.ts`) and `close`, which shuts its popover.
 */

export type PopoverSlotProps = LaunchPanelProps & Readonly<{ close: () => void }>;

export type PopoverSlot = "share" | "export" | "order";

export const POPOVER_SLOTS: Readonly<Record<PopoverSlot, ComponentType<PopoverSlotProps>>> = {
  share: ShareSlot, // E4, decision 0148
  export: ExportSlot, // E4, decision 0148
  order: OrderSlot, // E4, decision 0148
};

/** What the prompt bar is given: E5's own props (decision 0149). */
export type PromptSlotProps = PromptBarProps;

export const PROMPT_BAR: ComponentType<PromptSlotProps> = PromptBar; // E5, decision 0149
