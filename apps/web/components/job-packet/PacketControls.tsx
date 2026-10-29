"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createPacketAction, resendPacketAction, revokePacketAction } from "@/lib/job-packet/actions";
import type { Issued } from "@/lib/job-packet/issue";
import { DEFAULT_PACKET_DAYS, MAX_PACKET_DAYS } from "@/lib/job-packet/steps";

/** The address, shown once, and what happened to the WhatsApp message. */
function IssuedLink({ issued }: Readonly<{ issued: Issued }>) {
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="job-packet-address">
      <FormDone>Factory link made. It is shown only now: copy it.</FormDone>
      <code className="break-all rounded bg-tile p-2 text-ink">{issued.address}</code>
      <p className="text-muted">Works until {issued.expiresAt.slice(0, 10)}.</p>
      {issued.notify === null ? <p className="text-muted">No WhatsApp number given: send the link to the factory yourself.</p> : null}
      {issued.notify?.sent === true ? <p className="text-muted">Sent to the factory on WhatsApp.</p> : null}
      {issued.notify?.sent === false ? <p className="text-warn">{issued.notify.reason}</p> : null}
    </div>
  );
}

function SendFields({ errors }: Readonly<{ errors: (name: string) => readonly string[] }>) {
  return (
    <>
      <Field name="whatsapp" label="Factory WhatsApp number (optional)" inputMode="tel" placeholder="+923001234567" errors={errors("whatsapp")} />
      <Field name="days" label="Days the link works" type="number" min={1} max={MAX_PACKET_DAYS} defaultValue={DEFAULT_PACKET_DAYS} errors={errors("days")} />
    </>
  );
}

export function CreatePacketForm({ batchId }: Readonly<{ batchId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createPacketAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
      <FormSummary message={summary} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="grid gap-3 sm:grid-cols-2"><SendFields errors={fieldErrors} /></div>
      <div><Button type="submit" pending={pending}>{pending ? "Making" : "Make factory link"}</Button></div>
      {state.result?.success === true ? <IssuedLink issued={state.result.data} /> : null}
    </form>
  );
}

export function ResendPacketForm({ batchId, packetId }: Readonly<{ batchId: string; packetId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(resendPacketAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
      <FormSummary message={summary} />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="packetId" value={packetId} />
      <div className="grid gap-3 sm:grid-cols-2"><SendFields errors={fieldErrors} /></div>
      <p className="text-sm text-faint">Sending again makes a new address. The old one stops working.</p>
      <div><Button type="submit" variant="secondary" pending={pending}>{pending ? "Sending" : "Send again"}</Button></div>
      {state.result?.success === true ? <IssuedLink issued={state.result.data} /> : null}
    </form>
  );
}

export function RevokePacketForm({ batchId, packetId }: Readonly<{ batchId: string; packetId: string }>) {
  const { form, submit, pending, summary } = useFormAction(revokePacketAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="packetId" value={packetId} />
      <div><Button type="submit" variant="secondary" pending={pending}>{pending ? "Revoking" : "Revoke factory link"}</Button></div>
    </form>
  );
}
