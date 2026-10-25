import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PatternRequestControls } from "@/components/ops/PatternRequestControls";
import { quoteWords } from "@/lib/pattern-service/quote";
import { getRequest, listEvents } from "@/lib/pattern-service/service";
import { STATUS_WORDS } from "@/lib/pattern-service/transitions";
import { deliveredLabel } from "@/lib/pattern-service/wording";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: pattern request", robots: { index: false, follow: false } };

/** One request: what was quoted, what is attached, the history, and what ops can do next. */
export default async function PatternRequestPage({ params }: PageProps<"/ops/pattern-requests/[requestId]">) {
  await requirePlatformAdmin();
  const parsed = z.uuid().safeParse((await params).requestId);
  if (!parsed.success) notFound();
  const client = await sessionClient();
  const request = await getRequest(client, parsed.data!);
  if (!request) notFound();
  const events = await listEvents(client, request.id);
  const words = quoteWords({ priceCredits: request.quotedPriceCredits, turnaroundWorkingDays: request.quotedTurnaroundDays });

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{request.articleId}, version {request.designVersion}</h1>
      <p className="mt-2 text-[15px] text-muted" data-testid="request-status">{STATUS_WORDS[request.status]}</p>
      <dl className="mt-4 grid max-w-xl gap-1 text-sm">
        <div className="flex gap-2"><dt className="text-muted">Quoted price</dt><dd>{words.price}</dd></div>
        <div className="flex gap-2"><dt className="text-muted">Quoted turnaround</dt><dd>{words.turnaround}</dd></div>
        <div className="flex gap-2"><dt className="text-muted">Design hash</dt><dd className="font-mono text-xs">{request.snapshotHash}</dd></div>
        {request.declineReason ? <div className="flex gap-2"><dt className="text-muted">Declined because</dt><dd>{request.declineReason}</dd></div> : null}
      </dl>
      {request.fileIds.length > 0 ? (
        <section className="mt-4"><h2 className="text-lg font-medium text-ink">Files</h2>
          <p className="text-sm text-muted">{request.fileIds.length} attached. {deliveredLabel(request)}.</p>
        </section>
      ) : null}
      <PatternRequestControls requestId={request.id} status={request.status} reviewed={request.reviewedBy !== null} fileCount={request.fileIds.length} />
      <section className="mt-6"><h2 className="text-lg font-medium text-ink">History</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {events.map((e) => <li key={e.id}>{e.at.slice(0, 16).replace("T", " ")} · {e.kind.replaceAll("_", " ")}{e.note ? `: ${e.note}` : ""}</li>)}
        </ul>
      </section>
    </main>
  );
}
