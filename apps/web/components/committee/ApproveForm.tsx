"use client";

import { useId } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { committeeApproveAction } from "@/lib/share/committee/actions";
import { APPROVAL_RECORDED, EMAIL_MAX, NAME_MAX } from "@/lib/share/committee/fields";
import type { CommitteeOption } from "@/lib/share/committee/public-view";

type ApproveFormProps = Readonly<{ token: string; options: readonly CommitteeOption[]; siteKey: string }>;

/**
 * Approve, with a name (spec F-T3 "press Approve with their name"; the acceptance test is that the
 * approval is recorded with name, timestamp and version). The version is chosen here, because an
 * approval that does not say which option it was for records nothing useful.
 */
export function ApproveForm({ token, options, siteKey }: ApproveFormProps) {
  const { form, state, onSubmit, pending, sent, summary, fieldErrors } = useSendForm(committeeApproveAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const groupId = useId();
  const versionErrors = fieldErrors("version");
  const only = options.length === 1 ? options[0] : undefined;

  if (sent) {
    return (
      <FormDone>
        <strong className="font-semibold">Thank you.</strong> {APPROVAL_RECORDED}
      </FormDone>
    );
  }

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        guard(event);
        void onSubmit(event);
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      {only ? (
        <input type="hidden" name="version" value={only.version} />
      ) : (
        <fieldset className="flex flex-col gap-2" aria-describedby={versionErrors.length > 0 ? `${groupId}-error` : undefined}>
          <legend className="text-sm font-medium text-ink">Which one are you approving?</legend>
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <label
                key={option.slot}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-3 text-[15px] text-ink has-[:checked]:border-cobalt-soft"
              >
                <input
                  type="radio"
                  name="version"
                  value={option.version}
                  defaultChecked={state.values.version === String(option.version)}
                  aria-invalid={versionErrors.length > 0 || undefined}
                  className="size-4"
                />
                {option.label} · version {option.version}
              </label>
            ))}
          </div>
          {versionErrors.length > 0 ? (
            <p id={`${groupId}-error`} className="text-sm text-warn">
              {versionErrors.join(" ")}
            </p>
          ) : null}
        </fieldset>
      )}
      <Field
        name="name"
        label="Your name"
        hint="Recorded with your approval, along with the time and the option."
        autoComplete="name"
        maxLength={NAME_MAX}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />
      <Field
        name="email"
        type="email"
        inputMode="email"
        label="Your email (optional)"
        hint="Only so the club can reach you about this kit. Leave it empty if you would rather not."
        autoComplete="email"
        maxLength={EMAIL_MAX}
        defaultValue={state.values.email}
        errors={fieldErrors("email")}
      />
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Recording" : "Approve"}
      </Button>
    </form>
  );
}
