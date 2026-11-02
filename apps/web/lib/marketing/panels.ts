import type { LaunchPanelId } from "@/lib/launch";
import { MARKETING_RULE } from "./rules";

/**
 * THE PANELS THIS WORKSTREAM FILLS (L1's contract, `lib/launch/panels.ts`; plan v5 L4, decision 0094).
 *
 * Five on the icon rail and one inspector, each a default export in `components/marketing` taking
 * exactly `LaunchPanelProps`. This file is the list, the words each panel says about itself, and
 * the one action that fills an empty one -- so a panel's empty state is data a test can read rather
 * than a sentence buried in markup.
 *
 * The shell draws `panelPlaceholder(id)` in these places until the wiring step points them at the
 * components here. The pull request says which lines that is.
 */

export const MARKETING_PANELS = ["text", "elements", "pattern-fills", "assistant", "layers", "board-marketing"] as const;
export type MarketingPanelId = (typeof MARKETING_PANELS)[number];

export interface PanelWords {
  readonly id: MarketingPanelId;
  readonly title: string;
  /** One line under the title: what the panel is for. */
  readonly lead: string;
  /** What the panel says when there is nothing in it, which names the one action that fills it. */
  readonly empty: string;
  /** The words on that action. */
  readonly action: string;
  readonly ruleId: string;
}

const panel = (id: MarketingPanelId, title: string, lead: string, empty: string, action: string): PanelWords => ({
  id,
  title,
  lead,
  empty,
  action,
  ruleId: MARKETING_RULE,
});

export const PANEL_WORDS: Readonly<Record<MarketingPanelId, PanelWords>> = {
  text: panel(
    "text",
    "Text",
    "Headline, subheadline and body text, in your brand's own styles.",
    "Nothing to write on yet. Add a marketing board and pick a layout, and its text fields appear here.",
    "Add a marketing board",
  ),
  elements: panel(
    "elements",
    "Elements",
    "Bands, sashes, chevrons and badges, drawn by the platform in your brand colours.",
    "Nothing to place them on yet. Add a marketing board first.",
    "Add a marketing board",
  ),
  "pattern-fills": panel(
    "pattern-fills",
    "Pattern fills",
    "Your repeat prints, as the fill behind a layout.",
    "No repeat print on this brand yet. Make one in the repeat maker and it shows up here.",
    "Add a marketing board",
  ),
  assistant: panel(
    "assistant",
    "AI assistant",
    "Write for me: copy in your brand's voice and tone, for one field at a time.",
    "Pick a text field on a marketing board and Write for me offers three lines for it.",
    "Add a marketing board",
  ),
  layers: panel(
    "layers",
    "Layers",
    "What is on the selected artboard, in order, with opacity and locking.",
    "Nothing on this artboard yet. Add a marketing board and pick a layout.",
    "Add a marketing board",
  ),
  "board-marketing": panel(
    "board-marketing",
    "Marketing board",
    "The layout's slots, Replace, Write for me and the export panel.",
    "This board has no layout yet. Pick one of the 50 marketing templates.",
    "Pick a layout",
  ),
};

/** Every panel id this workstream fills is one the shell knows about. */
export const marketingPanelIds: readonly LaunchPanelId[] = MARKETING_PANELS;

/** True when this panel id belongs to this workstream. */
export const isMarketingPanel = (id: LaunchPanelId): id is MarketingPanelId => (MARKETING_PANELS as readonly string[]).includes(id);
