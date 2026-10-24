"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { saveSettingsAction } from "@/lib/ops/actions";
import { WEEKDAYS, type OpsSettings } from "@/lib/ops/settings";

const DAYS = WEEKDAYS.map((label, id) => ({ id: String(id), label }));
const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The weekly cut-off and the lead time. Leave the lead time empty while none has been agreed. */
export function SettingsForm({ settings }: Readonly<{ settings: OpsSettings }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(saveSettingsAction);
  return (
    <form ref={form} action={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormSummary message={summary} />
        {state.result?.success === true ? <FormDone>Saved.</FormDone> : null}
      </div>
      <SelectField name="weekday" label="Cut-off day" options={DAYS} defaultValue={String(settings.cutoffWeekday)} errors={fieldErrors("weekday")} />
      <Field name="time" label="Cut-off time (UTC)" type="time" defaultValue={clock(settings.cutoffMinutes)} errors={fieldErrors("time")} />
      <Field name="leadTimeDays" label="Lead time in days" type="number" min={0} max={365} defaultValue={settings.leadTimeDays ?? ""} hint="Leave empty while no factory has agreed one. No due date is promised until it is set." errors={fieldErrors("leadTimeDays")} />
      <Field name="label" label="Where these settings come from" defaultValue={settings.label} maxLength={120} errors={fieldErrors("label")} />
      <div className="sm:col-span-2">
        <Button type="submit" pending={pending}>{pending ? "Saving" : "Save settings"}</Button>
      </div>
    </form>
  );
}
