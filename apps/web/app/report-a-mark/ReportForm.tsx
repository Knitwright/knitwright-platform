"use client";

import { useId } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { reportMarkAction } from "@/lib/moderation/actions";

const LIMITS = { name: 200, holder: 200, mark: 200, location: 500, details: 2000 } as const;

/** The rights-holder report. Needs no account; the bot check guards it. */
export function ReportForm({ siteKey }: Readonly<{ siteKey: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(reportMarkAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const detailsId = useId();
  const goodFaithErrors = fieldErrors("goodFaith");

  if (state.result?.success) {
    return (
      <FormDone>
        <strong className="font-semibold">Thank you.</strong> We have your report. A person will look at it and reply to {state.result.data.email}.
      </FormDone>
    );
  }

  return (
    <form ref={form} action={submit} onSubmit={guard} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      <Field name="reporterName" label="Your name" autoComplete="name" maxLength={LIMITS.name} required defaultValue={state.values.reporterName} errors={fieldErrors("reporterName")} />
      <Field name="reporterEmail" label="Email" type="email" autoComplete="email" required defaultValue={state.values.reporterEmail} errors={fieldErrors("reporterEmail")} />
      <Field name="holder" label="Who owns the mark or work" maxLength={LIMITS.holder} required defaultValue={state.values.holder} errors={fieldErrors("holder")} />
      <Field name="mark" label="The mark or work" hint="For example: our club crest, or the brand name." maxLength={LIMITS.mark} required defaultValue={state.values.mark} errors={fieldErrors("mark")} />
      <Field name="location" label="Where you saw it" hint="A link or a product name." maxLength={LIMITS.location} required defaultValue={state.values.location} errors={fieldErrors("location")} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={detailsId} className="text-sm font-medium text-ink">Anything else we should know</label>
        <textarea id={detailsId} name="details" rows={3} maxLength={LIMITS.details} defaultValue={state.values.details} className={TEXT_AREA} />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="goodFaith" value="yes" className="mt-1" aria-invalid={goodFaithErrors.length > 0 || undefined} />
        I own this mark or work, or act for its owner, and this report is accurate to the best of my knowledge.
      </label>
      {goodFaithErrors.length > 0 ? <p className="text-sm text-warn">{goodFaithErrors.join(" ")}</p> : null}
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <div>
        <Button type="submit" pending={pending}>{pending ? "Sending" : "Send the report"}</Button>
      </div>
    </form>
  );
}
