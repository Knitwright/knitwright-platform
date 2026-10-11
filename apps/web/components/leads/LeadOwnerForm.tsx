"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { setLeadAction } from "@/lib/leads/actions";
import { NEXT_STEP_MAX } from "@/lib/leads/admin";
import { LEAD_OWNERS, type LeadOwner } from "@/lib/leads/routing";

type Props = Readonly<{
  brandId: string;
  owner: LeadOwner | null;
  nextStep: string;
  nextStepOn: string | null;
}>;

const OWNERS = [{ id: "", label: "Unassigned" }, ...LEAD_OWNERS];

/** Who follows up a lead, and the next step with its date. Platform admins only. */
export function LeadOwnerForm({ brandId, owner, nextStep, nextStepOn }: Props) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(setLeadAction);
  const saved = state.result?.success === true;
  return (
    <form ref={form} action={submit} className="grid gap-3 sm:grid-cols-[10rem_1fr_11rem_auto] sm:items-end" noValidate>
      <div className="sm:col-span-4">
        <FormSummary message={summary} />
        {saved ? <FormDone>Saved.</FormDone> : null}
      </div>
      <input type="hidden" name="brandId" value={brandId} />
      <SelectField name="owner" label="Owner" options={OWNERS} defaultValue={owner ?? ""} errors={fieldErrors("owner")} />
      <Field
        name="nextStep"
        label="Next step"
        type="text"
        maxLength={NEXT_STEP_MAX}
        defaultValue={state.values.nextStep ?? nextStep}
        errors={fieldErrors("nextStep")}
      />
      <Field
        name="nextStepOn"
        label="By"
        type="date"
        defaultValue={state.values.nextStepOn ?? nextStepOn ?? ""}
        errors={fieldErrors("nextStepOn")}
      />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
