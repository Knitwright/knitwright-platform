"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { publishListingAction, saveListingAction, unpublishListingAction } from "@/lib/storefront/actions";
import { draftOf, liveView, makePrimary, savedLine, toggleMedia, withPrice, withTag, withoutTag } from "@/lib/storefront/editor-state";
import type { HealthFacts } from "@/lib/storefront/health";
import { canPublish } from "@/lib/storefront/health";
import { STATUS_LABELS, type Listing, type ListingDraft, type MediaItem } from "@/lib/storefront/listing";
import type { GpsrRow } from "@/lib/storefront/policy";
import type { UnitCost } from "@/lib/storefront/pricing";
import { DetailsSection } from "./DetailsSection";
import { ListingAside } from "./ListingAside";
import { MockupsSection } from "./MockupsSection";
import { PersonalisationSection, PricingSection, PublishingSection } from "./SaleSections";

/**
 * THE LISTING EDITOR (plan v6 C3, decision 0154; 09 screen 23; prototype p06). Section tabs scroll to Mockups,
 * Listing details, Personalization, Pricing and Publishing; the preview and Listing health stay beside them; the
 * sticky bar has Save as draft and the gold Publish. The server checks everything again on each press.
 */

export type EditorProps = Readonly<{
  listing: Listing;
  productName: string;
  editDesignHref: Route;
  sizes: readonly string[];
  fabrics: readonly string[];
  cost: UnitCost;
  facts: Omit<HealthFacts, "rows">;
  gpsr: readonly GpsrRow[];
  pool: readonly MediaItem[];
  sources: Readonly<Record<string, string>>;
  canEdit: boolean;
  improvePrice: number;
}>;

const SECTIONS = [
  { id: "mockups", label: "Mockups" },
  { id: "details", label: "Listing details" },
  { id: "personalization", label: "Personalization" },
  { id: "pricing", label: "Pricing" },
  { id: "publishing", label: "Publishing" },
] as const;

type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function ListingEditor(props: EditorProps) {
  const { listing, sizes, cost, facts, canEdit } = props;
  const router = useRouter();
  const [draft, setDraft] = useState<ListingDraft>(() => draftOf(listing));
  const [savedAt, setSavedAt] = useState<string | null>(listing.id ? listing.updatedAt : null);
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();
  const now = useNow();
  const view = useMemo(() => liveView(listing, draft, sizes, cost, facts), [listing, draft, sizes, cost, facts]);
  const change = (next: Partial<ListingDraft>) => setDraft((current) => ({ ...current, ...next }));
  const primary = draft.media[0];

  const send = (kind: "save" | "publish" | "unpublish") =>
    start(async () => {
      const reply = await (kind === "save" ? saveListingAction(draft) : kind === "publish" ? publishListingAction(draft) : unpublishListingAction({ productId: draft.productId })).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "Nothing was saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      if ("savedAt" in reply.data) setSavedAt(reply.data.savedAt);
      setNote({ tone: "ok", text: kind === "publish" ? "Published. It is on sale where you chose." : kind === "save" ? "Saved as a draft." : "Taken off sale. It is a draft again." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/products/mine" className="flex w-fit items-center gap-2 text-h3 font-medium text-text-2 no-underline live:hover:text-text">
        <Icon icon={ArrowLeft} size={20} />
        My products
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">{props.productName}</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-soft px-3 py-1 text-small text-text-2" data-testid="listing-status">{STATUS_LABELS[listing.status]}</span>
          <Link href={props.editDesignHref} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-body font-semibold text-text no-underline live:hover:bg-soft">
            <Icon icon={Pencil} size={16} />
            Edit design
          </Link>
        </div>
      </header>
      <nav aria-label="Listing sections" className="flex gap-6 overflow-x-auto border-b border-border">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="shrink-0 border-b-2 border-transparent pb-3 text-body-lg font-semibold text-muted no-underline live:hover:border-text live:hover:text-text">
            {section.label}
          </a>
        ))}
      </nav>
      {!canEdit ? <Notice tone="info">You can look at this listing. Only owners, admins and kit managers can change or publish it.</Notice> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18.75rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <MockupsSection media={draft.media} pool={props.pool} sources={props.sources} canEdit={canEdit} onToggle={(item) => setDraft((d) => toggleMedia(d, item))} onPrimary={(id) => setDraft((d) => makePrimary(d, id))} />
          <DetailsSection draft={draft} canEdit={canEdit} improvePrice={props.improvePrice} gpsr={props.gpsr} onChange={change} onAddTag={(raw) => setDraft((d) => withTag(d, raw))} onRemoveTag={(tag) => setDraft((d) => withoutTag(d, tag))} />
          <PersonalisationSection draft={draft} canEdit={canEdit} onChange={change} />
          <PricingSection rows={view.rows} cost={cost} currency={draft.currency} canEdit={canEdit} onPrice={(size, text) => setDraft((d) => withPrice(d, size, text))} />
          <PublishingSection draft={draft} canEdit={canEdit} fabrics={props.fabrics} onChange={change} />
        </div>
        <ListingAside draft={draft} sizes={sizes} image={primary ? (props.sources[primary.id] ?? null) : null} health={view.health} />
      </div>
      <div className="sticky bottom-0 z-20 border-t border-border bg-bg py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body text-muted" aria-live="polite">{savedLine(savedAt, now)}</span>
          <div className="flex items-center gap-3">
            {listing.status === "published" ? <Button variant="ghost" disabled={!canEdit} pending={pending} onClick={() => send("unpublish")}>Take off sale</Button> : null}
            <Button variant="secondary" disabled={!canEdit} pending={pending} onClick={() => send("save")}>Save as draft</Button>
            <Button variant="premium" pending={pending} disabledReason={!canEdit ? "Only owners, admins and kit managers can publish." : canPublish(view.health) ? undefined : "Listing health has something to fix first."} onClick={() => send("publish")}>
              Publish
            </Button>
          </div>
        </div>
        {note ? <div className="mt-2"><Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice></div> : null}
      </div>
    </div>
  );
}
