"use client";

import { ChevronLeft, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { MARKETING_PANEL_COMPONENTS } from "@/components/marketing/panels";
import MockupsPanel from "@/components/mockups/MockupsPanel";
import PhotosPanel from "@/components/mockups/PhotosPanel";
import ShootsPanel from "@/components/shoots/ShootsPanel";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { entryFor, FLYOUT_ID, flyoutTitle, isMoreApp, railTab, type Flyout } from "@/lib/editor-chrome";
import { panelPlaceholder, RAIL_ITEMS, railPanelId, type LaunchPanelId, type LaunchPanelProps, type RailId } from "@/lib/launch";
import { LAUNCH_PANEL_COMPONENTS } from "./panels/panels";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * THE FLYOUT BESIDE THE RAIL (plan v6 E2, decision 0146; `08` §5.1 "flyout panel (320 px)",
 * prototype e03–e14): a title with ✕, and under it whichever the rail opened -- one of the editor's
 * own flyouts (Products, More, Learn, Layers, Help), handed in as `own`, or a launch panel.
 *
 * Every launch panel is drawn and only the open one shows, so a hidden panel keeps whatever was
 * typed in it -- the arrangement the launch rail had. A panel another workstream has built is
 * mounted here and given exactly `LaunchPanelProps` (`lib/launch/panels.ts`): **Mockups and Photos
 * are L2's** (decision 0092), **AI image is L3's** (0093), **Text, Elements, Pattern fills, AI
 * assistant and Layers are L4's** (0094), and **Templates, Uploads and Brand** came with their
 * libraries (0108). **`likes` is the one placeholder left**: nothing records a like (0108's owner
 * question).
 */

/**
 * Every panel that is built, by its id: L2's two, L3's one, and three workstreams' own registries
 * spread in rather than listed again. One map, made once, so nothing is looked up by calling a
 * function while the shell renders (`react-hooks/static-components`).
 */
export const RAIL_PANELS: Partial<Record<LaunchPanelId, ComponentType<LaunchPanelProps>>> = {
  "ai-image": ShootsPanel,
  mockups: MockupsPanel,
  photos: PhotosPanel,
  ...MARKETING_PANEL_COMPONENTS,
  ...LAUNCH_PANEL_COMPONENTS,
};

type Props = Readonly<{
  flyout: Flyout;
  panel: LaunchPanelProps;
  /** The editor's own flyout, when one is open. */
  own: ReactNode;
  onClose: () => void;
  /** Back to More, from an app More opened. */
  onBack: () => void;
}>;

export function RailPanels({ flyout, panel, own, onClose, onBack }: Props) {
  const lit = entryFor(flyout);
  const shown: RailId | null = flyout.kind === "panel" ? flyout.id : null;
  return (
    <section
      id={FLYOUT_ID}
      role="tabpanel"
      aria-labelledby={lit ? railTab(lit) : undefined}
      aria-label={lit ? undefined : "Panel"}
      hidden={flyout.kind === "closed"}
      data-testid="editor-flyout"
      className="flex w-full shrink-0 flex-col gap-3.5 overflow-y-auto border-r lg:h-full lg:w-80 border-border bg-bg px-3.5 py-4 text-small"
    >
      <header className="flex items-center gap-3 text-text-2">
        {isMoreApp(flyout) ? (
          <button type="button" onClick={onBack} aria-label="Back to More" className="grid size-8 place-items-center rounded-sm hover:bg-soft" data-testid="editor-flyout-back">
            <Icon icon={ChevronLeft} />
          </button>
        ) : null}
        <h2 className="flex-1 text-h3 font-semibold text-text">{flyoutTitle(flyout)}</h2>
        <button type="button" onClick={onClose} aria-label="Close panel" className="grid size-8 place-items-center rounded-sm hover:bg-soft" data-testid="editor-flyout-close">
          <Icon icon={X} />
        </button>
      </header>
      {flyout.kind === "own" ? own : null}
      {RAIL_ITEMS.filter((id) => id !== "layers").map((id) => (
        <RailPanel key={id} id={id} hidden={id !== shown} panel={panel} />
      ))}
    </section>
  );
}

/** One launch panel, or its labelled placeholder. Also used by the Layers flyout for L4's layer list. */
export function RailPanel({ id, hidden, panel, className }: Readonly<{ id: RailId; hidden: boolean; panel: LaunchPanelProps; className?: string }>): ReactNode {
  const Built = RAIL_PANELS[id];
  return (
    <div id={railPanelId(id)} hidden={hidden} className={cx("flex min-h-0 flex-col gap-3", className)} data-testid={`editor-panel-${id}`}>
      {Built ? (
        <Built {...panel} />
      ) : (
        <>
          <p className="text-small leading-relaxed text-muted">{panelPlaceholder(id).note}</p>
          <PanelPlaceholder id={id} />
        </>
      )}
    </div>
  );
}
