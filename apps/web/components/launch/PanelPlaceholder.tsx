import { panelPlaceholder, type LaunchPanelId } from "@/lib/launch";

/**
 * What the shell draws where a panel another workstream owns will go (the panel contract,
 * `lib/launch/panels.ts`). It says plainly which panel belongs here and who is building it, and
 * never stands in for the panel itself. The placeholders live in this workstream's own file, so
 * nothing is written into a directory another workstream owns.
 */
export function PanelPlaceholder({ id }: Readonly<{ id: LaunchPanelId }>) {
  const panel = panelPlaceholder(id);
  return (
    // A plain box, not a landmark: the rail's panel and the inspector are already named regions,
    // and a second landmark of the same name would be two places called one thing.
    <div
      data-testid={panel.testId}
      className="flex min-h-24 flex-col justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-tile-2/90 p-4"
    >
      <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">{panel.title}</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">{panel.note}</p>
      <p className="text-[13px] font-medium text-ink">Not built yet.</p>
    </div>
  );
}
