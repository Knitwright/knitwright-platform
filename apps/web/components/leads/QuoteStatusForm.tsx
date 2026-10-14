"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { setQuoteStatusAction } from "@/lib/leads/actions";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/leads/quote-terms";

/** Changes a quote request's status. Platform admins only. */
export function QuoteStatusForm({ quoteId, status }: Readonly<{ quoteId: string; status: QuoteStatus }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(setQuoteStatusAction);
  return (
    <form ref={form} action={submit} className="flex flex-wrap items-end gap-2" noValidate>
      <FormSummary message={summary} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <SelectField name="status" label="Status" options={QUOTE_STATUSES} defaultValue={status} errors={fieldErrors("status")} />
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? "Saving" : "Set status"}
      </Button>
    </form>
  );
}
