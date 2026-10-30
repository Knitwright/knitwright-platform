"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { revokeShareInviteAction } from "@/lib/share/actions";
import type { AccessRow } from "@/lib/share/invites";

/**
 * People with access (spec F-S4 Share). One row per invited address, saying what they may do, how
 * long their invite works and whether we really emailed them. A row never claims an email that no
 * provider took: without an email key the sentence says so and the member sends the link.
 */

function Withdraw({ projectId, inviteId, email }: Readonly<{ projectId: string; inviteId: string; email: string }>) {
  const { form, submit, pending, summary } = useFormAction<unknown>(revokeShareInviteAction);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" variant="secondary" pending={pending} aria-label={`Withdraw the invite to ${email}`}>
        {pending ? "Withdrawing" : "Withdraw"}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}

export function AccessList({ projectId, rows }: Readonly<{ projectId: string; rows: readonly AccessRow[] }>) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid="share-access-empty">
        Only your own workspace can open this design. Invite someone to change that.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="People with access">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-hairline p-4" data-testid="share-access-row" data-state={row.state}>
          <div className="flex min-w-0 flex-col gap-0.5 text-sm">
            <p className="truncate text-ink">{row.email}</p>
            <p className="text-ink-2">{row.accessLabel}</p>
            <p className={row.state === "open" ? "text-muted" : "text-warn"}>{row.stateSentence}</p>
            <p className="text-muted">{row.emailSentence}</p>
          </div>
          {row.canRevoke ? <Withdraw projectId={projectId} inviteId={row.id} email={row.email} /> : null}
        </li>
      ))}
    </ul>
  );
}
