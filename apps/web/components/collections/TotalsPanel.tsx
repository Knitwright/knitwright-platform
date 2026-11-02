import { countersText, totalsPanel } from "@/lib/collections/board";
import type { CollectionPlan } from "@/lib/collections/types";
import { COLOURS_NOT_READ, pieces } from "@/lib/collections/vocabulary";

/**
 * The board's right-hand panel (spec F-S10): the totals for the range, then for each group, then for
 * each colourway, and last the colours.
 *
 * The spec asks for a colour breakdown. A plan holds the colourway names typed on the cards, not a
 * colour list, so the panel shows those names and says where a real colour breakdown would come from
 * (rule R-GAP-000). Showing a colour count the plan does not hold would be an invented figure.
 */
export function TotalsPanel({ plan }: Readonly<{ plan: CollectionPlan }>) {
  const panel = totalsPanel(plan);
  return (
    <aside aria-label="Totals for this range" className="flex flex-col gap-5 rounded-3xl border border-hairline bg-surface p-5">
      <section className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-ink">Range</h3>
        <p className="text-[15px] text-ink-2">{countersText(panel.range)}</p>
        <p className="text-[13px] text-muted">{pieces(panel.range.units)} planned</p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-ink">Groups</h3>
        {panel.groups.length === 0 ? (
          <p className="text-[13px] text-muted">No groups yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {panel.groups.map((group) => (
              <li key={group.frameId ?? "loose"}>
                <span className="text-ink-2">{group.name}</span> · {countersText(group)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-ink">Colourways</h3>
        {panel.colourways.length === 0 ? (
          <p className="text-[13px] text-muted">No colourways yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {panel.colourways.map((tally) => (
              <li key={tally.label}>
                <span className="text-ink-2">{tally.label}</span> · {tally.skus} {tally.skus === 1 ? "SKU" : "SKUs"} · {pieces(tally.units)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-ink">Colours</h3>
        <p className="text-[13px] text-muted">{COLOURS_NOT_READ}</p>
      </section>
    </aside>
  );
}
