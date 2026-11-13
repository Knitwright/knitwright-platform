"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { Notice } from "@/components/ui/Notice";
import { cancelStorefrontDropAction, openStorefrontDropAction, sendStorefrontBatchesAction } from "@/lib/storefront/actions";
import { failureText } from "./StorefrontSettingsForm";
import { FieldLabel } from "./parts";

/**
 * DROPS AND BATCHES (spec F-L5; plan v6 C3, decision 0154). A drop is made from a collection plan (P5's
 * `/orders/plans`): its styles' listings open and close together, with the planned pieces as targets. At close, and
 * every Monday for made-to-order sales, each listing's paid orders go to production as one order.
 */

export type DropCard = Readonly<{ id: string; name: string; state: string; when: string; progress: string; percent: number | null; cancellable: boolean }>;
export type PlanOption = Readonly<{ id: string; name: string }>;

type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

/** A datetime-local value ("2026-11-20T10:00", the browser's own time) as an ISO instant, or "" when blank. */
const instant = (local: string): string => (local === "" ? "" : new Date(local).toISOString());

export function NewDropForm({ plans, canEdit }: Readonly<{ plans: readonly PlanOption[]; canEdit: boolean }>) {
  const router = useRouter();
  const ids = { plan: useId(), name: useId(), opens: useId(), closes: useId() };
  const [form, setForm] = useState({ collectionId: plans[0]?.id ?? "", name: "", opens: "", closes: "" });
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();
  const set = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }));

  const open = () =>
    start(async () => {
      const reply = await openStorefrontDropAction({ collectionId: form.collectionId, name: form.name, opensAt: instant(form.opens), closesAt: instant(form.closes) }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The drop could not be made. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: failureText(reply.error) });
      const left = reply.data.left.length > 0 ? ` Not in it: ${reply.data.left.join("; ")}.` : "";
      setNote({ tone: "ok", text: `Drop made with ${reply.data.listings} ${reply.data.listings === 1 ? "listing" : "listings"}.${left}` });
      router.refresh();
    });

  if (plans.length === 0) return <p className="text-body text-muted">Make a collection plan under Orders, then open a drop from it here.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.plan}>Collection plan</FieldLabel>
          <select id={ids.plan} className={FIELD_CONTROL} value={form.collectionId} disabled={!canEdit} onChange={(event) => set({ collectionId: event.target.value })}>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.name}>Drop name</FieldLabel>
          <input id={ids.name} className={FIELD_CONTROL} value={form.name} maxLength={80} disabled={!canEdit} onChange={(event) => set({ name: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.opens}>Opens</FieldLabel>
          <input id={ids.opens} type="datetime-local" className={FIELD_CONTROL} value={form.opens} disabled={!canEdit} onChange={(event) => set({ opens: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.closes}>Closes</FieldLabel>
          <input id={ids.closes} type="datetime-local" className={FIELD_CONTROL} value={form.closes} disabled={!canEdit} onChange={(event) => set({ closes: event.target.value })} />
        </div>
      </div>
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
      <div>
        <Button variant="secondary" pending={pending} disabledReason={canEdit ? undefined : "Only owners, admins and kit managers can open a drop."} onClick={open}>
          Open drop
        </Button>
      </div>
    </div>
  );
}

export function DropList({ drops, canEdit }: Readonly<{ drops: readonly DropCard[]; canEdit: boolean }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = (dropId: string) =>
    start(async () => {
      const reply = await cancelStorefrontDropAction({ dropId }).catch(() => null);
      if (!reply || !reply.success) return setProblem(reply ? reply.error.message : "The drop could not be cancelled. Try again.");
      router.refresh();
    });
  if (drops.length === 0) return <p className="text-body text-muted">No drops yet.</p>;
  return (
    <>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <ul className="grid gap-3 md:grid-cols-2" aria-label="Drops">
        {drops.map((drop) => (
          <li key={drop.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body font-semibold text-text">{drop.name}</span>
              <span className="rounded-full bg-soft px-2.5 py-0.5 text-caption text-text-2">{drop.state}</span>
            </div>
            <span className="text-small text-muted">{drop.when}</span>
            <span className="text-small text-text-2">{drop.progress}</span>
            {drop.percent !== null ? (
              <span className="h-1.5 overflow-hidden rounded-full bg-soft" role="progressbar" aria-label={`${drop.name} progress`} aria-valuenow={drop.percent} aria-valuemin={0} aria-valuemax={100}>
                <span className="block h-full bg-navy" style={{ width: `${drop.percent}%` }} />
              </span>
            ) : null}
            {drop.cancellable && canEdit ? (
              <div>
                <Button variant="ghost" size="sm" pending={pending} onClick={() => cancel(drop.id)}>Cancel drop</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SendBatchesButton({ canEdit, next }: Readonly<{ canEdit: boolean; next: string }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const send = () =>
    start(async () => {
      const reply = await sendStorefrontBatchesAction({}).catch(() => null);
      if (!reply || !reply.success) return setNote({ tone: "warn", text: reply ? reply.error.message : "Nothing was sent. Try again." });
      const run = reply.data;
      setNote({ tone: run.refused > 0 || run.failed > 0 ? "warn" : "ok", text: run.batches === 0 ? "Nothing is waiting to be sent." : `${run.sent} sent to production, ${run.refused} refused (shoppers refunded), ${run.failed} to try again.` });
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-muted">Made-to-order sales go to the factory every {next}. Send them now if you would rather not wait.</p>
      <div>
        <Button variant="secondary" pending={pending} disabledReason={canEdit ? undefined : "Only owners, admins and kit managers can send batches."} onClick={send}>
          Send paid sales now
        </Button>
      </div>
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
    </div>
  );
}
