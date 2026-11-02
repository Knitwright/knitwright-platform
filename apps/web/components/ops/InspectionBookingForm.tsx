"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { bookInspectionAction } from "@/lib/ops/inspection/actions";

/**
 * Asks for a third-party inspection of a run (F-O3). No inspection house is called: the reference comes back
 * for ops to quote when they book one by hand, and what the provider said is kept either way.
 */
export function InspectionBookingForm({ orderId, place, today }: Readonly<{ orderId: string; place: string; today: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(bookInspectionAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {done ? (
          <FormDone>
            Reference {done.reference}. {done.outcome}
          </FormDone>
        ) : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="requestedOn" label="Day you asked" type="date" defaultValue={today} errors={fieldErrors("requestedOn")} />
      <Field name="place" label="Where the goods are" maxLength={120} defaultValue={place} errors={fieldErrors("place")} />
      <div className="sm:col-span-2">
        <Field name="note" label="Note" maxLength={300} errors={fieldErrors("note")} />
      </div>
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Ask for an inspection"}
        </Button>
      </div>
    </form>
  );
}
