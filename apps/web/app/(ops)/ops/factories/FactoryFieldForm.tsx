"use client";

import { useId } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { addPriceTierAction, saveFactoryFieldAction } from "@/lib/factory/actions";
import type { FieldView } from "@/lib/factory/view";

const YES_NO = [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }];
const YES_NO_UNKNOWN = [{ id: "", label: "Not known" }, ...YES_NO];
const MULTI_LINE = new Set(["certifications", "dutyLines", "json"]);

function Control({ field, errors }: Readonly<{ field: FieldView; errors: readonly string[] }>) {
  const textId = useId();
  if (field.kind === "choice" || field.kind === "boolean" || field.kind === "optionalBoolean") {
    const options = field.kind === "choice" ? field.choices.map((c) => ({ id: c, label: c })) : field.kind === "boolean" ? YES_NO : YES_NO_UNKNOWN;
    return <SelectField name="value" label={field.label} options={options} defaultValue={field.text} errors={errors} />;
  }
  if (MULTI_LINE.has(field.kind)) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={textId} className="text-sm font-medium text-ink">{field.label}</label>
        <textarea id={textId} name="value" rows={3} defaultValue={field.text} aria-invalid={errors.length > 0 || undefined} className={TEXT_AREA} />
        {errors.length > 0 ? <p className="text-sm text-warn">{errors.join(" ")}</p> : null}
      </div>
    );
  }
  return <Field name="value" label={field.label} type="text" defaultValue={field.text} errors={errors} />;
}

/** One field of one row of the factory tables, with a Save button. Errors come back in words. */
export function FactoryFieldForm({ field }: Readonly<{ field: FieldView }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(saveFactoryFieldAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-2" data-testid={`field-${field.table}-${field.column}`}>
      <input type="hidden" name="table" value={field.table} />
      <input type="hidden" name="id" value={field.id} />
      <input type="hidden" name="column" value={field.column} />
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Saved.</FormDone> : null}
      <Control field={field} errors={fieldErrors("value")} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>{pending ? "Saving" : "Save"}</Button>
      </div>
    </form>
  );
}

/** Adds an empty tier to a capability's ladder; its prices are then set like any other field. */
export function AddTierForm({ capabilityId }: Readonly<{ capabilityId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(addPriceTierAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-3" data-testid="add-tier">
      <input type="hidden" name="capabilityId" value={capabilityId} />
      <FormSummary message={summary} />
      {state.result?.success === true ? <FormDone>Tier added.</FormDone> : null}
      <Field name="qtyMin" label="From (pieces)" type="number" errors={fieldErrors("qtyMin")} />
      <Field name="qtyMax" label="To (pieces, blank for no limit)" type="number" errors={fieldErrors("qtyMax")} />
      <Button type="submit" variant="secondary" pending={pending}>{pending ? "Adding" : "Add a tier"}</Button>
    </form>
  );
}
