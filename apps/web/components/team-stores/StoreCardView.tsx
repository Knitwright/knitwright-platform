"use client";

import { Copy, QrCode as QrIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { endTeamStoreAction } from "@/lib/team-stores/actions";
import type { StoreCard } from "@/lib/team-stores/view";
import { QrCode } from "./QrCode";

/**
 * One team store, as a club reads it (decision 0153; 09 screen 16's card: "closes in, sizes collected 18/25, club
 * margin"): its state, when it closes, pieces against the minimum, the price a buyer pays, the club's margin, the
 * link with a copy button and its QR code, and — while it is open — Close now and Cancel and refund.
 */
export function StoreCardView({ card, canEdit, onChanged }: Readonly<{ card: StoreCard; canEdit: boolean; onChanged?: () => void }>) {
  const [showQr, setShowQr] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const [busy, setBusy] = useState<"close" | "cancel" | null>(null);

  const copy = async () => {
    const done = await navigator.clipboard?.writeText(card.link).then(() => true, () => false);
    setNote(done ? { tone: "ok", text: "Link copied." } : { tone: "warn", text: `Copy the link by hand: ${card.link}` });
  };

  const end = async (how: "close" | "cancel") => {
    setBusy(how);
    const reply = await endTeamStoreAction({ storeId: card.id, how }).catch(() => null);
    setBusy(null);
    if (reply === null) return setNote({ tone: "warn", text: "It could not be sent. Check your connection and try again." });
    if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
    setNote({ tone: "ok", text: how === "close" ? "Closed. The store's orders are now one order." : "Cancelled. Everyone who paid is being refunded." });
    onChanged?.();
  };

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4" data-testid="team-store-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-title text-text">{card.title}</h3>
          <p className="text-small text-muted">{card.when}</p>
        </div>
        <StatusPill tone={card.tone}>{card.stateLabel}</StatusPill>
      </header>
      <div className="flex flex-col gap-1">
        <div className="h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-label="Pieces against the minimum" aria-valuenow={card.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-navy" style={{ width: `${card.percent}%` }} />
        </div>
        <p className="text-small text-text-2">{card.progress}</p>
      </div>
      <p className="text-small text-text-2">
        {card.price} · {card.margin}
      </p>
      {card.message ? <p className="text-small text-muted">{card.message}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <a href={card.link} className="min-w-0 truncate text-small font-semibold text-link live:hover:underline" data-testid="team-store-link">
          {card.link}
        </a>
        <Button variant="secondary" size="sm" icon={<Icon icon={Copy} />} onClick={() => void copy()}>
          Copy link
        </Button>
        <Button variant="ghost" size="sm" icon={<Icon icon={QrIcon} />} aria-expanded={showQr} onClick={() => setShowQr((open) => !open)}>
          {showQr ? "Hide QR code" : "QR code"}
        </Button>
      </div>
      {showQr ? <QrCode text={card.link} label={`QR code for ${card.title}`} /> : null}
      {canEdit && card.canEnd ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button variant="secondary" size="sm" pending={busy === "close"} disabled={busy !== null} onClick={() => void end("close")}>
            Close now
          </Button>
          <Button variant="danger" size="sm" pending={busy === "cancel"} disabled={busy !== null} onClick={() => void end("cancel")}>
            Cancel and refund
          </Button>
        </div>
      ) : null}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </article>
  );
}
