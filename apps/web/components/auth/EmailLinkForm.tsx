"use client";

import type { ReactNode } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import type { FormAction } from "@/lib/forms/form-state";
import { BotCheck, useBotCheck } from "./BotCheck";

type EmailLinkFormProps = Readonly<{
  action: FormAction<{ email: string }>;
  siteKey: string;
  emailLabel: string;
  submitLabel: string;
  busyLabel: string;
  /** What to say once the link has been asked for. */
  done: (email: string) => ReactNode;
}>;

/** A form that takes an address and sends it a link. Sign-up and password reset use it. */
export function EmailLinkForm({
  action,
  siteKey,
  emailLabel,
  submitLabel,
  busyLabel,
  done,
}: EmailLinkFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(action);
  const { guard, widget } = useBotCheck(state.attempt);

  if (state.result?.success) return <FormDone>{done(state.result.data.email)}</FormDone>;

  return (
    <form ref={form} action={submit} onSubmit={guard} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      <Field
        name="email"
        label={emailLabel}
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values.email}
        errors={fieldErrors("email")}
      />
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
