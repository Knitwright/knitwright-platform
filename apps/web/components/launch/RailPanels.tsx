import type { ComponentType, ReactNode } from "react";
import MockupsPanel from "@/components/mockups/MockupsPanel";
import PhotosPanel from "@/components/mockups/PhotosPanel";
import { panelPlaceholder, RAIL, RAIL_ITEMS, railPanelId, railTabId, type LaunchPanelId, type LaunchPanelProps, type RailId } from "@/lib/launch";
import { LAUNCH_PANEL_COMPONENTS } from "./panels/panels";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * The panels of the icon rail. All twelve are drawn and only the open one shows, so every tab's
 * `aria-controls` names a panel that really exists and a hidden panel keeps whatever was typed in
 * it -- the same arrangement the editor shell uses for its three toolbars.
 *
 * A panel another workstream has built is mounted here and given exactly `LaunchPanelProps`
 * (`lib/launch/panels.ts`); the rest still draw a labelled placeholder. **Mockups and Photos are
 * L2's** (decision 0092). **Templates, Uploads and Brand** are the panels whose workstreams were
 * given a library and no component path, built in `components/launch/panels/**` (decision 0106).
 *
 * `likes` and `ai-image` still hold their placeholders: nothing in the platform records a like
 * (decision 0106's owner question), and the AI image panel is L3's.
 */

/**
 * Every panel that is built, by its id: L2's two, and the three of
 * `components/launch/panels/panels.ts` spread in rather than listed again. One map, made once, so
 * nothing is looked up by calling a function while the shell renders
 * (`react-hooks/static-components`). The map is only ever indexed by a `RailId` from here.
 */
const BUILT: Partial<Record<LaunchPanelId, ComponentType<LaunchPanelProps>>> = {
  mockups: MockupsPanel,
  photos: PhotosPanel,
  ...LAUNCH_PANEL_COMPONENTS,
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

function RailPanel({ id, hidden, panel }: Readonly<{ id: RailId; hidden: boolean; panel: LaunchPanelProps }>): ReactNode {
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
