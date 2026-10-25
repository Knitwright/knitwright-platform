"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { PAYOUT_LABELS, PAYOUT_STATES, RIGHTS_STATEMENT, type PayoutState } from "@/lib/designers/copy";
import { acceptSubmissionAction, enrolAction, newSubmissionAction, payoutStateAction, rejectSubmissionAction, sendSubmissionAction } from "@/lib/designers/actions";

export function EnrolForm() {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(enrolAction);
  return (
    <form ref={form} action={submit} noValidate className="flex max-w-md flex-col gap-3">
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>You are a designer now.</FormDone> : null}
      <Field name="displayName" label="Name to show on your templates" hint="Shown to everyone who sees a template of yours." errors={fieldErrors("displayName")} />
      <Button type="submit" pending={pending}>{pending ? "Saving" : "Become a designer"}</Button>
    </form>
  );
}

type Choice = Readonly<{ id: string; label: string }>;
export type SubmissionChoices = Readonly<{ designs: readonly Choice[]; sports: readonly Choice[]; styles: readonly Choice[]; colours: readonly Choice[] }>;

/** The lists come from the page, so this client component does not pull the template catalogue (and zod) into the browser. */
export function NewSubmissionForm({ designs, sports, styles, colours }: SubmissionChoices) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(newSubmissionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex max-w-md flex-col gap-3">
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Saved as a draft. Send it for review from your designer page.</FormDone> : null}
      <SelectField name="projectId" label="Design to offer" hint="The newest saved version is the one offered." options={designs} placeholder="Choose a design" errors={fieldErrors("projectId")} />
      <Field name="title" label="Template title" errors={fieldErrors("title")} />
      <SelectField name="sport" label="Sport" options={sports} placeholder="Choose a sport" errors={fieldErrors("sport")} />
      <SelectField name="style" label="Style" options={styles} placeholder="Choose a style" errors={fieldErrors("style")} />
      <SelectField name="colourFamily" label="Main colour" options={colours} placeholder="Choose the main colour" errors={fieldErrors("colourFamily")} />
      <Button type="submit" pending={pending}>{pending ? "Saving" : "Save as a draft"}</Button>
    </form>
  );
}

export function SendSubmissionForm({ submissionId, title }: Readonly<{ submissionId: string; title: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(sendSubmissionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid={`send-${submissionId}`}>
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Sent for review.</FormDone> : null}
      <input type="hidden" name="submissionId" value={submissionId} />
      <CheckboxField name="rightsAttested" label={RIGHTS_STATEMENT} errors={fieldErrors("rightsAttested")} />
      <Button type="submit" pending={pending} aria-label={`Send for review: ${title}`}>{pending ? "Sending" : "Send for review"}</Button>
    </form>
  );
}

function AcceptForm({ submissionId, title }: Readonly<{ submissionId: string; title: string }>) {
  const { form, state, submit, pending, summary } = useFormAction(acceptSubmissionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2">
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Added to the library.</FormDone> : null}
      <input type="hidden" name="submissionId" value={submissionId} />
      <Button type="submit" pending={pending} aria-label={`Accept: ${title}`}>{pending ? "Adding" : "Accept into the library"}</Button>
    </form>
  );
}

function RejectForm({ submissionId, title }: Readonly<{ submissionId: string; title: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(rejectSubmissionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2">
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Rejected.</FormDone> : null}
      <input type="hidden" name="submissionId" value={submissionId} />
      <Field name="reason" label={`Reason for rejecting ${title}`} errors={fieldErrors("reason")} />
      <Button type="submit" variant="secondary" pending={pending} aria-label={`Reject: ${title}`}>{pending ? "Rejecting" : "Reject"}</Button>
    </form>
  );
}

export function ReviewForm(props: Readonly<{ submissionId: string; title: string }>) {
  return (
    <div className="flex flex-col gap-4">
      <AcceptForm {...props} />
      <RejectForm {...props} />
    </div>
  );
}

export function PayoutStateForm({ designerId, name, current }: Readonly<{ designerId: string; name: string; current: PayoutState }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(payoutStateAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2" data-testid={`payout-${designerId}`}>
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Saved.</FormDone> : null}
      <input type="hidden" name="designerId" value={designerId} />
      <SelectField name="state" label={`Payout state for ${name}`} defaultValue={current} options={PAYOUT_STATES.map((id) => ({ id, label: PAYOUT_LABELS[id] }))} errors={fieldErrors("state")} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Note
        <textarea name="note" rows={2} className={TEXT_AREA} />
      </label>
      <Button type="submit" variant="secondary" pending={pending}>{pending ? "Saving" : "Save payout state"}</Button>
    </form>
  );
}
