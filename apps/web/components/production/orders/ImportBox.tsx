"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { call, projectUrl } from "./call";
import type { Issue, Row } from "./types";

type Preview =
  | Readonly<{ ok: true; rows: readonly Row[]; problems: readonly { message: string }[]; issues: readonly Issue[] }>
  | Readonly<{ ok: false; needsMapping: boolean; message: string }>;

type Props = Readonly<{ projectId: string; onRows: (rows: readonly Row[]) => void }>;

const MAX_BYTES = 200_000;

/** Reads a team list from a CSV file. The rows are shown for the person to look at before they are used. */
export function ImportBox({ projectId, onRows }: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; lines: readonly string[] }> | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setNote({ tone: "warn", lines: ["That file is too big for a team list. Split it into smaller files."] });
      return;
    }
    setBusy(true);
    const reply = await call<Preview>(projectUrl(projectId, "orders/import"), "POST", { csv: await file.text() });
    setBusy(false);
    if (!reply.ok) return setNote({ tone: "warn", lines: [reply.message] });
    if (!reply.data.ok) return setNote({ tone: "warn", lines: [reply.data.message] });
    onRows(reply.data.rows);
    const skipped = reply.data.problems.map((p) => p.message);
    setNote({ tone: skipped.length > 0 ? "warn" : "ok", lines: [`Read ${reply.data.rows.length} players.`, ...skipped] });
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">Read a team list from a CSV file</label>
      <input id={inputId} type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => void read(e.target.files?.[0])} className="min-h-10 text-sm text-ink-2" />
      <p className="text-[13px] text-muted">One row for each player, with columns for name, number and size. Cut and shirts are optional. Nothing is saved until you press Save.</p>
      {busy ? <Button variant="quiet" pending disabled>Reading</Button> : null}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Notice>
      ) : null}
    </div>
  );
}
