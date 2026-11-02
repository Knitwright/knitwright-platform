import { panelPlaceholder, RAIL, RAIL_ITEMS, railPanelId, railTabId, type RailId } from "@/lib/launch";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * The panels of the icon rail. All twelve are drawn and only the open one shows, so every tab's
 * `aria-controls` names a panel that really exists and a hidden panel keeps whatever was typed in
 * it -- the same arrangement the editor shell uses for its three toolbars.
 */
export function RailPanels({ open }: Readonly<{ open: RailId }>) {
  return (
    <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]">
      {RAIL_ITEMS.map((id) => (
        <RailPanel key={id} id={id} hidden={id !== open} />
      ))}
    </div>
  );
}

function RailPanel({ id, hidden }: Readonly<{ id: RailId; hidden: boolean }>) {
  const panel = panelPlaceholder(id);
  return (
    <div
      id={railPanelId(id)}
      role="tabpanel"
      aria-labelledby={railTabId(id)}
      hidden={hidden}
      className="glass flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl p-4 lg:row-start-1"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{RAIL[id].label}</h2>
        <p className="text-[13px] leading-relaxed text-chalk-muted">{panel.note}</p>
      </header>
      <PanelPlaceholder id={id} />
    </div>
  );
}
