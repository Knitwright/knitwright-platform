import type { ComponentType } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import { MARKETING_PANELS, type MarketingPanelId } from "@/lib/marketing";
import AssistantPanel from "./AssistantPanel";
import ElementsPanel from "./ElementsPanel";
import LayersPanel from "./LayersPanel";
import MarketingBoardPanel from "./MarketingBoardPanel";
import PatternFillsPanel from "./PatternFillsPanel";
import TextPanel from "./TextPanel";

/**
 * THE SIX PANELS, FOR THE WIRING STEP (L1's contract, `lib/launch/panels.ts`; plan v5 L4,
 * decision 0094).
 *
 * The shell draws `panelPlaceholder(id)` wherever a panel is not built, and mounting one is a
 * lookup: `MARKETING_PANEL_COMPONENTS[id]`. Every entry is a default export taking exactly
 * `LaunchPanelProps`, so `next/dynamic` can load it, and the map is in this workstream's own file
 * so that five workstreams adding panels in the same wave do not conflict on one registry.
 *
 * `components/launch/RailPanels.tsx` and `components/launch/Inspector.tsx` belong to L1, so this
 * branch does not edit them. The pull request says exactly which two lines mount these.
 */
export const MARKETING_PANEL_COMPONENTS: Readonly<Record<MarketingPanelId, ComponentType<LaunchPanelProps>>> = {
  text: TextPanel,
  elements: ElementsPanel,
  "pattern-fills": PatternFillsPanel,
  assistant: AssistantPanel,
  layers: LayersPanel,
  "board-marketing": MarketingBoardPanel,
};

/** The panel for an id this workstream fills, or null for one it does not. */
export function marketingPanel(id: string): ComponentType<LaunchPanelProps> | null {
  return (MARKETING_PANELS as readonly string[]).includes(id) ? MARKETING_PANEL_COMPONENTS[id as MarketingPanelId] : null;
}
