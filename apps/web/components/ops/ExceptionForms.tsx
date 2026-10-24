"use client";

import { TextAreaField } from "@/components/ops/TextAreaField";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { raiseExceptionAction, resolveExceptionAction, updateExceptionAction } from "@/lib/ops/exceptions/actions";
import { EXCEPTION_KINDS, EXCEPTION_LABELS } from "@/lib/ops/exceptions/rules";

const KINDS = EXCEPTION_KINDS.map((id) => ({ id, label: EXCEPTION_LABELS[id] }));

/** Raises an exception on an order. Every exception has an owner and a due date. Do not put a player's name in the note. */
export function RaiseExceptionForm({ orderId }: Readonly<{ orderId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(raiseExceptionAction);
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {state.result?.success === true ? <FormDone>Exception raised.</FormDone> : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField name="kind" label="What happened" options={KINDS} placeholder="Choose" errors={fieldErrors("kind")} />
      <Field name="owner" label="Owner" maxLength={80} errors={fieldErrors("owner")} />
      <Field name="dueOn" label="Due date" type="date" errors={fieldErrors("dueOn")} />
      <TextAreaField name="sizes" label="Pieces to make again, by size" rows={2} hint="For a remake only, such as M 2, L 1." errors={fieldErrors("sizes")} />
      <div className="sm:col-span-2"><Field name="note" label="Note" maxLength={300} hint="Do not put a player's name here." errors={fieldErrors("note")} /></div>
      <div><Button type="submit" variant="secondary" pending={pending}>Raise exception</Button></div>
    </form>
  );
}

type ExceptionProps = Readonly<{ exceptionId: string; orderId: string; owner: string; dueOn: string }>;

function UpdateForm({ exceptionId, orderId, owner, dueOn }: ExceptionProps) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(updateExceptionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="owner" label="Owner" defaultValue={owner} maxLength={80} errors={fieldErrors("owner")} />
      <Field name="dueOn" label="Due date" type="date" defaultValue={dueOn} errors={fieldErrors("dueOn")} />
      <Button type="submit" variant="secondary" pending={pending}>Change owner or date</Button>
    </form>
  );
}

function ResolveForm({ exceptionId, orderId }: Pick<ExceptionProps, "exceptionId" | "orderId">) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(resolveExceptionAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="resolution" label="How it was resolved" maxLength={300} errors={fieldErrors("resolution")} />
      <Button type="submit" variant="secondary" pending={pending}>Resolve</Button>
    </form>
  );
}

/** Changes who owns an open exception and when it is due, or resolves it. */
export function ExceptionControls(props: ExceptionProps) {
  return (
    <div className="mt-2 flex flex-col gap-3">
      <UpdateForm {...props} />
      <ResolveForm exceptionId={props.exceptionId} orderId={props.orderId} />
    </div>
  );
}
