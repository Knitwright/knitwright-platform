"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { RosterEditor } from "./RosterEditor";
import type { SeasonView } from "./types";

type Props = Readonly<{ seasons: readonly SeasonView[]; canEdit: boolean }>;

const when = (season: SeasonView): string =>
  season.startsOn || season.endsOn ? ` · ${season.startsOn ?? "…"} to ${season.endsOn ?? "…"}` : "";

/** Seasons, each with its roster. A new season can start from an earlier one, with every size pre-filled. */
export function SeasonsPanel({ seasons, canEdit }: Props) {
  const router = useRouter();
  const nameId = useId();
  const fromId = useId();
  const [open, setOpen] = useState<string | null>(seasons[0]?.id ?? null);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);

  const create = async () => {
    const reply = await call<{ id: string }>("/api/club/seasons", "POST", { name, ...(from ? { copyFromSeasonId: from } : {}) });
    if (!reply.ok) return setNote({ tone: "warn", text: reply.message });
    setNote({ tone: "ok", text: from ? "The season is made with last season's players and sizes." : "The season is made." });
    setName("");
    setFrom("");
    setOpen(reply.data.id);
    router.refresh();
  };

  const erase = async (season: SeasonView) => {
    const reply = await call(`/api/club/seasons/${season.id}`, "DELETE");
    setNote(reply.ok ? { tone: "ok", text: `${season.name} and its players are erased.` } : { tone: "warn", text: reply.message });
    if (reply.ok) {
      setOpen(null);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {seasons.length === 0 ? <p className="text-[15px] text-muted">No seasons yet.</p> : null}
      <ul className="flex flex-col divide-y divide-hairline">
        {seasons.map((season) => (
          <li key={season.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] text-ink">{season.name}<span className="text-muted">{when(season)} · {season.players} {season.players === 1 ? "player" : "players"}</span></p>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" aria-expanded={open === season.id} onClick={() => setOpen(open === season.id ? null : season.id)}>
                  {open === season.id ? "Close roster" : "Open roster"}
                </Button>
                {canEdit ? <Button variant="quiet" type="button" onClick={() => void erase(season)}>Erase season</Button> : null}
              </div>
            </div>
            {open === season.id ? <div className="mt-4"><RosterEditor key={season.id} seasonId={season.id} canEdit={canEdit} /></div> : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium text-ink">New season</label>
            <input id={nameId} required maxLength={80} className={FIELD_CONTROL} value={name} onChange={(e) => setName(e.target.value)} placeholder="2027" />
          </div>
          {seasons.length > 0 ? (
            <div className="flex min-w-48 flex-col gap-1.5">
              <label htmlFor={fromId} className="text-sm font-medium text-ink">Start with the players of</label>
              <select id={fromId} className={FIELD_CONTROL} value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">An empty roster</option>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : null}
          <Button variant="secondary" type="submit">Make season</Button>
        </form>
      ) : null}
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
    </div>
  );
}
