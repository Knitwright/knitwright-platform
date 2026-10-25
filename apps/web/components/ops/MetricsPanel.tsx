import type { Metrics } from "@/lib/ops/metrics/compute";
import { formatValue } from "@/lib/ops/format";
import { formatDateTime } from "@/lib/projects/dates";

const percent = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

function Tile({ label, children, note }: Readonly<{ label: string; children: React.ReactNode; note?: string }>) {
  return (
    <div className="rounded-xl border border-hairline p-4" data-testid="metric">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{children}</dd>
      {note ? <p className="mt-1 text-sm text-faint">{note}</p> : null}
    </div>
  );
}

/** The console home numbers, all worked out from the tables. Where there is nothing to measure, it says so instead of showing zero as a rate. */
export function MetricsPanel({ metrics, truncated }: Readonly<{ metrics: Metrics; truncated: boolean }>) {
  const { onTime } = metrics;
  return (
    <section aria-labelledby="metrics" className="mt-6">
      <h2 id="metrics" className="sr-only">Numbers</h2>
      {truncated ? <p className="mb-2 text-sm text-warn">There are more rows than the console reads at once, so these numbers cover the newest only.</p> : null}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Orders this week" note={`Since Monday ${metrics.weekStart.slice(0, 10)} UTC`}>{metrics.ordersThisWeek}</Tile>
        <Tile label="Pieces in production" note="Received by the factory or in production">{metrics.piecesInProduction}</Tile>
        <Tile label="On time against the promise" note={onTime.rate === null ? "Nothing shipped with a promised date yet." : `${onTime.onTime} on time, ${onTime.late} late${onTime.withoutPromise > 0 ? `, ${onTime.withoutPromise} shipped with no promised date` : ""}`}>
          {onTime.rate === null ? "Not enough data" : percent(onTime.rate)}
        </Tile>
        <Tile label="Remakes open" note={metrics.remakesOverdue > 0 ? `${metrics.remakesOverdue} overdue` : undefined}>{metrics.remakesOpen}</Tile>
        <Tile label="Value in open batches" note={metrics.batchValue.unpriced > 0 ? `${metrics.batchValue.unpriced} orders gave no value. Values are as the Store gave them.` : "As the Store gave it."}>
          {metrics.batchValue.byCurrency.length === 0 ? "Not given" : metrics.batchValue.byCurrency.map((v) => formatValue(v)).join(" + ")}
        </Tile>
        <Tile label="Next cut-off">{formatDateTime(metrics.nextCutoff)}</Tile>
        <div className="rounded-xl border border-hairline p-4 sm:col-span-2" data-testid="metric">
          <dt className="text-sm text-muted">Defect rate by factory</dt>
          <dd className="mt-1 text-sm text-ink-2">
            {metrics.defectsByFactory.length === 0 ? (
              "No inspection recorded yet."
            ) : (
              <ul>
                {metrics.defectsByFactory.map((f) => (
                  <li key={f.factoryProfileId}>{f.factoryProfileId}: {percent(f.rate)} ({f.defective} of {f.sampled} pieces inspected, {f.inspections} {f.inspections === 1 ? "inspection" : "inspections"})</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
