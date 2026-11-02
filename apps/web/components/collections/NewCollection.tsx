"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { createCollectionAction, saveFrameAction } from "@/lib/collections/actions";

type Market = Readonly<{ country: string; name: string; currency: string }>;
type Props = Readonly<{ markets: readonly Market[]; canEdit: boolean }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

/** The groups a new plan starts with, as the spec's own example names them (F-S10, "Groups"). */
const FIRST_GROUPS = ["Core", "Training", "Matchday"] as const;

/**
 * Starts a collection plan. The destination decides the freight and duty the line plan adds, and the
 * currency is the market's own (spec F-S8: the United Kingdom in GBP, Australia in AUD). Only markets
 * Knitwright sells to are offered, from `country_rules`, so nothing here is a market decision.
 */
export function NewCollection({ markets, canEdit }: Props) {
  const router = useRouter();
  const ids = { name: useId(), market: useId() };
  const [name, setName] = useState("");
  const [market, setMarket] = useState(markets[0]?.country ?? "");
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();

  const chosen = markets.find((one) => one.country === market) ?? null;

  const send = () => {
    if (chosen === null) return setNote({ tone: "warn", text: "Choose the market the plan is landed in." });
    if (chosen.currency !== "GBP" && chosen.currency !== "AUD") {
      return setNote({ tone: "warn", text: `Knitwright has no price list in ${chosen.currency} yet, so a plan cannot be made in it.` });
    }
    start(async () => {
      const reply = await createCollectionAction({ name: name.trim(), destinationCountry: chosen.country, currency: chosen.currency }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The plan could not be made. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      for (const group of FIRST_GROUPS) {
        await saveFrameAction({ collectionId: reply.data.id, frameId: null, name: group, x: 0, y: 0 }).catch(() => null);
      }
      setName("");
      setNote({ tone: "ok", text: `${name.trim()} is ready, with the groups ${FIRST_GROUPS.join(", ")}.` });
      router.refresh();
    });
  };

  if (!canEdit) return <p className="text-sm text-muted">Only owners, admins and kit managers can start a collection plan.</p>;
  if (markets.length === 0) return <Notice tone="warn">No market is open for selling yet, so a plan has nowhere to be landed.</Notice>;

  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-medium text-ink">
          Name this plan
        </label>
        <input id={ids.name} required maxLength={80} className={FIELD_CONTROL} value={name} onChange={(event) => setName(event.target.value)} placeholder="Spring drop" />
      </div>
      <div className="flex min-w-48 flex-col gap-1.5">
        <label htmlFor={ids.market} className="text-sm font-medium text-ink">
          Landed in
        </label>
        <select id={ids.market} className={FIELD_CONTROL} value={market} onChange={(event) => setMarket(event.target.value)}>
          {markets.map((one) => (
            <option key={one.country} value={one.country}>
              {one.name} ({one.currency})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" pending={pending} disabled={name.trim() === ""}>
        Start the plan
      </Button>
      {note ? (
        <div className="w-full">
          <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
            {note.text}
          </Notice>
        </div>
      ) : null}
    </form>
  );
}
