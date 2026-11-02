"use client";

import { useId } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { committeeVoteAction } from "@/lib/share/committee/actions";
import { NAME_MAX } from "@/lib/share/committee/fields";
import type { CommitteeOption } from "@/lib/share/committee/public-view";

type VoteFormProps = Readonly<{ token: string; options: readonly CommitteeOption[]; siteKey: string }>;

/**
 * The A/B/C vote (spec F-T3). One vote per browser, which that browser may change, so the words
 * say what the vote is worth and never call the tally a decision.
 */
export function VoteForm({ token, options, siteKey }: VoteFormProps) {
  const { form, state, onSubmit, pending, sent, summary, fieldErrors } = useSendForm(committeeVoteAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const groupId = useId();
  const slotErrors = fieldErrors("slot");

  if (sent) {
    return (
      <FormDone>
        <strong className="font-semibold">Your vote is in.</strong> Vote again from this browser and your new vote replaces
        this one.
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
      <fieldset className="flex flex-col gap-2" aria-describedby={slotErrors.length > 0 ? `${groupId}-error` : undefined}>
        <legend className="text-sm font-medium text-ink">Which one do you prefer?</legend>
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <label
              key={option.slot}
              className="flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-3 text-[15px] text-ink has-[:checked]:border-cobalt-soft"
            >
              <input
                type="radio"
                name="slot"
                value={option.slot}
                defaultChecked={state.values.slot === option.slot}
                aria-invalid={slotErrors.length > 0 || undefined}
                className="size-4"
              />
              {option.label} · version {option.version}
            </label>
          ))}
        </div>
        {slotErrors.length > 0 ? (
          <p id={`${groupId}-error`} className="text-sm text-warn">
            {slotErrors.join(" ")}
          </p>
        ) : null}
      </fieldset>
      <Field
        name="name"
        label="Your name"
        hint="Shown to the club beside your vote."
        autoComplete="name"
        maxLength={NAME_MAX}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Sending" : "Send my vote"}
      </Button>
    </form>
  );
}
