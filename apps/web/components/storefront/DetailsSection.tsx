"use client";

import { ChevronRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TEXT_AREA, FIELD_CONTROL } from "@/components/ui/field-styles";
import { Icon } from "@/components/ui/Icon";
import { KwCoin } from "@/components/ui/Marks";
import { Notice } from "@/components/ui/Notice";
import { improveListingAction } from "@/lib/storefront/actions";
import { DESCRIPTION_MAX, TITLE_MAX, type ListingDraft } from "@/lib/storefront/listing";
import type { GpsrRow } from "@/lib/storefront/policy";
import { STOREFRONT_SETTINGS_PATH } from "@/lib/storefront/routes";
import { EditorCard, FieldLabel, StateMark, Switch } from "./parts";

/**
 * LISTING DETAILS (09 screen 23; prototype p06): title, description, Improve listing (AI, charged in credits through
 * the ledger), tags, the size-table switch and the product safety (GPSR) table, with the EU responsible person the
 * brand still owes linked to the storefront settings.
 */

type Props = Readonly<{
  draft: ListingDraft;
  canEdit: boolean;
  improvePrice: number;
  gpsr: readonly GpsrRow[];
  onChange: (next: Partial<ListingDraft>) => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
}>;

function useImprove({ draft, canEdit, price, onChange }: Readonly<{ draft: ListingDraft; canEdit: boolean; price: number; onChange: Props["onChange"] }>) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const improve = () =>
    start(async () => {
      const reply = await improveListingAction({ productId: draft.productId, title: draft.title, description: draft.description, tags: draft.tags }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The writer could not be reached. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      if (!reply.data.ok) return setNote({ tone: "warn", text: reply.data.reason });
      onChange({ title: reply.data.improvement.title, description: reply.data.improvement.description, tags: [...reply.data.improvement.tags] });
      setNote({ tone: "ok", text: reply.data.credits.charged ? `Rewritten. ${reply.data.credits.price} credits used. Read it before you publish.` : "Rewritten. Read it before you publish." });
    });
  return { pending, note, improve, button: (
    <Button variant="secondary" size="sm" icon={<Icon icon={Sparkles} size={16} />} pending={pending} disabled={!canEdit} onClick={improve}>
      Improve listing <KwCoin label="credits" /> {price}
    </Button>
  ) };
}

function Tags({ tags, canEdit, onAdd, onRemove }: Readonly<{ tags: readonly string[]; canEdit: boolean; onAdd: (raw: string) => void; onRemove: (tag: string) => void }>) {
  const [typed, setTyped] = useState("");
  const id = useId();
  const add = () => {
    if (typed.trim().length > 0) onAdd(typed);
    setTyped("");
  };
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>Tags</FieldLabel>
      <ul className="flex flex-wrap gap-2" aria-label="Tags">
        {tags.map((tag) => (
          <li key={tag} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-small text-text">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} disabled={!canEdit} onClick={() => onRemove(tag)} className="grid size-5 place-items-center rounded-full live:hover:bg-soft">
              <Icon icon={X} size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input id={id} className={`${FIELD_CONTROL} flex-1`} value={typed} maxLength={60} disabled={!canEdit || tags.length >= 13} placeholder={tags.length >= 13 ? "13 tags is the most" : "Add a tag, then press Enter"} onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
        <Button variant="secondary" onClick={add} disabled={!canEdit || tags.length >= 13}>+ Add</Button>
      </div>
    </div>
  );
}

export function GpsrTable({ rows }: Readonly<{ rows: readonly GpsrRow[] }>) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-small font-semibold text-text">Product safety (GPSR · UK and EU)</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <p className="bg-soft px-4 py-2.5 text-micro text-text uppercase">Filled in by Knitwright</p>
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="grid grid-cols-1 gap-1 border-t border-border px-4 py-3 text-body md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center md:gap-4">
              <span className="text-text-2">{row.label}</span>
              <span className={row.state === "done" ? "text-text" : "text-warn"}>{row.value}</span>
              {row.state === "done" ? (
                <StateMark state="ok" />
              ) : (
                <Link href={STOREFRONT_SETTINGS_PATH} aria-label={`Fill in ${row.label}`} className="text-muted live:hover:text-text">
                  <Icon icon={ChevronRight} size={16} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DetailsSection({ draft, canEdit, improvePrice, gpsr, onChange, onAddTag, onRemoveTag }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const improve = useImprove({ draft, canEdit, price: improvePrice, onChange });
  return (
    <EditorCard id="details" title="Listing details" action={improve.button}>
      {improve.note ? <Notice tone={improve.note.tone} role={improve.note.tone === "warn" ? "alert" : "status"}>{improve.note.text}</Notice> : null}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={titleId}>Title</FieldLabel>
        <input id={titleId} className={FIELD_CONTROL} value={draft.title} maxLength={TITLE_MAX} disabled={!canEdit} onChange={(event) => onChange({ title: event.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={descriptionId}>Description</FieldLabel>
        <textarea id={descriptionId} rows={6} className={TEXT_AREA} value={draft.description} maxLength={DESCRIPTION_MAX} disabled={!canEdit} onChange={(event) => onChange({ description: event.target.value })} />
        <span className="text-caption text-muted">Plain text. A blank line starts a new paragraph on the storefront.</span>
      </div>
      <Tags tags={draft.tags} canEdit={canEdit} onAdd={onAddTag} onRemove={onRemoveTag} />
      <div className="flex flex-col gap-2">
        <h3 className="text-small font-semibold text-text">Size table</h3>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
          <span className="text-body text-muted">Show size table on listing (cm and in)</span>
          <Switch label="Show size table" hideLabel checked={draft.showSizeTable} disabled={!canEdit} onChange={(next) => onChange({ showSizeTable: next })} />
        </div>
      </div>
      <GpsrTable rows={gpsr} />
    </EditorCard>
  );
}
