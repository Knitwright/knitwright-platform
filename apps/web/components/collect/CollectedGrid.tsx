import { NO_WAY_TO_REACH } from "@/lib/clubs/signup/chase";
import type { Grid, GridRow } from "@/lib/clubs/signup/grid";

type CollectedGridProps = Readonly<{ grid: Grid; children?: (row: GridRow) => React.ReactNode }>;

/**
 * Who is in and who the club is still waiting on (spec F-T4 step 4). The missing are obvious at a
 * glance three ways over, not by colour alone: the word "Still waiting", a warm edge down the left
 * of the row, and the rows sorted so the missing come first. A flag beside a row says why it needs
 * a second look, with the rule that makes the check.
 */
export function CollectedGrid({ grid, children }: CollectedGridProps) {
  const sorted = [...grid.rows].sort((left, right) => {
    const rank = { missing: 0, extra: 1, collected: 2 } as const;
    return rank[left.state] - rank[right.state] || left.name.localeCompare(right.name);
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ink-2" data-testid="collect-summary">
        {grid.summary}
      </p>
      {sorted.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {sorted.map((row) => (
            <li
              key={`${row.state}-${row.key}`}
              data-testid="collect-row"
              data-state={row.state}
              className={`flex flex-col gap-1 rounded-xl border border-hairline border-l-4 p-3 ${
                row.state === "missing" ? "border-l-warn" : row.state === "extra" ? "border-l-cobalt-soft" : "border-l-ok"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-medium text-ink">{row.name}</span>
                <span className={`text-sm ${row.state === "missing" ? "text-warn" : "text-muted"}`}>{row.stateLabel}</span>
              </div>
              {row.entry ? (
                <p className="text-sm text-muted">
                  Number {row.entry.number} · size {row.entry.sizeLabel} · {row.entry.wearerGroup}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {row.phone === "" && row.email === "" ? NO_WAY_TO_REACH : [row.phone, row.email].filter((one) => one !== "").join(" · ")}
                </p>
              )}
              {row.flags.map((flag) => (
                <p key={flag.kind} className="text-sm text-warn" data-testid="collect-flag">
                  {flag.message} <span className="font-mono text-xs text-muted">{flag.ruleId}</span>
                </p>
              ))}
              {children ? children(row) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
