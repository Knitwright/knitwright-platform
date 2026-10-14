"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { checkRoster } from "@/lib/orders/checks";
import { call, projectUrl } from "./call";
import { ImportBox } from "./ImportBox";
import { IssueList } from "./IssueList";
import { RosterTable } from "./RosterTable";
import { blankRow, type Context, type Issue, type OrderDraft, type Row } from "./types";

type Props = Readonly<{
  projectId: string;
  context: Context;
  draft: OrderDraft;
  onSaved: () => void;
  onClose: () => void;
}>;

/** Edits one team list. The checks run as the list changes; the same checks run again on the server when it is saved. */
export function OrderEditor({ projectId, context, draft, onSaved, onClose }: Props) {
  const [name, setName] = useState(draft.name);
  const [rows, setRows] = useState<readonly Row[]>(draft.rows);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const issues: readonly Issue[] = useMemo(() => (rows.length === 0 ? [] : checkRoster(rows, context)), [rows, context]);
  const base = projectUrl(projectId, "orders");

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const reply = await call<{ id: string }>(draft.id ? `${base}/${draft.id}` : base, draft.id ? "PUT" : "POST", { name, rows });
    setBusy(false);
    if (!reply.ok) return setMessage(Object.values(reply.fields).flat()[0] ?? reply.message);
    onSaved();
  };

  const erase = async () => {
    if (!draft.id) return onClose();
    setBusy(true);
    const reply = await call<{ deleted: true }>(`${base}/${draft.id}`, "DELETE");
    setBusy(false);
    if (!reply.ok) return setMessage(reply.message);
    onSaved();
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4" data-testid="order-editor">
      <Field name="order-name" label="Name of this team list" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <ImportBox projectId={projectId} onRows={setRows} />
      <RosterTable rows={rows} context={context} issues={issues} onChange={setRows} />
      <div>
        <Button variant="secondary" onClick={() => setRows([...rows, blankRow(context)])}>Add a player</Button>
      </div>
      <IssueList issues={issues} />
      {message ? <Notice tone="warn" role="alert">{message}</Notice> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" pending={busy} disabled={busy || rows.length === 0 || name.trim() === ""} onClick={() => void save()}>Save</Button>
        <Button variant="quiet" onClick={onClose}>Close</Button>
        {draft.id ? (
          <>
            <a className="soft-link text-[14px] text-muted hover:text-ink" href={`${base}/${draft.id}/manifest?format=pdf`}>Manifest (PDF)</a>
            <a className="soft-link text-[14px] text-muted hover:text-ink" href={`${base}/${draft.id}/manifest?format=csv`}>Manifest (CSV)</a>
            <a className="soft-link text-[14px] text-muted hover:text-ink" href={`${base}/${draft.id}/manifest?format=roster`}>Team list (CSV)</a>
            {confirmErase ? (
              <Button variant="secondary" disabled={busy} onClick={() => void erase()}>Yes, erase every name in this list</Button>
            ) : (
              <Button variant="quiet" onClick={() => setConfirmErase(true)}>Erase this list</Button>
            )}
          </>
        ) : null}
      </div>
      <p className="text-[13px] text-muted">
        Player names are personal data. They are kept only in this list. A release keeps a fingerprint of the list, never the names, and erasing the list removes them.
      </p>
    </div>
  );
}
