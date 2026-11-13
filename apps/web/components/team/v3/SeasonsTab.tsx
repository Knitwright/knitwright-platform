import Link from "next/link";
import { SeasonsPanel } from "@/components/club/SeasonsPanel";
import { ReorderButton } from "@/components/club/reorder/ReorderButton";
import { can } from "@/lib/clubs/roles";
import { listOrderHistory, listSeasons } from "@/lib/clubs/service";
import type { Brand } from "@/lib/server/core/guard";
import { sessionClient } from "@/lib/server/deps";
import { setRosterRetentionAction } from "@/lib/team/actions";
import { readRetention } from "@/lib/team/retention";
import { RetentionForm } from "./RetentionForm";
import { garmentEditorHref } from "@/lib/canvas/address";

/**
 * Team › Seasons (09 screen 17; F-T4, F-T8): one roster per season, each opening its players; the
 * roster-retention opt-in (D5's `set_roster_retention`, decision 0136, given its screen here); and the
 * order history with two-click reorder, both moved from the club page (decision 0144).
 */

const date = (iso: string): string => iso.slice(0, 10);

function Part({ id, title, lead, children }: Readonly<{ id: string; title: string; lead: React.ReactNode; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title text-text">
          {title}
        </h2>
        <div className="max-w-3xl text-body text-muted">{lead}</div>
      </div>
      {children}
    </section>
  );
}

export async function SeasonsTab({ brand }: Readonly<{ brand: Brand }>) {
  const client = await sessionClient();
  const [seasons, history, keep] = await Promise.all([listSeasons(client, brand.id), listOrderHistory(client, brand.id), readRetention(client, brand.id)]);
  const canEdit = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-6">
      <Part
        id="seasons"
        title="Seasons and rosters"
        lead={<p>One roster for each season, with a size for each player. Import a CSV, or start from last season. Ask the players themselves with the <Link href="/team?view=signup" className="text-link">player sign-up link</Link>.</p>}
      >
        <SeasonsPanel seasons={seasons} canEdit={canEdit} />
      </Part>

      <Part id="retention" title="Keeping old rosters" lead="Player names, numbers and sizes are personal data. They are removed two seasons on unless your club chooses to keep them.">
        <RetentionForm action={setRosterRetentionAction} keep={keep} canChange={can(brand.role, "manageMembers")} />
      </Part>

      <Part id="orders" title="Order history" lead="Each time a design was frozen for production. Reorder any of them in two clicks: Reorder, then Confirm.">
        {history.length === 0 ? (
          <p className="text-body text-muted">Nothing has been frozen for production yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {history.map((entry) => (
              <li key={entry.releaseId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-body">
                <Link href={garmentEditorHref(entry.projectId)} className="min-w-0 truncate text-text no-underline live:hover:underline">
                  {entry.designName} · {entry.label}
                </Link>
                <span className="font-mono text-small text-muted">
                  release {entry.number} · {date(entry.createdAt)}
                </span>
                {canEdit ? <ReorderButton releaseId={entry.releaseId} seasons={seasons} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Part>
    </div>
  );
}
