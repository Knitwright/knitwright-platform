"use client";

import { useId, useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { SPONSORS_MAX } from "@/lib/clubs/wording";
import type { KitView, PictureChoice } from "./types";

type Props = Readonly<{ kit: KitView; pictures: readonly PictureChoice[]; canEdit: boolean }>;

type ColourKey = "primaryColour" | "secondaryColour" | "accentColour";
const COLOURS: readonly (readonly [ColourKey, string])[] = [
  ["primaryColour", "Main colour"],
  ["secondaryColour", "Second colour"],
  ["accentColour", "Accent colour"],
];

function ColourField({ label, value, disabled, onChange }: Readonly<{ label: string; value: string | null; disabled: boolean; onChange: (value: string | null) => void }>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={`${label}, pick`}
          disabled={disabled}
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-xl border border-hairline bg-transparent p-1 disabled:cursor-not-allowed"
        />
        <span className="font-mono text-sm text-ink-2">{value ?? "Not chosen"}</span>
        {value && !disabled ? (
          <button type="button" className="soft-link ml-auto text-sm text-muted" onClick={() => onChange(null)}>Clear</button>
        ) : null}
      </div>
    </div>
  );
}

function PictureSelect({ label, value, pictures, disabled, onChange }: Readonly<{ label: string; value: string | null; pictures: readonly PictureChoice[]; disabled: boolean; onChange: (value: string | null) => void }>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <select id={id} className={FIELD_CONTROL} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">None</option>
        {pictures.map((p) => <option key={p.fileId} value={p.fileId}>{p.label}</option>)}
      </select>
    </div>
  );
}

/** The club kit: colours, crest, up to three sponsors. Only people who may change the kit can edit it. */
export function KitPanel({ kit: initial, pictures, canEdit }: Props) {
  const [kit, setKit] = useState<KitView>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const noPictures = pictures.length === 0;

  const save = async () => {
    setBusy(true);
    const reply = await call("/api/club/kit", "PUT", { ...kit, nameFont: "geist", numberFont: "geist" });
    setBusy(false);
    setNote(reply.ok ? { tone: "ok", text: "The kit is saved." } : { tone: "warn", text: reply.message });
  };

  const setSponsor = (index: number, patch: Partial<KitView["sponsors"][number]>) =>
    setKit({ ...kit, sponsors: kit.sponsors.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {COLOURS.map(([key, label]) => (
          <ColourField key={key} label={label} value={kit[key]} disabled={!canEdit} onChange={(value) => setKit({ ...kit, [key]: value })} />
        ))}
      </div>
      <PictureSelect label="Crest" value={kit.crestFileId} pictures={pictures} disabled={!canEdit || noPictures} onChange={(value) => setKit({ ...kit, crestFileId: value })} />
      {noPictures ? <p className="text-[13px] text-muted">Upload your crest in a design&apos;s artwork first, then choose it here.</p> : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Sponsors (up to {SPONSORS_MAX})</legend>
        {kit.sponsors.map((sponsor, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-ink-2" htmlFor={`sponsor-name-${index}`}>Sponsor {index + 1} name</label>
              <input id={`sponsor-name-${index}`} className={FIELD_CONTROL} maxLength={40} disabled={!canEdit} value={sponsor.name} onChange={(e) => setSponsor(index, { name: e.target.value })} />
            </div>
            <PictureSelect label={`Sponsor ${index + 1} logo`} value={sponsor.logoFileId} pictures={pictures} disabled={!canEdit || noPictures} onChange={(value) => setSponsor(index, { logoFileId: value })} />
            {canEdit ? <Button variant="quiet" type="button" onClick={() => setKit({ ...kit, sponsors: kit.sponsors.filter((_, i) => i !== index) })}>Remove</Button> : null}
          </div>
        ))}
        {canEdit && kit.sponsors.length < SPONSORS_MAX ? (
          <div><Button variant="secondary" type="button" onClick={() => setKit({ ...kit, sponsors: [...kit.sponsors, { name: "", logoFileId: null }] })}>Add a sponsor</Button></div>
        ) : null}
      </fieldset>
      <p className="text-[13px] text-muted">Names and numbers use Geist, the only font bundled so far.</p>
      {canEdit ? <div><Button type="button" pending={busy} onClick={() => void save()}>Save kit</Button></div> : <Notice>Your role can look at the kit but not change it.</Notice>}
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
    </div>
  );
}
