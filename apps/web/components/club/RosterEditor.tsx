"use client";

import { useEffect, useId, useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { WEARER_GROUPS, WEARER_LABELS, type WearerGroup } from "@/lib/clubs/wording";
import type { PlayerRow } from "./types";

type Props = Readonly<{ seasonId: string; canEdit: boolean }>;

type Stored = Readonly<{ id: string; name: string; number: string; sizeLabel: string; wearerGroup: WearerGroup }>;
type Imported =
  | Readonly<{ ok: true; players: readonly Omit<Stored, "id">[]; problems: readonly { message: string }[]; notes: readonly string[] }>
  | Readonly<{ ok: false; message: string }>;

const MAX_BYTES = 200_000;
let counter = 0;
const nextKey = (): string => `row-${(counter += 1)}`;
const blank = (): PlayerRow => ({ key: nextKey(), name: "", number: "", sizeLabel: "M", wearerGroup: "unisex" });
const asRow = (p: Omit<Stored, "id"> & { id?: string }): PlayerRow => ({ key: nextKey(), ...(p.id ? { id: p.id } : {}), name: p.name, number: p.number, sizeLabel: p.sizeLabel, wearerGroup: p.wearerGroup });

const CELL = `${FIELD_CONTROL} h-10 w-full min-w-0 px-3`;

/** One season's players: edit, add, read from a CSV, then save. Nothing is kept until Save. */
export function RosterEditor({ seasonId, canEdit }: Props) {
  const fileId = useId();
  const [rows, setRows] = useState<readonly PlayerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState<Readonly<{ tone: "ok" | "warn"; lines: readonly string[] }> | null>(null);

  useEffect(() => {
    let current = true;
    void call<{ players: readonly Stored[]; notes: readonly string[] }>(`/api/club/seasons/${seasonId}/roster`, "GET").then((reply) => {
      if (!current) return;
      if (reply.ok) {
        setRows(reply.data.players.map(asRow));
        if (reply.data.notes.length > 0) setNotes({ tone: "warn", lines: reply.data.notes });
      } else setNotes({ tone: "warn", lines: [reply.message] });
    });
    return () => {
      current = false;
    };
  }, [seasonId]);

  const change = (key: string, patch: Partial<PlayerRow>) => {
    setRows((current) => (current ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setNotes({ tone: "warn", lines: ["That file is too big for a roster. Split it into smaller files."] });
    const reply = await call<Imported>(`/api/club/seasons/${seasonId}/roster/import`, "POST", { csv: await file.text() });
    if (!reply.ok) return setNotes({ tone: "warn", lines: [reply.message] });
    if (!reply.data.ok) return setNotes({ tone: "warn", lines: [reply.data.message] });
    setRows(reply.data.players.map(asRow));
    setDirty(true);
    const problems = reply.data.problems.map((p) => p.message);
    setNotes({ tone: problems.length > 0 || reply.data.notes.length > 0 ? "warn" : "ok", lines: [`Read ${reply.data.players.length} players. Press Save to keep them.`, ...problems, ...reply.data.notes] });
  };

  const save = async () => {
    setBusy(true);
    const players = (rows ?? []).map(({ name, number, sizeLabel, wearerGroup }) => ({ name, number, sizeLabel, wearerGroup }));
    const reply = await call<{ saved: number; notes: readonly string[] }>(`/api/club/seasons/${seasonId}/roster`, "PUT", { players });
    setBusy(false);
    if (!reply.ok) return setNotes({ tone: "warn", lines: [reply.message, ...Object.values(reply.fields).flat()] });
    setDirty(false);
    setNotes({ tone: reply.data.notes.length > 0 ? "warn" : "ok", lines: [`Saved ${reply.data.saved} players.`, ...reply.data.notes] });
  };

  const eraseNow = async (row: PlayerRow) => {
    if (!row.id) return setRows((current) => (current ?? []).filter((r) => r.key !== row.key));
    const reply = await call(`/api/club/players/${row.id}`, "DELETE");
    if (!reply.ok) return setNotes({ tone: "warn", lines: [reply.message] });
    setRows((current) => (current ?? []).filter((r) => r.key !== row.key));
    setNotes({ tone: "ok", lines: ["That player is erased."] });
  };

  if (rows === null) return notes ? <Notice tone="warn" role="alert">{notes.lines.join(" ")}</Notice> : <p className="text-sm text-muted">Loading the roster.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Players</caption>
          <thead className="text-muted">
            <tr><th scope="col" className="pb-2 pr-2 font-normal">Name</th><th scope="col" className="pb-2 pr-2 font-normal">Number</th><th scope="col" className="pb-2 pr-2 font-normal">Size</th><th scope="col" className="pb-2 pr-2 font-normal">Wearer</th><th scope="col" className="pb-2"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="pb-2 pr-2"><input aria-label={`Name, player ${index + 1}`} className={CELL} maxLength={40} disabled={!canEdit} value={row.name} onChange={(e) => change(row.key, { name: e.target.value })} /></td>
                <td className="w-24 pb-2 pr-2"><input aria-label={`Number, player ${index + 1}`} className={`${CELL} font-mono`} inputMode="numeric" maxLength={3} disabled={!canEdit} value={row.number} onChange={(e) => change(row.key, { number: e.target.value })} /></td>
                <td className="w-24 pb-2 pr-2"><input aria-label={`Size, player ${index + 1}`} className={CELL} maxLength={16} disabled={!canEdit} value={row.sizeLabel} onChange={(e) => change(row.key, { sizeLabel: e.target.value })} /></td>
                <td className="w-36 pb-2 pr-2">
                  <select aria-label={`Wearer, player ${index + 1}`} className={CELL} disabled={!canEdit} value={row.wearerGroup} onChange={(e) => change(row.key, { wearerGroup: e.target.value as WearerGroup })}>
                    {WEARER_GROUPS.map((g) => <option key={g} value={g}>{WEARER_LABELS[g]}</option>)}
                  </select>
                </td>
                <td className="pb-2">{canEdit ? <Button variant="quiet" type="button" aria-label={`Erase player ${index + 1}`} onClick={() => void eraseNow(row)}>Erase</Button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="text-sm text-muted">No players yet.</p> : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="secondary" type="button" onClick={() => { setRows([...rows, blank()]); setDirty(true); }}>Add a player</Button>
          <div className="flex flex-col gap-1">
            <label htmlFor={fileId} className="text-sm font-medium text-ink">Read players from a CSV file</label>
            <input id={fileId} type="file" accept=".csv,text/csv" className="text-sm text-ink-2" onChange={(e) => void importCsv(e.target.files?.[0])} />
          </div>
          <Button type="button" pending={busy} disabled={!dirty} onClick={() => void save()}>Save roster</Button>
        </div>
      ) : null}
      <p className="text-[13px] text-muted">Player names are personal data. Erasing a player, a season or the club removes them for good.</p>
      {notes ? <Notice tone={notes.tone} role={notes.tone === "warn" ? "alert" : "status"}>{notes.lines.map((line) => <p key={line}>{line}</p>)}</Notice> : null}
    </div>
  );
}
