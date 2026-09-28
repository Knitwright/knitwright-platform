"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { signInAction } from "@/lib/auth/actions";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { BotCheck, useBotCheck } from "./BotCheck";

export function SignInForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(signInAction);
  const { guard, widget } = useBotCheck(state.attempt);

  return (
    <form ref={form} action={submit} onSubmit={guard} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
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
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
