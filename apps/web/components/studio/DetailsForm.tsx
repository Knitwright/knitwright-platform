"use client";

import { useState } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { renameProjectAction } from "@/lib/projects/actions";
import { PROJECT_NAME_MAX, PROJECT_TEXT_MAX } from "@/lib/projects/schemas";

type DetailsFormProps = Readonly<{
  projectId: string;
  name: string;
  styleNumber: string;
  season: string;
}>;

/** Changes the name, style number and season. These are not part of the design's history. */
export function DetailsForm({ projectId, name, styleNumber, season }: DetailsFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(renameProjectAction);
  // The message stays only until the person edits again.
  const [editedAt, setEditedAt] = useState(-1);
  const saved = state.result?.success === true && editedAt < state.attempt;

  return (
    <form
      ref={form}
      action={submit}
      onChange={() => setEditedAt(state.attempt)}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormSummary message={summary} />
      {saved ? <FormDone>The details are saved.</FormDone> : null}
      <input type="hidden" name="projectId" value={projectId} />
      <Field
        name="name"
        label="Design name"
        type="text"
        required
        maxLength={PROJECT_NAME_MAX}
        defaultValue={state.values.name ?? name}
        errors={fieldErrors("name")}
      />
      <Field
        name="styleNumber"
        label="Style number (optional)"
        type="text"
        maxLength={PROJECT_TEXT_MAX}
        defaultValue={state.values.styleNumber ?? styleNumber}
        errors={fieldErrors("styleNumber")}
      />
      <Field
        name="season"
        label="Season (optional)"
        type="text"
        maxLength={PROJECT_TEXT_MAX}
        defaultValue={state.values.season ?? season}
        errors={fieldErrors("season")}
      />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          {pending ? "Saving" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
