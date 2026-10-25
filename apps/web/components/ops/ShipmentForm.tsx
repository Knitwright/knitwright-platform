"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { recordShipmentAction } from "@/lib/ops/shipping/actions";

/** Records a parcel by hand. Nothing is sent to a courier: ops types what the courier gave. */
export function ShipmentForm({ orderId, remaining }: Readonly<{ orderId: string; remaining: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(recordShipmentAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {done ? <FormDone>{done.complete ? "Parcel recorded. Every piece is shipped." : "Parcel recorded. Pieces are still to ship."}</FormDone> : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="courier" label="Courier" maxLength={80} errors={fieldErrors("courier")} />
      <Field name="trackingNumber" label="Tracking number" maxLength={80} errors={fieldErrors("trackingNumber")} />
      <Field name="shippedOn" label="Shipped on" type="date" errors={fieldErrors("shippedOn")} />
      <Field name="sizes" label="Pieces sent, by size" hint={`Still owed: ${remaining}. Such as M 2, L 1.`} errors={fieldErrors("sizes")} />
      <div className="sm:col-span-2"><Field name="note" label="Note" maxLength={300} errors={fieldErrors("note")} /></div>
      <Field name="restOwner" label="Owner of the rest" maxLength={80} hint="Only if this parcel leaves pieces behind." errors={fieldErrors("restOwner")} />
      <Field name="restDueOn" label="Due date for the rest" type="date" errors={fieldErrors("restDueOn")} />
      <div><Button type="submit" pending={pending}>{pending ? "Saving" : "Record parcel"}</Button></div>
    </form>
  );
}
