"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { cutBatchesAction } from "@/lib/ops/actions";

/** Puts every waiting order whose cut-off has come into its batch. */
export function CutBatchesForm() {
  const { form, state, submit, pending, summary } = useFormAction(cutBatchesAction);
  const done = state.result?.success === true ? state.result.data.batched : null;
  return (
    <form ref={form} action={submit} className="flex flex-wrap items-center gap-3" noValidate>
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? "Cutting" : "Cut batches now"}
      </Button>
      <FormSummary message={summary} />
      {done !== null ? <FormDone>{done === 0 ? "No order was waiting past its cut-off." : `${done} ${done === 1 ? "order" : "orders"} put into batches.`}</FormDone> : null}
    </form>
  );
}
