"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { MARKETING_FIELD } from "@/lib/consent/schemas";
import { MARKETING_OPT_IN } from "@/lib/consent/wording";
import type { FormAction } from "@/lib/forms/form-state";

type MarketingFormProps = Readonly<{ action: FormAction<{ granted: boolean }>; granted: boolean }>;

/** The marketing email box in Settings. Saving records the new choice with the words shown. */
export function MarketingForm({ action, granted }: MarketingFormProps) {
  const { form, state, submit, pending, summary } = useFormAction(action);
  const saved = state.result?.success ? state.result.data.granted : null;
  const ticked = saved ?? granted;

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {saved === null ? null : (
        <FormDone>{saved ? "Saved. We may email you about these." : "Saved. We will not email you about these."}</FormDone>
      )}
      <CheckboxField key={String(ticked)} name={MARKETING_FIELD} value="yes" defaultChecked={ticked} label={MARKETING_OPT_IN.text} />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Save email choice"}
        </Button>
      </div>
    </form>
  );
}
