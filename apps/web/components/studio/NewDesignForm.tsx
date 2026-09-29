"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { createProjectAction } from "@/lib/projects/actions";
import { PROJECT_NAME_MAX, PROJECT_TEXT_MAX } from "@/lib/projects/schemas";

type Choice = Readonly<{ id: string; label: string }>;

type NewDesignFormProps = Readonly<{
  types: readonly Choice[];
  wearers: readonly Choice[];
}>;

/** Asks what to make, for whom, and what to call it. The design opens when it is made. */
export function NewDesignForm({ types, wearers }: NewDesignFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createProjectAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-5" noValidate>
      <FormSummary message={summary} />
      <SelectField
        name="typeId"
        label="Garment type"
        options={types}
        placeholder="Choose a garment type"
        required
        defaultValue={state.values.typeId ?? ""}
        errors={fieldErrors("typeId")}
      />
      <SelectField
        name="wearer"
        label="Made for"
        options={wearers}
        placeholder="Choose who it is for"
        required
        defaultValue={state.values.wearer ?? ""}
        errors={fieldErrors("wearer")}
      />
      <Field
        name="name"
        label="Design name"
        type="text"
        required
        maxLength={PROJECT_NAME_MAX}
        defaultValue={state.values.name ?? ""}
        errors={fieldErrors("name")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="styleNumber"
          label="Style number (optional)"
          type="text"
          maxLength={PROJECT_TEXT_MAX}
          defaultValue={state.values.styleNumber ?? ""}
          errors={fieldErrors("styleNumber")}
        />
        <Field
          name="season"
          label="Season (optional)"
          type="text"
          maxLength={PROJECT_TEXT_MAX}
          defaultValue={state.values.season ?? ""}
          errors={fieldErrors("season")}
        />
      </div>
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Creating" : "Create design"}
        </Button>
      </div>
    </form>
  );
}
