"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { createProjectAction } from "@/lib/projects/actions";
import { PROJECT_NAME_MAX, PROJECT_TEXT_MAX } from "@/lib/projects/schemas";
import type { TypeGroup } from "@/lib/projects/type-groups";

type Choice = Readonly<{ id: string; label: string }>;

type NewDesignFormProps = Readonly<{
  /** Every garment type, gathered under the name of its family. */
  types: readonly TypeGroup[];
  wearers: readonly Choice[];
}>;

type FieldProps = Readonly<{ kept: (name: string) => string; errors: (name: string) => readonly string[] }>;

/** Asks what to make, for whom, and what to call it. The design opens when it is made. */
export function NewDesignForm({ types, wearers }: NewDesignFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createProjectAction);
  const props: FieldProps = { kept: (name) => state.values[name] ?? "", errors: fieldErrors };

  return (
    <form ref={form} action={submit} className="flex flex-col gap-5" noValidate>
      <FormSummary message={summary} />
      <ChoiceFields types={types} wearers={wearers} {...props} />
      <TextFields {...props} />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Creating" : "Create design"}
        </Button>
      </div>
    </form>
  );
}

function ChoiceFields({ types, wearers, kept, errors }: NewDesignFormProps & FieldProps) {
  return (
    <>
      <SelectField
        name="typeId"
        label="Garment type"
        options={types}
        placeholder="Choose a garment type"
        required
        defaultValue={kept("typeId")}
        errors={errors("typeId")}
      />
      <SelectField
        name="wearer"
        label="Made for"
        options={wearers}
        placeholder="Choose who it is for"
        required
        defaultValue={kept("wearer")}
        errors={errors("wearer")}
      />
    </>
  );
}

function TextFields({ kept, errors }: FieldProps) {
  return (
    <>
      <Field
        name="name"
        label="Design name"
        type="text"
        required
        maxLength={PROJECT_NAME_MAX}
        defaultValue={kept("name")}
        errors={errors("name")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="styleNumber"
          label="Style number (optional)"
          type="text"
          maxLength={PROJECT_TEXT_MAX}
          defaultValue={kept("styleNumber")}
          errors={errors("styleNumber")}
        />
        <Field
          name="season"
          label="Season (optional)"
          type="text"
          maxLength={PROJECT_TEXT_MAX}
          defaultValue={kept("season")}
          errors={errors("season")}
        />
      </div>
    </>
  );
}
