"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { requestPatternAction } from "@/lib/pattern-service/actions";

/** The one button of the pattern service screen. The price and what is sent are shown beside it, before it is pressed. */
export function RequestPatternForm({ projectId, label }: Readonly<{ projectId: string; label: string }>) {
  const { form, state, submit, pending, summary } = useFormAction(requestPatternAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Sent to the Sialkot team.</FormDone> : null}
      <input type="hidden" name="projectId" value={projectId} />
      <div><Button type="submit" pending={pending}>{label}</Button></div>
    </form>
  );
}
