"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { confirmRuleAction } from "@/lib/rulebook/actions";

/**
 * Records that the factory has confirmed one draft version of a rule. The words of the version do not change.
 * Owner decision 14: the name and role of the factory person who reviewed it are part of the record, so a rule
 * confirmed by nobody in particular cannot be saved; the rule then reads "Reviewed by NAME, ROLE, on DATE".
 */
export function ConfirmRule({ ruleId, version }: Readonly<{ ruleId: string; version: number }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(confirmRuleAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid={`confirm-${ruleId}`}>
      <FormSummary message={summary} />
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="version" value={version} />
      <Field
        name="confirmedName"
        label="Reviewed by"
        hint="The factory person who read this version, in their own name."
        errors={fieldErrors("confirmedName")}
      />
      <Field name="confirmedRole" label="Their role" hint="For example pattern master." errors={fieldErrors("confirmedRole")} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>{pending ? "Saving" : `The factory confirmed version ${version}`}</Button>
      </div>
    </form>
  );
}
