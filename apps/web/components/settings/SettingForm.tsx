"use client";

import { useId } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { WEEKDAYS } from "@/lib/ops/settings";
import { saveSettingAction } from "@/lib/settings/actions";
import type { SettingView } from "@/lib/settings/view";

const DAYS = WEEKDAYS.map((label, id) => ({ id: String(id), label }));

/** One setting: its value, where it came from, and Save and Reset buttons. Errors come back in words. */
export function SettingForm({ setting }: Readonly<{ setting: SettingView }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(saveSettingAction);
  const textId = useId();
  const errors = fieldErrors("value");
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid={`setting-${setting.key}`}>
      <input type="hidden" name="key" value={setting.key} />
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Saved.</FormDone> : null}
      {setting.input === "weekday" ? (
        <SelectField name="value" label={setting.label} hint={setting.help} options={DAYS} defaultValue={setting.text} errors={errors} />
      ) : setting.input === "lines" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-sm font-medium text-ink">{setting.label}</label>
          <textarea id={textId} name="value" rows={4} defaultValue={setting.text} aria-invalid={errors.length > 0 || undefined} className={TEXT_AREA} />
          <p className="text-sm text-muted">{setting.help}</p>
          {errors.length > 0 ? <p className="text-sm text-warn">{errors.join(" ")}</p> : null}
        </div>
      ) : (
        <Field
          name="value"
          label={setting.label}
          hint={setting.help}
          type={setting.input === "time" ? "time" : setting.input === "list" ? "text" : "number"}
          defaultValue={setting.text}
          errors={errors}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="save" pending={pending}>{pending ? "Saving" : "Save"}</Button>
        <Button type="submit" name="intent" value="reset" variant="secondary" disabled={pending || !setting.isSet}>Use the Knitwright default</Button>
      </div>
    </form>
  );
}
