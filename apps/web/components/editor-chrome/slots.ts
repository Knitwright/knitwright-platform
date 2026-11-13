import type { ComponentType } from "react";
import type { LaunchPanelProps } from "@/lib/launch";

/**
 * THE EDITOR CHROME'S MOUNT POINTS (plan v6 E2, decision 0146), for the three workstreams that build
 * beside it in the same wave:
 *
 *   * **E4** fills the right panel's **Share**, **Export** and **Order** popovers (e27–e30) by
 *     setting `share`, `export` and `order` below to its own component. Until it does, each button
 *     opens a short popover with the real doors that exist today, so none of them is a dead link.
 *   * **E5** replaces the prompt pill over the dock (e34) by setting `PROMPT_BAR`. Until it does,
 *     the pill is the launch shell's prompt field and its Run button.
 *   * **E3** fills the inspector of each selection in `components/launch/Inspector.tsx` as before;
 *     the right panel mounts it under the Share · Export · Order row whenever a board is selected.
 *
 * Each is one line in this file, so the three pull requests do not meet anywhere else. A component
 * is given the panel contract's props (`lib/launch/panels.ts`) and `close`, which shuts its popover.
 */

export type PopoverSlotProps = LaunchPanelProps & Readonly<{ close: () => void }>;

export type PopoverSlot = "share" | "export" | "order";

export const POPOVER_SLOTS: Partial<Record<PopoverSlot, ComponentType<PopoverSlotProps>>> = {
  // share: SharePopover,   (E4)
  // export: ExportPopover, (E4)
  // order: OrderDrawer,    (E4)
};

/** What the prompt bar is given: the contract's props and the dock's credit balance. */
export type PromptSlotProps = LaunchPanelProps;

export const PROMPT_BAR: ComponentType<PromptSlotProps> | null = null; // (E5)
