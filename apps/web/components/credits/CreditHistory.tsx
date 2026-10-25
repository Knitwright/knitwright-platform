import { describeEntry, type HistoryRow } from "@/lib/credits/ledger";

/** The ledger as a table, newest first. Dates are UTC so the page reads the same for everyone. */
export function CreditHistory({ rows, brandName }: Readonly<{ rows: readonly HistoryRow[]; brandName: string }>) {
  if (rows.length === 0) return <p className="text-[15px] text-muted">{brandName} has no credit history yet.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface" role="region" aria-label={`Credit history of ${brandName}`} tabIndex={0}>
      <table className="w-full min-w-[32rem] text-left text-[15px]">
        <caption className="sr-only">Credit history of {brandName}, newest first</caption>
        <thead>
          <tr className="border-b border-hairline text-sm text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Date (UTC)</th>
            <th scope="col" className="px-4 py-3 font-medium">What happened</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Credits</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 whitespace-nowrap">{row.createdAt.slice(0, 10)}</td>
              <td className="px-4 py-3">{describeEntry(row)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.balanceAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
