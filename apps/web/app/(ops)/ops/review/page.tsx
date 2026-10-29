import type { Metadata } from "next";
import { formatDateTime } from "@/lib/projects/dates";
import { listMarks, listNotices, listQueue, strikesByBrand, type MarkRow, type Notice, type QueueItem, type Strikes } from "@/lib/moderation/review";
import { DEFAULT_SETTINGS, SETTINGS_LABEL } from "@/lib/moderation/settings";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { MarkForm, MarkPictureForm, MarkToggle, NoticeForm, ReviewForm } from "./ReviewControls";

export const metadata: Metadata = { title: "Ops: review", robots: { index: false, follow: false } };

const WHAT: Readonly<Record<string, string>> = { asset: "Upload", text: "Text", version: "Design version", generation: "AI generation" };

const Nothing = ({ children }: Readonly<{ children: string }>) => <p className="mt-2 text-[15px] text-muted">{children}</p>;

function Queue({ items }: Readonly<{ items: readonly QueueItem[] }>) {
  return (
    <section aria-labelledby="queue" className="mt-8">
      <h2 id="queue" className="text-lg font-semibold text-ink">Waiting for review ({items.length})</h2>
      {items.length === 0 ? <Nothing>Nothing is waiting.</Nothing> : (
        <ul className="mt-2 flex flex-col divide-y divide-hairline">
          {items.map((item) => (
            <li key={item.id} className="py-3 text-sm" data-testid="review-item">
              <p className="font-medium text-ink">{WHAT[item.targetKind] ?? item.targetKind}: {item.label || "(no label)"} · {item.result}</p>
              <p className="text-muted">Brand {item.brandId}{item.targetId ? `, item ${item.targetId}` : ", nothing stored"} · {formatDateTime(item.createdAt)}</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {item.reasons.filter((r) => r.severity !== "note").map((r, i) => <li key={i}>{r.message} <span className="font-mono text-xs">{r.ruleId}</span></li>)}
              </ul>
              <ReviewForm checkId={item.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Notices({ notices }: Readonly<{ notices: readonly Notice[] }>) {
  const open = notices.filter((n) => n.status === "received");
  return (
    <section aria-labelledby="notices" className="mt-8">
      <h2 id="notices" className="text-lg font-semibold text-ink">Takedown notices ({open.length} open)</h2>
      {notices.length === 0 ? <Nothing>No notices.</Nothing> : (
        <ul className="mt-2 flex flex-col divide-y divide-hairline">
          {notices.map((n) => (
            <li key={n.id} className="py-3 text-sm" data-testid="takedown-notice">
              <p className="font-medium text-ink">{n.mark} ({n.holder}) · {n.status}{n.strikeNumber ? `, strike ${n.strikeNumber}` : ""}</p>
              <p className="break-all text-muted">Seen at: {n.location}</p>
              <p className="text-muted">From {n.reporterName}, {n.reporterEmail} · {formatDateTime(n.createdAt)}</p>
              {n.details ? <p className="whitespace-pre-line text-muted">{n.details}</p> : null}
              {n.status === "received" ? <NoticeForm noticeId={n.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RepeatInfringers({ strikes }: Readonly<{ strikes: readonly Strikes[] }>) {
  return (
    <section aria-labelledby="strikes" className="mt-8">
      <h2 id="strikes" className="text-lg font-semibold text-ink">Repeat infringers</h2>
      <p className="mt-1 text-sm text-faint">A brand with {DEFAULT_SETTINGS.repeatInfringerStrikes} upheld notices is a repeat infringer ({SETTINGS_LABEL}).</p>
      {strikes.length === 0 ? <Nothing>No upheld notices.</Nothing> : (
        <ul className="mt-2 text-sm">
          {strikes.map((s) => <li key={s.brandId}>Brand {s.brandId}: {s.upheld} upheld{s.repeatInfringer ? " · repeat infringer" : ""}</li>)}
        </ul>
      )}
    </section>
  );
}

function Marks({ marks }: Readonly<{ marks: readonly MarkRow[] }>) {
  return (
    <section aria-labelledby="marks" className="mt-8">
      <h2 id="marks" className="text-lg font-semibold text-ink">Protected marks ({marks.filter((m) => m.active).length} on)</h2>
      <div className="mt-2 flex flex-col gap-4"><MarkForm /><MarkPictureForm /></div>
      <ul className="mt-4 flex flex-col divide-y divide-hairline">
        {marks.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="text-ink">{m.markText ?? "(picture)"} · {m.holder}</span>
            <span className="text-muted">{m.source === "knitwright-default" ? "Knitwright default list" : m.source}{m.imageHash ? ", picture" : ""}{m.active ? "" : ", off"}</span>
            <MarkToggle markId={m.id} active={m.active} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The moderation review queue, takedown notices and the mark registry (decision 0073). Platform admins only. */
export default async function ReviewPage() {
  await requirePlatformAdmin();
  const client = await sessionClient();
  const [queue, notices, marks] = await Promise.all([listQueue(client), listNotices(client), listMarks(client)]);

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Review</h1>
      <p className="mt-2 text-[15px] text-muted">Flagged uploads, texts, generations and design versions wait here for a person. A run cannot start until a person has looked at its design version.</p>
      <Queue items={queue} />
      <Notices notices={notices} />
      <RepeatInfringers strikes={strikesByBrand(notices, DEFAULT_SETTINGS)} />
      <Marks marks={marks} />
    </main>
  );
}
