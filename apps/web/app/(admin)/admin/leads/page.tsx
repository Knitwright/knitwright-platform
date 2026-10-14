import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LeadOwnerForm } from "@/components/leads/LeadOwnerForm";
import { pageFrame } from "@/components/shell/page-width";
import { QuoteStatusForm } from "@/components/leads/QuoteStatusForm";
import { Pagination } from "@/components/ui/Pagination";
import { loadAccessRequests, type AccessRequestRow } from "@/lib/leads/access";
import { pageCount, pageHref, pageOf, pageRequest } from "@/lib/pagination/pages";
import { buildLeadList, type LeadListItem } from "@/lib/leads/admin";
import { buyerKindLabel } from "@/lib/leads/buyer-kind";
import { organisationTypeLabel, placeOf } from "@/lib/leads/organisation";
import { describeQuote } from "@/lib/leads/quote";
import { leadOwnerLabel } from "@/lib/leads/routing";
import { HOT_SCORE } from "@/lib/leads/score";
import { loadLeadRows } from "@/lib/leads/service";
import { formatDate, formatDateTime } from "@/lib/projects/dates";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Leads", robots: { index: false, follow: false } };

/** How many brands one page of the lead list shows. */
const LEADS_PER_PAGE = 20;

/**
 * The lead list for the Knitwright team (decision 0024, Platform and Store Guide pages 9 and 12):
 * one row per brand, highest score first. Everyone who is not a platform admin gets the page
 * that does not exist.
 */
export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await requirePlatformAdmin();
  const client = await sessionClient();
  const [rows, requests] = await Promise.all([loadLeadRows(client), loadAccessRequests(client)]);
  const leads = buildLeadList(rows, new Date());
  const request = pageRequest(await searchParams, LEADS_PER_PAGE);
  const totalPages = pageCount(leads.length, LEADS_PER_PAGE);
  if (request.page > totalPages) redirect(pageHref("/admin/leads", totalPages) as Route);
  const shown = pageOf(leads, request);

  return (
    <main id="main" className={`rise ${pageFrame("content")} flex-1 py-10`}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Knitwright team</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Leads</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Every brand, highest score first. {HOT_SCORE}+: contact within 24 hours. Australian clubs at {HOT_SCORE}+ go to the
        partner unless someone already owns them.
      </p>
      {leads.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted">No brands yet.</p>
      ) : (
        <ol start={request.offset + 1} className="mt-8 flex flex-col gap-6">
          {shown.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </ol>
      )}
      <Pagination path="/admin/leads" page={request.page} totalPages={totalPages} label="Pages of leads" />
      <AccessRequests requests={requests} />
    </main>
  );
}

/** People with no account who asked for access while sign-up is by invitation. Newest first. */
function AccessRequests({ requests }: Readonly<{ requests: readonly AccessRequestRow[] }>) {
  return (
    <section aria-labelledby="access-requests" className="mt-12">
      <h2 id="access-requests" className="text-xl font-semibold text-ink">
        Requests for access
      </h2>
      <p className="mt-2 text-[15px] text-muted">
        From the sign-up page. To let someone in, add their address to the allow list (docs/launch/sign-up-switch.md), then tell them to sign up.
      </p>
      {requests.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">No requests yet.</p>
      ) : (
        <ul className="glass mt-4 flex flex-col divide-y divide-hairline rounded-[1.75rem]">
          {requests.map((request) => (
            <li key={request.id} className="px-6 py-4 text-sm text-ink-2" data-testid="access-request">
              <p className="text-[15px] font-medium text-ink">
                {request.name}, {request.email}
              </p>
              <p className="text-muted">
                {request.organisation || "No organisation given"} · {organisationTypeLabel(request.organisationType)} · Asked{" "}
                {formatDateTime(request.createdAt)}
              </p>
              {request.message ? <p className="mt-1">Message: {request.message}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadCard({ lead }: Readonly<{ lead: LeadListItem }>) {
  return (
    <li
      className={`glass rounded-[1.75rem] p-6 ${lead.hot ? "[--glass-edge:var(--warn)]" : ""}`}
      data-testid="lead"
      aria-labelledby={`lead-${lead.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id={`lead-${lead.id}`} className="text-lg font-semibold text-ink">
            {lead.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {organisationTypeLabel(lead.organisationType)} · {placeOf(lead.country, lead.region)} · {buyerKindLabel(lead.segment)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-ink">{lead.score.total}</p>
          {lead.hot ? <p className="text-sm font-semibold text-warn">Contact within 24 hours</p> : null}
        </div>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Detail term="Contact">{lead.emails.join(", ") || "No members"}</Detail>
        <Detail term="Designs">{lead.designs}</Detail>
        <Detail term="Last activity">{formatDateTime(lead.lastActivity)}</Detail>
        <Detail term="Owner">
          {leadOwnerLabel(lead.lead?.owner ?? null)}
          {!lead.lead?.owner && lead.suggestedOwner ? ` (suggested: ${leadOwnerLabel(lead.suggestedOwner)})` : ""}
        </Detail>
        <Detail term="Next step">
          {lead.lead?.nextStep ? `${lead.lead.nextStep}${lead.lead.nextStepOn ? `, by ${formatDate(lead.lead.nextStepOn)}` : ""}` : "None"}
        </Detail>
        <Detail term="Score">{lead.score.reasons.join(", ") || "Nothing yet"}</Detail>
      </dl>
      {lead.quotes.length > 0 ? (
        <section aria-label={`Quote requests from ${lead.name}`} className="mt-5">
          <h3 className="text-sm font-semibold text-ink">Quote requests</h3>
          <ul className="mt-2 flex flex-col divide-y divide-hairline">
            {lead.quotes.map((quote) => (
              <li key={quote.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
                <div className="text-sm text-ink-2">
                  <p>
                    {quote.projectName}, version {quote.version}: {describeQuote(quote)}
                  </p>
                  {quote.sizesNote ? <p className="text-muted">Sizes: {quote.sizesNote}</p> : null}
                  {quote.message ? <p className="text-muted">Message: {quote.message}</p> : null}
                  <p className="text-faint">Asked {formatDateTime(quote.createdAt)}</p>
                </div>
                <QuoteStatusForm quoteId={quote.id} status={quote.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-5 border-t border-hairline pt-5">
        <LeadOwnerForm
          brandId={lead.id}
          owner={lead.lead?.owner ?? null}
          nextStep={lead.lead?.nextStep ?? ""}
          nextStepOn={lead.lead?.nextStepOn ?? null}
        />
      </div>
    </li>
  );
}

function Detail({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{term}:</dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}
