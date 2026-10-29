"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { confirmRuleAction } from "@/lib/rulebook/actions";

/** Records that the factory has confirmed one draft version of a rule. The words of the version do not change. */
export function ConfirmRule({ ruleId, version }: Readonly<{ ruleId: string; version: number }>) {
  const { form, submit, pending, summary } = useFormAction(confirmRuleAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="version" value={version} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>{pending ? "Saving" : `The factory confirmed version ${version}`}</Button>
      </div>
    </form>
  );
}
