"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { makeBagsAction, packBagAction, setCartonAction } from "@/lib/ops/packing/actions";

export function MakeBagsForm({ orderId, hasBags }: Readonly<{ orderId: string; hasBags: boolean }>) {
  const { form, state, submit, pending, summary } = useFormAction(makeBagsAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-center gap-3">
      <FormSummary message={summary} />
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="secondary" pending={pending}>{hasBags ? "Make the bags again" : "Make the bags"}</Button>
      {state.result?.success === true ? <FormDone>{state.result.data.bags} bags made.</FormDone> : null}
    </form>
  );
}

/** A carton's weight and size are what ops typed in. Leave a box empty and it stays "not set". */
export function CartonForm({ orderId }: Readonly<{ orderId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(setCartonAction);
  return (
    <form ref={form} action={submit} noValidate className="grid max-w-2xl gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3">
        <FormSummary message={summary} />
        {state.result?.success === true ? <FormDone>Carton {state.result.data.cartonNo} saved.</FormDone> : null}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      <Field name="cartonNo" label="Carton number" type="number" inputMode="numeric" min={1} errors={fieldErrors("cartonNo")} />
      <Field name="weightG" label="Weight (grams)" type="number" inputMode="numeric" min={1} errors={fieldErrors("weightG")} />
      <span />
      <Field name="lengthMm" label="Length (mm)" type="number" inputMode="numeric" min={1} errors={fieldErrors("lengthMm")} />
      <Field name="widthMm" label="Width (mm)" type="number" inputMode="numeric" min={1} errors={fieldErrors("widthMm")} />
      <Field name="heightMm" label="Height (mm)" type="number" inputMode="numeric" min={1} errors={fieldErrors("heightMm")} />
      <div><Button type="submit" variant="secondary" pending={pending}>Save carton</Button></div>
    </form>
  );
}

export function PackBagForm({ orderId, bagId, bagNo }: Readonly<{ orderId: string; bagId: string; bagNo: number }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(packBagAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="bagId" value={bagId} />
      <Field name="cartonNo" label={`Carton for bag ${bagNo}`} type="number" inputMode="numeric" min={1} errors={fieldErrors("cartonNo")} />
      <Button type="submit" variant="secondary" pending={pending}>{`Pack bag ${bagNo}`}</Button>
    </form>
  );
}
