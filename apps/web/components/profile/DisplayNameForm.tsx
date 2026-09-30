"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { FormAction } from "@/lib/forms/form-state";
import { DISPLAY_NAME_MAX } from "@/lib/profile/name";

type DisplayNameFormProps = Readonly<{ action: FormAction<unknown>; defaultName: string }>;

/** Asks for the name shown as "Made by" in tech packs. Empty means the email address is shown. */
export function DisplayNameForm({ action, defaultName }: DisplayNameFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(action);
  const saved = state.result?.success === true;

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {saved ? <FormDone>The name is saved.</FormDone> : null}
      <Field
        name="name"
        label="Your name"
        hint="Shown as who made each version in your brands' tech packs. Leave it empty to show your email address."
        type="text"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX}
        defaultValue={state.values.name ?? defaultName}
        errors={fieldErrors("name")}
      />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Save name"}
        </Button>
      </div>
    </form>
  );
}
