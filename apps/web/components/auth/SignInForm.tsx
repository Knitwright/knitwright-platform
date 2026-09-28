"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { signInAction } from "@/lib/auth/actions";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { BotCheck } from "./BotCheck";
import { useFormAction } from "./useFormAction";

export function SignInForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { state, submit, pending, fieldErrors, formError } = useFormAction(signInAction);
  // A check counts only for the attempt it was made for. A token works once.
  const [passedAttempt, setPassedAttempt] = useState<number | null>(null);
  const checked = passedAttempt === state.attempt;

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
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={fieldErrors("password")}
      />
      <BotCheck
        siteKey={siteKey}
        attempt={state.attempt}
        onPassed={setPassedAttempt}
        errors={fieldErrors(CAPTCHA_FIELD)}
      />
      <Button type="submit" pending={pending} disabled={!checked}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
