"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { delayOrderAction, moveOrderAction, setHoldAction, setStatusAction } from "@/lib/ops/actions";
import { STATUS_LABELS, canDelay, canHold, canMove, canReleaseHold, nextStatus, type OrderStatus } from "@/lib/ops/status";

type Props = Readonly<{
  orderId: string;
  status: OrderStatus;
  /** Other batches of the same factory, fabric and article. */
  batches: readonly { id: string; label: string }[];
}>;

function StatusForm({ orderId, to }: Readonly<{ orderId: string; to: Exclude<OrderStatus, "submitted" | "held" | "batched"> }>) {
  const { form, submit, pending, summary } = useFormAction(setStatusAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" pending={pending}>{pending ? "Saving" : `Mark ${STATUS_LABELS[to].toLowerCase()}`}</Button>
    </form>
  );
}

function HoldForm({ orderId, hold }: Readonly<{ orderId: string; hold: boolean }>) {
  const { form, submit, pending, summary } = useFormAction(setHoldAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="hold" value={String(hold)} />
      <Field name="note" label="Note" maxLength={300} />
      <Button type="submit" variant="secondary" pending={pending}>{hold ? "Hold this order" : "Take off hold"}</Button>
    </form>
  );
}

function MoveForm({ orderId, batches }: Readonly<{ orderId: string; batches: Props["batches"] }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(moveOrderAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField name="batchId" label="Move to batch" options={batches} placeholder="Choose a batch" errors={fieldErrors("batchId")} />
      <Button type="submit" variant="secondary" pending={pending}>Move</Button>
    </form>
  );
}

function DelayForm({ orderId }: Readonly<{ orderId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(delayOrderAction);
  return (
    <form ref={form} action={submit} noValidate className="grid gap-2 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
      <div className="sm:col-span-3">
        <FormSummary message={summary} />
        {state.result?.success === true ? <FormDone>New promised date saved.</FormDone> : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="promisedOn" label="New promised date" type="date" errors={fieldErrors("promisedOn")} />
      <Field name="reason" label="Why it is late" maxLength={300} errors={fieldErrors("reason")} />
      <Button type="submit" variant="secondary" pending={pending}>Delay</Button>
    </form>
  );
}

/** Everything ops can do to one order. Each form only shows when the order is in a state it applies to. */
export function OrderControls({ orderId, status, batches }: Props) {
  const next = nextStatus(status);
  return (
    <div className="flex flex-col gap-6">
      {next && next !== "batched" ? <StatusForm orderId={orderId} to={next as "received"} /> : null}
      {canHold(status) ? <HoldForm orderId={orderId} hold /> : null}
      {canReleaseHold(status) ? <HoldForm orderId={orderId} hold={false} /> : null}
      {canMove(status) && batches.length > 0 ? <MoveForm orderId={orderId} batches={batches} /> : null}
      {canDelay(status) ? <DelayForm orderId={orderId} /> : null}
    </div>
  );
}
