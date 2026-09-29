"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { BRAND_NAME_MAX } from "@/lib/brands/limits";
import type { FormAction } from "@/lib/forms/form-state";

type BrandNameFormProps = Readonly<{
  action: FormAction<unknown>;
  label: string;
  hint?: string;
  defaultName?: string;
  submitLabel: string;
  busyLabel: string;
  /** Said once the action has succeeded, when it does not lead to another page. */
  doneMessage?: string;
}>;

/** Asks for a brand name. Used to create a brand and to rename one. */
export function BrandNameForm({
  action,
  label,
  hint,
  defaultName,
  submitLabel,
  busyLabel,
  doneMessage,
}: BrandNameFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(action);
  const saved = state.result?.success === true && doneMessage;

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {saved ? <FormDone>{doneMessage}</FormDone> : null}
      <Field
        name="name"
        label={label}
        hint={hint}
        type="text"
        autoComplete="organization"
        required
        maxLength={BRAND_NAME_MAX}
        defaultValue={state.values.name ?? defaultName}
        errors={fieldErrors("name")}
      />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
