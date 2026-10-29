import type { SheetModel } from "@/lib/ops/factory-sheet/model";
import type { historyLines } from "@/lib/job-packet/load";
import { EVENT_LABELS } from "@/lib/job-packet/steps";
import { formatDateTime } from "@/lib/projects/dates";

/** The lists of a factory's job packet, from the same model as the factory sheet PDF. */

const TH = "py-1 pr-3 font-medium";
const TD = "py-1.5 pr-3";

function Heading({ id, children }: Readonly<{ id: string; children: string }>) {
  return <h2 id={id} className="text-lg font-semibold text-ink">{children}</h2>;
}

export function OrderList({ sheet }: Readonly<{ sheet: SheetModel }>) {
  return (
    <section aria-labelledby="job-orders" className="flex flex-col gap-2">
      <Heading id="job-orders">Orders</Heading>
      <table className="w-full text-left text-sm">
        <thead className="text-muted"><tr><th className={TH}>Order</th><th className={TH}>Customer</th><th className={TH}>Release</th><th className={TH}>Pieces</th><th className={TH}>Due</th></tr></thead>
        <tbody>
          {sheet.orders.map((o) => (
            <tr key={o.ref} className="border-t border-hairline" data-testid="job-order">
              <td className={TD}>{o.ref}</td><td className={TD}>{o.brand}</td><td className={TD}>{o.release}</td><td className={TD}>{o.pieces}</td><td className={TD}>{o.promised}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SizeBreakdown({ sheet }: Readonly<{ sheet: SheetModel }>) {
  return (
    <section aria-labelledby="job-sizes" className="flex flex-col gap-2">
      <Heading id="job-sizes">Sizes</Heading>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th className={TH}>Order</th>{sheet.sizes.map((s) => <th key={s} className={TH}>{s}</th>)}<th className={TH}>Total</th></tr></thead>
          <tbody>
            {sheet.breakdown.map((row) => (
              <tr key={row.ref} className="border-t border-hairline">
                <td className={TD}>{row.ref}</td>{row.counts.map((n, i) => <td key={sheet.sizes[i]} className={TD}>{n}</td>)}<td className={TD}>{row.total}</td>
              </tr>
            ))}
            <tr className="border-t border-hairline font-medium">
              <td className={TD}>All orders</td>{sheet.totals.counts.map((n, i) => <td key={sheet.sizes[i]} className={TD}>{n}</td>)}<td className={TD}>{sheet.totals.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function NamesList({ sheet }: Readonly<{ sheet: SheetModel }>) {
  return (
    <section aria-labelledby="job-names" className="flex flex-col gap-3">
      <Heading id="job-names">Names and numbers</Heading>
      {sheet.names.map((group) => (
        <div key={group.ref} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-ink">{group.ref}</h3>
          {group.notice ? <p className="text-sm text-muted">{group.notice}</p> : null}
          {group.rows.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className={TH}>Number</th><th className={TH}>Name</th><th className={TH}>Size</th><th className={TH}>Pieces</th></tr></thead>
              <tbody>
                {group.rows.map((r, i) => (
                  <tr key={`${r.number}-${r.name}-${i}`} className="border-t border-hairline"><td className={TD}>{r.number}</td><td className={TD}>{r.name}</td><td className={TD}>{r.sizeLabel}</td><td className={TD}>{r.quantity}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function MaterialsList({ sheet }: Readonly<{ sheet: SheetModel }>) {
  return (
    <section aria-labelledby="job-bom" className="flex flex-col gap-2">
      <Heading id="job-bom">Materials (BOM)</Heading>
      <ul className="flex flex-col gap-1 text-sm">
        {sheet.bom.map((b) => (
          <li key={b.item}><span className="font-medium text-ink">{b.item}</span>: {b.quantity}. <span className="text-muted">{b.source}</span></li>
        ))}
      </ul>
      <h3 className="mt-2 text-sm font-semibold text-ink">Packing</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{sheet.packing.map((line) => <li key={line}>{line}</li>)}</ul>
      <p className="text-sm text-faint">{sheet.packingLabel}</p>
    </section>
  );
}

export function History({ lines }: Readonly<{ lines: ReturnType<typeof historyLines> }>) {
  return (
    <section aria-labelledby="job-history" className="flex flex-col gap-2">
      <Heading id="job-history">What you recorded</Heading>
      {lines.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
        <ul className="flex flex-col gap-1 text-sm">
          {lines.map((l) => (
            <li key={l.id} data-testid="job-history" className="border-t border-hairline py-1.5">
              <span className="font-medium text-ink">{EVENT_LABELS[l.kind]}</span> <span className="text-muted">{formatDateTime(l.at)}</span>
              {l.note ? <span className="text-ink-2"> · {l.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
