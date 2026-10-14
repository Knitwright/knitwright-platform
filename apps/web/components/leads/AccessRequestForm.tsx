"use client";

import { TEXT_AREA } from "@/components/ui/field-styles";
import { useId } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { ACCESS_MESSAGE_MAX, ACCESS_NAME_MAX, ACCESS_ORGANISATION_MAX } from "@/lib/leads/access";
import { requestAccessAction } from "@/lib/leads/actions";
import { ORGANISATION_TYPES } from "@/lib/leads/organisation";

/** Asks for access while sign-up is by invitation. Needs no account; the bot check guards it. */
export function AccessRequestForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(requestAccessAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const messageId = useId();
  const messageErrors = fieldErrors("message");

  if (state.result?.success) {
    return (
      <FormDone>
        <strong className="font-semibold">Thank you.</strong> We have your request. The Knitwright team will email{" "}
        {state.result.data.email} when there is a place for you.
      </FormDone>
    );
  }

  return (
    <form ref={form} action={submit} onSubmit={guard} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      <Field
        name="name"
        label="Your name"
        autoComplete="name"
        maxLength={ACCESS_NAME_MAX}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />
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
        name="organisation"
        label="Club, school or brand"
        hint="Optional."
        autoComplete="organization"
        maxLength={ACCESS_ORGANISATION_MAX}
        defaultValue={state.values.organisation}
        errors={fieldErrors("organisation")}
      />
      <SelectField
        key={`type-${state.attempt}`}
        name="organisationType"
        label="Type of organisation"
        hint="Optional."
        options={ORGANISATION_TYPES}
        placeholder="Choose a type"
        defaultValue={state.values.organisationType ?? ""}
        errors={fieldErrors("organisationType")}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className="text-sm font-medium text-ink">
          What would you like to make?
        </label>
        <textarea
          id={messageId}
          name="message"
          rows={3}
          maxLength={ACCESS_MESSAGE_MAX}
          defaultValue={state.values.message}
          aria-invalid={messageErrors.length > 0 || undefined}
          aria-describedby={`${messageId}-hint${messageErrors.length > 0 ? ` ${messageId}-error` : ""}`}
          className={TEXT_AREA}
        />
        <p id={`${messageId}-hint`} className="text-sm text-muted">
          Optional. For example: 40 training tops for our under 12s by March.
        </p>
        {messageErrors.length > 0 ? (
          <p id={`${messageId}-error`} className="text-sm text-warn">
            {messageErrors.join(" ")}
          </p>
        ) : null}
      </div>
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Sending" : "Request access"}
        </Button>
      </div>
    </form>
  );
}
