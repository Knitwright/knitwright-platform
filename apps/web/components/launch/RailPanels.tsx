import type { ReactNode } from "react";
import MockupsPanel from "@/components/mockups/MockupsPanel";
import PhotosPanel from "@/components/mockups/PhotosPanel";
import { panelPlaceholder, RAIL, RAIL_ITEMS, railPanelId, railTabId, type LaunchPanelProps, type RailId } from "@/lib/launch";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * The panels of the icon rail. All twelve are drawn and only the open one shows, so every tab's
 * `aria-controls` names a panel that really exists and a hidden panel keeps whatever was typed in
 * it -- the same arrangement the editor shell uses for its three toolbars.
 *
 * A panel another workstream has built is mounted here and given exactly `LaunchPanelProps`
 * (`lib/launch/panels.ts`); the rest still draw a labelled placeholder. **Mockups and Photos are
 * L2's** (decision 0092).
 */

/** The rail panels that are built, by their id. Everything else gets its placeholder. */
const BUILT: Partial<Record<RailId, (props: LaunchPanelProps) => ReactNode>> = {
  mockups: MockupsPanel,
  photos: PhotosPanel,
};

export function RailPanels({ open, panel }: Readonly<{ open: RailId; panel: LaunchPanelProps }>) {
  return (
    <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]">
      {RAIL_ITEMS.map((id) => (
        <RailPanel key={id} id={id} hidden={id !== open} panel={panel} />
      ))}
    </div>
  );
}

function RailPanel({ id, hidden, panel }: Readonly<{ id: RailId; hidden: boolean; panel: LaunchPanelProps }>) {
  const placeholder = panelPlaceholder(id);
  const Built = BUILT[id];
  return (
    <div
      id={railPanelId(id)}
      role="tabpanel"
      aria-labelledby={railTabId(id)}
      hidden={hidden}
      className="glass flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl p-4 lg:row-start-1"
    >
      {Built ? (
        <Built {...panel} />
      ) : (
        <>
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{RAIL[id].label}</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">{placeholder.note}</p>
          </header>
          <PanelPlaceholder id={id} />
        </>
      )}
    </div>
  );
}
