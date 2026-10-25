import type { Metadata, Route } from "next";
import Link from "next/link";
import { listQueue } from "@/lib/pattern-service/service";
import { STATUS_WORDS, isOpen } from "@/lib/pattern-service/transitions";
import { quoteWords } from "@/lib/pattern-service/quote";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: pattern requests", robots: { index: false, follow: false } };

/** Designs brands have sent to the Sialkot team for a pattern. Open ones first, oldest first. */
export default async function PatternRequestsPage() {
  await requirePlatformAdmin();
  const list = await listQueue(await sessionClient());
  const open = list.filter((r) => isOpen(r.status));

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Pattern requests</h1>
      <p className="mt-2 text-[15px] text-muted">{open.length} open. Accept a request, mark it in progress, attach the DXF files, then deliver it.</p>
      {list.length === 0 ? <p className="mt-4 text-[15px] text-muted">No requests.</p> : (
        <ul className="mt-4 flex flex-col divide-y divide-hairline">
          {list.map((r) => (
            <li key={r.id} className="py-3 text-sm" data-testid="queue-request">
              <p>
                <Link href={`/ops/pattern-requests/${r.id}` as Route} className="font-medium text-ink underline">{r.articleId}, version {r.designVersion}</Link>
                {" "}· {STATUS_WORDS[r.status]} · requested {r.createdAt.slice(0, 10)}
              </p>
              <p className="text-muted">Quoted: {quoteWords({ priceCredits: r.quotedPriceCredits, turnaroundWorkingDays: r.quotedTurnaroundDays }).turnaround}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
