"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { saveBrandDetailsAction } from "@/lib/leads/actions";
import type { OrganisationDetails } from "@/lib/leads/organisation";
import { OrganisationFields } from "./OrganisationFields";

type Props = Readonly<{
  details: OrganisationDetails;
  submitLabel: string;
  doneMessage: string;
}>;

/** Changes the organisation details of the brand the user is working in. */
export function OrganisationForm({ details, submitLabel, doneMessage }: Props) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(saveBrandDetailsAction);
  const saved = state.result?.success === true;
  const kept = (name: keyof OrganisationDetails): string => state.values[name] ?? details[name] ?? "";

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {saved ? <FormDone>{doneMessage}</FormDone> : null}
      <OrganisationFields
        values={{ organisationType: kept("organisationType"), country: kept("country"), region: kept("region") }}
        errors={fieldErrors}
      />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
