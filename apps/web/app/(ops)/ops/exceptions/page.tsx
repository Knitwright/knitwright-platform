import type { Metadata, Route } from "next";
import Link from "next/link";
import { ExceptionControls } from "@/components/ops/ExceptionForms";
import { listExceptions } from "@/lib/ops/exceptions/service";
import { EXCEPTION_LABELS, isOverdue, sortForWork } from "@/lib/ops/exceptions/rules";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: exceptions", robots: { index: false, follow: false } };

/** Remakes, partial shipments, lost parcels and size swaps. Each has an owner and a due date. To raise one, open its order. */
export default async function ExceptionsPage() {
  await requirePlatformAdmin();
  const now = new Date();
  const list = sortForWork(await listExceptions(await sessionClient()));
  const open = list.filter((e) => e.status === "open");

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Exceptions</h1>
      <p className="mt-2 text-[15px] text-muted">{open.length} open, {open.filter((e) => isOverdue(e, now)).length} overdue. Raise one from the order it is about.</p>
      {list.length === 0 ? <p className="mt-4 text-[15px] text-muted">No exceptions.</p> : (
        <ul className="mt-4 flex flex-col divide-y divide-hairline">
          {list.map((e) => (
            <li key={e.id} className="py-3 text-sm" data-testid="exception">
              <p>
                <span className="font-medium text-ink">{EXCEPTION_LABELS[e.kind]}</span> · <Link href={`/ops/orders/${e.orderId}` as Route} className="underline">order</Link> · owner {e.owner} · due {e.dueOn}
                {isOverdue(e, now) ? <span className="text-warn"> · overdue</span> : null}
                {e.status === "resolved" ? ` · resolved ${e.resolvedOn ?? ""}: ${e.resolution ?? ""}` : ""}
              </p>
              {e.kind === "remake" || e.kind === "size_swap" ? <p className="text-muted">{Object.entries(e.detail).map(([k, v]) => `${k} ${String(v)}`).join(", ")}</p> : null}
              {e.note ? <p className="text-muted">{e.note}</p> : null}
              {e.status === "open" ? <ExceptionControls exceptionId={e.id} orderId={e.orderId} owner={e.owner} dueOn={e.dueOn} /> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
