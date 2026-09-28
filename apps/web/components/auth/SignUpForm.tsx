"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { signUpAction } from "@/lib/auth/actions";
import { CAPTCHA_FIELD, PASSWORD_MIN } from "@/lib/auth/schemas";
import { BotCheck } from "./BotCheck";
import { useFormAction } from "./useFormAction";

export function SignUpForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { state, submit, pending, fieldErrors, formError } = useFormAction(signUpAction);
  // A check counts only for the attempt it was made for. A token works once.
  const [passedAttempt, setPassedAttempt] = useState<number | null>(null);
  const checked = passedAttempt === state.attempt;

  if (state.result?.success) {
    return (
      <Notice tone="ok">
        <strong className="font-semibold">Check your email.</strong> We sent a link to{" "}
        {state.result.data.email}. Open it to confirm your address. If you already have an
        account, sign in instead.
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
        label="Work email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values.email}
        errors={fieldErrors("email")}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters. A few unrelated words work well.`}
        errors={fieldErrors("password")}
      />
      <BotCheck
        siteKey={siteKey}
        attempt={state.attempt}
        onPassed={setPassedAttempt}
        errors={fieldErrors(CAPTCHA_FIELD)}
      />
      <Button type="submit" pending={pending} disabled={!checked}>
        {pending ? "Creating your account" : "Create account"}
      </Button>
    </form>
  );
}
