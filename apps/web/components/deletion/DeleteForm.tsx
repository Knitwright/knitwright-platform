"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { FormAction } from "@/lib/forms/form-state";
import { CONFIRM_WORD } from "@/lib/deletion/schemas";

type DeleteFormProps = Readonly<{
  action: FormAction<unknown>;
  /** Hidden values sent with the form, such as the design's id. */
  hidden?: Readonly<Record<string, string>>;
  submitLabel: string;
  busyLabel: string;
}>;

/** Asks the person to type a word before anything is deleted, since it cannot be undone. */
export function DeleteForm({ action, hidden = {}, submitLabel, busyLabel }: DeleteFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(action);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field
        name="confirm"
        label={`Type "${CONFIRM_WORD}" to confirm`}
        type="text"
        autoComplete="off"
        spellCheck={false}
        required
        defaultValue={state.values.confirm ?? ""}
        errors={fieldErrors("confirm")}
      />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          {pending ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
