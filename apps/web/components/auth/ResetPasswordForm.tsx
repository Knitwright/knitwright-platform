"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { updatePasswordAction } from "@/lib/auth/actions";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import { useFormAction } from "./useFormAction";

export function ResetPasswordForm() {
  const { submit, pending, fieldErrors, formError } = useFormAction(updatePasswordAction);

  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <Notice tone="warn" role="alert">
          {formError}
        </Notice>
      ) : null}
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters.`}
        errors={fieldErrors("password")}
      />
      <Button type="submit" pending={pending}>
        {pending ? "Saving" : "Save new password"}
      </Button>
    </form>
  );
}
