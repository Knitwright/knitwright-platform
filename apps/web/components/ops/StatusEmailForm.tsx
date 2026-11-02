"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { EMAIL_KIND_LABELS, EMAIL_KINDS } from "@/lib/ops/notify/email";
import { sendStatusEmailAction } from "@/lib/ops/notify/actions";

const KINDS = EMAIL_KINDS.map((id) => ({ id, label: EMAIL_KIND_LABELS[id] }));

/**
 * Tells a customer where their order is (F-O4). The words are written from the order, so nobody can type a
 * date into them. Where no email provider is set up nothing is sent and the words are shown to send by hand.
 */
export function StatusEmailForm({ orderId, suggested, isSetUp }: Readonly<{ orderId: string; suggested: string; isSetUp: boolean }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(sendStatusEmailAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {!isSetUp ? (
          <p className="text-sm text-muted" data-testid="email-not-set-up">
            No email provider is set up on this deploy, so nothing is sent. The words are shown below for you to send yourself, and the
            record keeps them either way.
          </p>
        ) : null}
        {done ? (
          <FormDone>
            {done.sent ? "Sent." : done.reason}
            <span className="mt-2 block font-medium">{done.subject}</span>
            <span className="mt-1 block whitespace-pre-wrap text-sm" data-testid="email-body">
              {done.body}
            </span>
          </FormDone>
        ) : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField name="kind" label="What the message is about" options={KINDS} defaultValue={suggested} errors={fieldErrors("kind")} />
      <Field name="toEmail" label="Customer's email address" type="email" maxLength={320} errors={fieldErrors("toEmail")} />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : isSetUp ? "Send the message" : "Write the message"}
        </Button>
      </div>
    </form>
  );
}
