import type { Metadata } from "next";
import { EnrolForm, SendSubmissionForm } from "@/components/designers/DesignerForms";
import { PageIntro } from "@/components/shell/PageIntro";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import { NO_PAYMENTS, PAYOUT_LABELS, PRIVACY_NOTE, RATE_NOT_SET, STATUS_LABELS } from "@/lib/designers/copy";
import { formatMoney } from "@/lib/designers/royalty";
import { loadDesignerHome, loadProfile, loadRate } from "@/lib/designers/service";
import { getType } from "@/lib/garment";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Designer" };

/** The designer's page: opt in, then submissions with their status, templates live, units ordered and royalty accrued. */
export default async function DesignerPage() {
  const { userId, brand } = await requireMember();
  const client = await sessionClient();
  const profile = await loadProfile(client, userId);
  if (!profile) {
    return (
      <div className="flex flex-col gap-5">
        <PageIntro eyebrow={brand.name} title="Designer" lead="Offer a design as a template for clubs and brands. You earn a royalty per unit ordered once Knitwright has set one." />
        <p className="text-[15px] text-ink-2">{PRIVACY_NOTE}</p>
        <EnrolForm />
      </div>
    );
  }
  const [home, rate] = await Promise.all([loadDesignerHome(client, userId), loadRate(adminClient())]);
  const { ledger } = home;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageIntro eyebrow={profile.displayName} title="Designer" lead="Your templates and what they have earned." />
        <LinkButton href="/designer/new">Offer a design</LinkButton>
      </div>
      {rate === null ? <Notice tone="warn">{RATE_NOT_SET}</Notice> : null}
      <dl className="grid gap-4 sm:grid-cols-4" aria-label="Your totals">
        <Stat label="Templates live" value={String(home.liveTemplates)} />
        <Stat label="Units ordered" value={String(ledger.units)} />
        <Stat label="Royalty accrued" value={ledger.accrued.length === 0 ? "Nothing yet" : ledger.accrued.map((a) => formatMoney(a.minor, a.currency)).join(", ")} />
        <Stat label="Payout state" value={PAYOUT_LABELS[home.payoutState]} />
      </dl>
      <p className="text-sm text-muted">{NO_PAYMENTS} {PRIVACY_NOTE}</p>
      <section aria-labelledby="submissions">
        <h2 id="submissions" className="text-xl font-semibold text-ink">Your submissions</h2>
        {home.submissions.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-2">Nothing offered yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {home.submissions.map((s) => (
              <li key={s.id} className="glass rounded-[1.75rem] p-5" data-testid="submission">
                <h3 className="text-lg font-medium text-ink">{s.title}</h3>
                <p className="font-mono text-[13px] text-muted">{getType(s.articleId)?.label ?? s.articleId}</p>
                <p className="mt-2 text-sm text-ink-2">{STATUS_LABELS[s.status]}</p>
                {s.rejectionReason ? <p className="mt-1 text-sm text-warn">Reason: {s.rejectionReason}</p> : null}
                {s.status === "draft" ? <div className="mt-3"><SendSubmissionForm submissionId={s.id} title={s.title} /></div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="glass rounded-[1.75rem] p-5">
      <dt className="font-mono text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-2 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}
