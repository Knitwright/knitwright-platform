"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import type { FormAction, FormErrors, FormResult } from "@/lib/projects/tech-pack-forms";
import type { FormBatch } from "@/lib/projects/tech-pack-value-forms";
import { useTechPackEdit } from "./TechPackEdit";

export type FormFieldSpec = Readonly<{
  name: string;
  label: string;
  value: string;
  hint?: string;
  /** Present for a list of choices. Absent for a line of text. */
  choices?: readonly Readonly<{ id: string; label: string }>[];
}>;

type RowFormProps = Readonly<{
  /** Names the form, and keeps a problem with the form that caused it. */
  formKey: string;
  title: string;
  fields: readonly FormFieldSpec[];
  submitLabel: string;
  /**
   * Turns what was typed into a change, or several changes saved as one version. Nothing is
   * sent when it says there is nothing to do.
   */
  build: (values: Readonly<Record<string, string>>) => FormAction | FormResult | FormBatch;
  /** Shown after the fields, for example a remove button. */
  extra?: ReactNode;
  /** Text shown above the fields. */
  description?: string;
  /** Empties the fields after a save, for a form that adds something new. */
  clearAfterSave?: boolean;
}>;

const valuesOf = (form: HTMLFormElement): Record<string, string> =>
  Object.fromEntries([...new FormData(form).entries()].map(([name, value]) => [name, typeof value === "string" ? value : ""]));

/** One small form: labelled fields, one save button, and each mistake beside the field it belongs to. */
export function RowForm(props: RowFormProps) {
  const { formKey, title, fields, submitLabel, build, extra, description, clearAfterSave } = props;
  const edit = useTechPackEdit();
  const [errors, setErrors] = useState<FormErrors>({});
  // What the server holds decides the fields. When it changes, the form starts again from it.
  const shown = JSON.stringify(fields.map((field) => field.value));
  const failure = edit.errorFor(formKey);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = build(valuesOf(form));
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    edit.clearProblem(formKey);
    const actions = "actions" in result ? result.actions : result.action ? [result.action] : [];
    if (actions.length === 0) return;
    edit.saveMany(formKey, actions);
    if (clearAfterSave) form.reset();
  };

  return (
    <form key={shown} onSubmit={submit} aria-label={title} data-field={formKey} noValidate className="flex flex-col gap-3">
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) =>
          field.choices ? (
            <SelectField
              key={field.name}
              name={field.name}
              label={field.label}
              hint={field.hint}
              defaultValue={field.value}
              options={field.choices}
              errors={errors[field.name] ? [errors[field.name] ?? ""] : []}
            />
          ) : (
            <Field
              key={field.name}
              name={field.name}
              label={field.label}
              hint={field.hint}
              defaultValue={field.value}
              autoComplete="off"
              errors={errors[field.name] ? [errors[field.name] ?? ""] : []}
            />
          ),
        )}
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm text-warn">
          {errors.form}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-warn">
          {failure}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" pending={edit.busy}>
          {submitLabel}
        </Button>
        {extra}
      </div>
    </form>
  );
}
