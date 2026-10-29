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

function RevokePacketForm({ batchId, packetId }: Readonly<{ batchId: string; packetId: string }>) {
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

/**
 * The batch's factory link: make it, send it again, or revoke it, with the address above the buttons.
 *
 * One form and one hook do both making and sending again, chosen by whether the batch already has a live
 * packet. That is not tidiness: `PacketSection` is a server component, and the moment an action makes a
 * packet, `revalidatePath` swaps "Make factory link" for "Send again" in the same commit that delivers
 * the action's answer. A separate create component would already be unmounted by then, so neither its
 * state nor an effect of its own could show what it had just been given -- and the address is only ever
 * knowable at that moment, because the token is stored hashed and never read back. Losing it left ops
 * with a link they could not pass to the factory and no way but revoking to get another. Keeping one
 * hook across both states is what `SharePanel` does, where the create form happens never to be swapped.
 */
export function PacketForms({ batchId, packetId }: Readonly<{ batchId: string; packetId: string | null }>) {
  const again = packetId !== null;
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction<Issued>(
    again ? resendPacketAction : createPacketAction,
  );
  return (
    <>
      {state.result?.success === true ? <IssuedLink key={state.attempt} issued={state.result.data} /> : null}
      <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
        <FormSummary message={summary} />
        <input type="hidden" name="batchId" value={batchId} />
        {packetId === null ? null : <input type="hidden" name="packetId" value={packetId} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="whatsapp" label="Factory WhatsApp number (optional)" inputMode="tel" placeholder="+923001234567" errors={fieldErrors("whatsapp")} />
          <Field name="days" label="Days the link works" type="number" min={1} max={MAX_PACKET_DAYS} defaultValue={DEFAULT_PACKET_DAYS} errors={fieldErrors("days")} />
        </div>
        {again ? <p className="text-sm text-faint">Sending again makes a new address. The old one stops working.</p> : null}
        <div>
          <Button type="submit" variant={again ? "secondary" : "primary"} pending={pending}>
            {pending ? (again ? "Sending" : "Making") : again ? "Send again" : "Make factory link"}
          </Button>
        </div>
      </form>
      {packetId === null ? null : <RevokePacketForm batchId={batchId} packetId={packetId} />}
    </>
  );
}
