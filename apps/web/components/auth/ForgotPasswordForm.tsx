"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { BotCheck } from "./BotCheck";
import { useFormAction } from "./useFormAction";

export function ForgotPasswordForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { state, submit, pending, fieldErrors, formError } = useFormAction(
    requestPasswordResetAction,
  );
  // A check counts only for the attempt it was made for. A token works once.
  const [passedAttempt, setPassedAttempt] = useState<number | null>(null);
  const checked = passedAttempt === state.attempt;

  if (state.result?.success) {
    return (
      <Notice tone="ok">
        <strong className="font-semibold">Check your email.</strong> If {state.result.data.email}{" "}
        has an account, a link to choose a new password is on its way.
      </Notice>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <Notice tone="warn" role="alert">
          {formError}
        </Notice>
      ) : null}
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values.email}
        errors={fieldErrors("email")}
      />
      <BotCheck
        siteKey={siteKey}
        attempt={state.attempt}
        onPassed={setPassedAttempt}
        errors={fieldErrors(CAPTCHA_FIELD)}
      />
      <Button type="submit" pending={pending} disabled={!checked}>
        {pending ? "Sending" : "Send reset link"}
      </Button>
    </form>
  );
}
