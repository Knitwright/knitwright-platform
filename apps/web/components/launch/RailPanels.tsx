import type { ComponentType, ReactNode } from "react";
import { MARKETING_PANEL_COMPONENTS } from "@/components/marketing/panels";
import MockupsPanel from "@/components/mockups/MockupsPanel";
import PhotosPanel from "@/components/mockups/PhotosPanel";
import { panelPlaceholder, RAIL, RAIL_ITEMS, railPanelId, railTabId, type LaunchPanelId, type LaunchPanelProps, type RailId } from "@/lib/launch";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * The panels of the icon rail. All twelve are drawn and only the open one shows, so every tab's
 * `aria-controls` names a panel that really exists and a hidden panel keeps whatever was typed in
 * it -- the same arrangement the editor shell uses for its three toolbars.
 *
 * A panel another workstream has built is mounted here and given exactly `LaunchPanelProps`
 * (`lib/launch/panels.ts`); the rest still draw a labelled placeholder. **Mockups and Photos are
 * L2's** (decision 0092). **Text, Elements, Pattern fills, AI assistant and Layers are L4's**, and
 * come through that workstream's own registry rather than being listed again here (decision 0094,
 * item 16). What those five need from outside the canvas -- the brand's voice, the pictures the
 * platform drew, the export rows and "Write for me" -- reaches them through
 * `MarketingServicesProvider`, which `LaunchShell` wraps the whole shell in.
 *
 * Templates, AI image, Likes, Uploads and Brand still hold their placeholders: L8, L3 and L7 own
 * them and have not landed.
 */

/**
 * Every panel that is built, by its id: L2's two and L4's own registry, spread in rather than
 * listed again. One map, made once, so nothing is looked up by calling a function while the shell
 * renders (`react-hooks/static-components`). The map's board panels are never reached from here,
 * because this file only ever indexes it by a `RailId`.
 */
const BUILT: Partial<Record<LaunchPanelId, ComponentType<LaunchPanelProps>>> = {
  mockups: MockupsPanel,
  photos: PhotosPanel,
  ...MARKETING_PANEL_COMPONENTS,
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
