import type { Metadata } from "next";
import { PayoutStateForm, ReviewForm } from "@/components/designers/DesignerForms";
import { pageFrame } from "@/components/shell/page-width";
import { Notice } from "@/components/ui/Notice";
import { NO_PAYMENTS, PAYOUT_LABELS, RATE_NOT_SET, RIGHTS_STATEMENT, STATUS_LABELS } from "@/lib/designers/copy";
import { formatMoney } from "@/lib/designers/royalty";
import { loadDecided, loadDesignerRows, loadRate, loadReviewQueue } from "@/lib/designers/service";
import { getType } from "@/lib/garment";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { previewOf } from "@/lib/templates/preview";

export const metadata: Metadata = { title: "Designer templates", robots: { index: false, follow: false } };

/** Review of designer submissions, and the royalty ledger per designer. Platform admins only; anyone else gets the page that does not exist. */
export default async function AdminTemplatesPage() {
  await requirePlatformAdmin();
  const client = await sessionClient();
  const [queue, decided, designers, rate] = await Promise.all([loadReviewQueue(client), loadDecided(client), loadDesignerRows(client), loadRate(adminClient())]);
  return (
    <main id="main" className={`rise ${pageFrame("content")} flex-1 py-10`}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Knitwright team</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Designer templates</h1>
      <section aria-labelledby="queue" className="mt-8">
        <h2 id="queue" className="text-xl font-semibold text-ink">Waiting for review</h2>
        {queue.length === 0 ? <p className="mt-3 text-[15px] text-ink-2">Nothing is waiting.</p> : (
          <ul className="mt-4 flex flex-col gap-6">
            {queue.map(({ submission: s, designerName, snapshot }) => {
              const preview = previewOf(snapshot);
              return (
                <li key={s.id} className="glass rounded-[1.75rem] p-6" data-testid="queue-entry">
                  {/* A data address of a drawing made here: nothing in it can run. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview ? <img src={preview.src} alt={preview.alt} className="mb-3 h-40 object-contain" /> : null}
                  <h3 className="text-lg font-medium text-ink">{s.title}</h3>
                  <p className="font-mono text-[13px] text-muted">By {designerName} · {getType(s.articleId)?.label ?? s.articleId}</p>
                  <p className="mt-2 text-sm text-ink-2">{s.rightsAttested ? `Rights statement made: ${RIGHTS_STATEMENT}` : "No rights statement. Reject this one."}</p>
                  <div className="mt-4"><ReviewForm submissionId={s.id} title={s.title} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="decided" className="mt-12">
        <h2 id="decided" className="text-xl font-semibold text-ink">Already decided</h2>
        {decided.length === 0 ? <p className="mt-3 text-[15px] text-ink-2">Nothing has been decided yet.</p> : (
          <ul className="mt-4 flex flex-col gap-3">
            {decided.map(({ submission: s, designerName }) => (
              <li key={s.id} className="glass rounded-[1.75rem] p-5" data-testid="decided-entry">
                <h3 className="text-base font-medium text-ink">{s.title}</h3>
                <p className="text-sm text-ink-2">By {designerName} · {STATUS_LABELS[s.status]}{s.status === "rejected" && s.rejectionReason ? `: ${s.rejectionReason}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="ledger" className="mt-12">
        <h2 id="ledger" className="text-xl font-semibold text-ink">Royalty ledger</h2>
        <div className="mt-3 flex flex-col gap-3">
          {rate === null ? <Notice tone="warn">{RATE_NOT_SET} Set the rate in Settings, under Designer royalties.</Notice> : <Notice>Rate in force: {rate} per unit, in the smallest unit of the order&apos;s currency.</Notice>}
          <p className="text-sm text-muted">{NO_PAYMENTS}</p>
        </div>
        {designers.length === 0 ? <p className="mt-3 text-[15px] text-ink-2">No designers yet.</p> : (
          <ul className="mt-4 flex flex-col gap-6">
            {designers.map((d) => (
              <li key={d.designerId} className="glass rounded-[1.75rem] p-6" data-testid="designer-row">
                <h3 className="text-lg font-medium text-ink">{d.name}</h3>
                <p className="mt-1 text-sm text-ink-2">
                  {d.ledger.units} units ordered · accrued {d.ledger.accrued.length === 0 ? "nothing" : d.ledger.accrued.map((a) => formatMoney(a.minor, a.currency)).join(", ")}
                  {d.ledger.linesWithoutRate > 0 ? ` · ${d.ledger.linesWithoutRate} order(s) arrived with no rate set` : ""} · {PAYOUT_LABELS[d.payoutState]}
                </p>
                <div className="mt-3"><PayoutStateForm designerId={d.designerId} name={d.name} current={d.payoutState} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
