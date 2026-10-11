"use client";

import { useId } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { respondToShareAction } from "@/lib/share/actions";
import { COMMENT_MAX, NAME_MAX } from "@/lib/share/schemas";

type ResponseFormProps = Readonly<{ token: string; siteKey: string }>;

const VOTES = [
  { value: "yes", label: "Yes, I like it" },
  { value: "not_yet", label: "Not yet" },
] as const;

/**
 * A vote, a comment or both, from someone the brand sent the link to. A name is asked; an email
 * address is not. What is typed is kept as plain text and shown as plain text.
 */
export function ResponseForm({ token, siteKey }: ResponseFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(respondToShareAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const voteId = useId();
  const commentId = useId();
  const voteErrors = fieldErrors("vote");
  const commentErrors = fieldErrors("comment");

  if (state.result?.success) {
    return (
      <FormDone>
        <strong className="font-semibold">Thank you.</strong> Your answer is saved. If you answer again from this
        browser, your new answer replaces this one.
      </FormDone>
    );
  }

  return (
    <form ref={form} action={submit} onSubmit={guard} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      <Field
        name="name"
        label="Your name"
        hint="Shown to the people who sent you this link."
        autoComplete="name"
        maxLength={NAME_MAX}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />
      <fieldset className="flex flex-col gap-2" aria-describedby={voteErrors.length > 0 ? `${voteId}-error` : undefined}>
        <legend className="text-sm font-medium text-ink">Do you like this design?</legend>
        <div className="flex flex-wrap gap-4">
          {VOTES.map((vote) => (
            <label key={vote.value} className="flex items-center gap-2 text-[15px] text-ink">
              <input
                type="radio"
                name="vote"
                value={vote.value}
                defaultChecked={state.values.vote === vote.value}
                aria-invalid={voteErrors.length > 0 || undefined}
                className="h-4 w-4"
              />
              {vote.label}
            </label>
          ))}
        </div>
        {voteErrors.length > 0 ? (
          <p id={`${voteId}-error`} className="text-sm text-warn">
            {voteErrors.join(" ")}
          </p>
        ) : null}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={commentId} className="text-sm font-medium text-ink">
          Comment (optional)
        </label>
        <textarea
          id={commentId}
          name="comment"
          rows={4}
          maxLength={COMMENT_MAX}
          defaultValue={state.values.comment}
          aria-invalid={commentErrors.length > 0 || undefined}
          aria-describedby={commentErrors.length > 0 ? `${commentId}-error` : undefined}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[15px] text-ink aria-[invalid]:border-warn"
        />
        {commentErrors.length > 0 ? (
          <p id={`${commentId}-error`} className="text-sm text-warn">
            {commentErrors.join(" ")}
          </p>
        ) : null}
      </div>
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Sending" : "Send my answer"}
      </Button>
    </form>
  );
}
