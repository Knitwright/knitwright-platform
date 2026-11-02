"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { issueInvoiceAction } from "@/lib/ops/invoice/actions";

type Option = Readonly<{ id: string; label: string }>;

/**
 * Issues a commercial invoice (F-O4). Nothing on the form is a figure: the HS code, the origin and the
 * preference scheme all come from rows, and what is not on file is printed on the document as a gap.
 */
export function InvoiceForm({ orderId, destinations, today }: Readonly<{ orderId: string; destinations: readonly Option[]; today: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(issueInvoiceAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {done ? (
          <FormDone>
            Invoice {done.invoiceNo} issued.
            {done.missing.length > 0 ? <span className="mt-1 block text-sm">It could not state: {done.missing.join(" ")}</span> : null}
          </FormDone>
        ) : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField
        name="destinationCountry"
        label="Country the goods are going to"
        options={destinations}
        placeholder="Choose"
        hint="Its rules give the preference scheme the invoice names, such as DCTS into the United Kingdom."
        errors={fieldErrors("destinationCountry")}
      />
      <Field name="issuedOn" label="Invoice date" type="date" defaultValue={today} errors={fieldErrors("issuedOn")} />
      <Field
        name="incoterms"
        label="Terms of delivery"
        maxLength={40}
        hint="As agreed, such as DAP. Leave it empty while none is agreed: the invoice then says none is stated."
        errors={fieldErrors("incoterms")}
      />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Issue the invoice"}
        </Button>
      </div>
    </form>
  );
}
