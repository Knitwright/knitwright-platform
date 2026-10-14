"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updatePasswordAction } from "@/lib/auth/actions";
import { PASSWORD_MIN } from "@/lib/auth/fields";

export function ResetPasswordForm() {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(updatePasswordAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters. A few unrelated words work well.`}
        errors={fieldErrors("password")}
      />
      <Button type="submit" pending={pending}>
        {pending ? "Saving" : "Save password"}
      </Button>
    </form>
  );
}
