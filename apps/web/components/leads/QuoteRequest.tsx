"use client";

import { TEXT_AREA } from "@/components/ui/field-styles";
import { useId, useState } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { requestQuoteAction } from "@/lib/leads/actions";
import { MESSAGE_MAX, QUANTITY_MAX, SIZES_NOTE_MAX, describeQuote, type QuoteStatus } from "@/lib/leads/quote-terms";

type Earlier = Readonly<{ id: string; quantity: number; neededBy: string; status: QuoteStatus }>;

type Props = Readonly<{
  projectId: string;
  version: number;
  /** Tomorrow, the first date the form accepts. */
  firstDate: string;
  earlier: readonly Earlier[];
}>;

/**
 * "Request a quote" on a design (decision 0024). A short form; the Knitwright team replies by
 * email. There are no prices in the platform yet.
 */
export function QuoteRequest({ projectId, version, firstDate, earlier }: Props) {
  const [open, setOpen] = useState(false);
  const { form, state, onSubmit, pending, sent, summary, fieldErrors } = useSendForm(requestQuoteAction);
  const kept = (name: string): string => state.values[name] ?? "";

  return (
    <section aria-labelledby="quote-request" className="rounded-2xl border border-hairline bg-surface p-6" data-testid="quote-request">
      <h2 id="quote-request" className="text-base font-semibold text-ink">
        Get this made
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Tell us how many you need and by when. The Knitwright team will reply with a quote by email.
      </p>
      {earlier.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-2">
          {earlier.map((quote) => (
            <li key={quote.id}>Asked: {describeQuote(quote)}</li>
          ))}
        </ul>
      ) : null}
      {sent ? (
        <div className="mt-4">
          <FormDone>Thank you. Your request is sent. The Knitwright team will reply by email.</FormDone>
        </div>
      ) : null}
      {open && !sent ? (
        <form ref={form} onSubmit={(event) => void onSubmit(event)} className="mt-4 flex flex-col gap-4" noValidate>
          <FormSummary message={summary} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="version" value={version} />
          <Field
            name="quantity"
            label="How many pieces?"
            type="number"
            inputMode="numeric"
            min={1}
            max={QUANTITY_MAX}
            step={1}
            required
            defaultValue={kept("quantity")}
            errors={fieldErrors("quantity")}
          />
          <Field
            name="neededBy"
            label="Needed by"
            type="date"
            min={firstDate}
            required
            defaultValue={kept("neededBy")}
            errors={fieldErrors("neededBy")}
          />
          <TextArea
            name="sizesNote"
            label="Sizes"
            hint="Optional. For example: 10 small, 20 medium, 15 large."
            max={SIZES_NOTE_MAX}
            defaultValue={kept("sizesNote")}
            errors={fieldErrors("sizesNote")}
          />
          <TextArea
            name="message"
            label="Anything else?"
            hint="Optional."
            max={MESSAGE_MAX}
            defaultValue={kept("message")}
            errors={fieldErrors("message")}
          />
          <div>
            <Button type="submit" pending={pending}>
              {pending ? "Sending" : "Send request"}
            </Button>
          </div>
        </form>
      ) : null}
      {!open && !sent ? (
        <div className="mt-4">
          <Button type="button" onClick={() => setOpen(true)}>
            Request a quote
          </Button>
        </div>
      ) : null}
    </section>
  );
}

type TextAreaProps = Readonly<{
  name: string;
  label: string;
  hint: string;
  max: number;
  defaultValue: string;
  errors: readonly string[];
}>;

function TextArea({ name, label, hint, max, defaultValue, errors }: TextAreaProps) {
  const id = useId();
  const describedBy = [`${id}-hint`, errors.length > 0 ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        maxLength={max}
        defaultValue={defaultValue}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy}
        className={TEXT_AREA}
      />
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
      {errors.length > 0 ? (
        <p id={`${id}-error`} className="text-sm text-warn">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
