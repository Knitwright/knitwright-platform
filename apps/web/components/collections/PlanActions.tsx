"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { createDropAction, orderSamplesAction } from "@/lib/collections/actions";
import { canExportDrop, dropFindings } from "@/lib/collections/drop";
import { sampleFindings, samplesForApproved } from "@/lib/collections/samples";
import type { CollectionPlan } from "@/lib/collections/types";
import { DROP_IS_A_PAYLOAD } from "@/lib/collections/vocabulary";

type Props = Readonly<{ plan: CollectionPlan; canEdit: boolean }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const newKey = (): string => crypto.randomUUID();

/**
 * The two actions of spec F-S10.
 *
 * "Order samples for all approved styles" hands each sample to production through the make flow's own
 * door (plan v5 Y7): one piece per size, no payment anywhere. "Create drop" exports a payload for the
 * Knitwright Store to collect; it publishes nothing and reaches no storefront (owner decision 1).
 */
export function PlanActions({ plan, canEdit }: Props) {
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [pendingSamples, startSamples] = useTransition();
  const [pendingDrop, startDrop] = useTransition();

  const samples = samplesForApproved(plan);
  const sampleNotes = sampleFindings(plan);
  const dropNotes = dropFindings(plan);
  const dropAllowed = canExportDrop(dropNotes);

  const order = () => {
    startSamples(async () => {
      const reply = await orderSamplesAction({ collectionId: plan.id, requestKey: newKey() }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The sample requests could not be sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `${reply.data.sent.length} sample ${reply.data.sent.length === 1 ? "request" : "requests"} sent to production, waiting for the next cut-off.` });
      router.refresh();
    });
  };

  const drop = () => {
    startDrop(async () => {
      const reply = await createDropAction({ collectionId: plan.id }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The drop payload could not be written. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Drop payload ${reply.data.version} is ready for the Store to collect. Nothing has been published or charged.` });
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="plan-actions" className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5">
      <h3 id="plan-actions" className="text-base font-medium text-ink">
        Actions
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="text-[15px] font-medium text-ink">Order samples for all approved styles</h4>
          <p className="text-sm text-muted">{samples.summary}</p>
          <Button type="button" variant="secondary" pending={pendingSamples} disabled={!canEdit || !samples.canOrder} onClick={order}>
            Order samples
          </Button>
          {sampleNotes.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[13px] text-muted">
              {sampleNotes.map((found) => (
                <li key={found.code + found.message}>{found.message}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-[15px] font-medium text-ink">Create drop</h4>
          <p className="text-sm text-muted">{DROP_IS_A_PAYLOAD}</p>
          <Button type="button" variant="secondary" pending={pendingDrop} disabled={!canEdit || !dropAllowed} onClick={drop}>
            Create drop
          </Button>
          {dropNotes.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[13px] text-muted">
              {dropNotes.map((found) => (
                <li key={found.code}>{found.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {canEdit ? null : <p className="text-sm text-muted">Only owners, admins and kit managers can order samples or create a drop.</p>}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </section>
  );
}
