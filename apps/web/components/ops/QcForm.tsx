"use client";

import { TextAreaField } from "@/components/ops/TextAreaField";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { recordInspectionAction } from "@/lib/ops/qc/actions";
import { CHECKLIST_LABELS, CHECKLIST_RESULTS, DEFECT_RULE_LABEL, RESULT_LABELS } from "@/lib/ops/qc/checklist";

const RESULTS = CHECKLIST_RESULTS.map((id) => ({ id, label: RESULT_LABELS[id] }));

/**
 * The quality inspection of one order. The result is not a field: it follows from the answers, and a fail asks for the
 * pieces to make again, an owner and a due date, which open a remake line for the factory.
 */
export function QcForm({ orderId, colourLimit, colourNote, aqlCodeLetter, sampleSize }: Readonly<{ orderId: string; colourLimit: number | null; colourNote: string | null; aqlCodeLetter: string; sampleSize: number | null }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(recordInspectionAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="flex max-w-2xl flex-col gap-4">
      <FormSummary message={summary} />
      {done ? <FormDone>{done.result === "pass" ? "Inspection recorded: pass." : "Inspection recorded: fail. A remake line was opened for the factory."}</FormDone> : null}
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="colourLimit" value={colourLimit ?? ""} />
      <input type="hidden" name="aqlCodeLetter" value={aqlCodeLetter} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium text-ink">Checklist</legend>
        <SelectField name="measurementsResult" label={`Result: ${CHECKLIST_LABELS.measurements.toLowerCase()}`} options={RESULTS} placeholder="Choose" errors={fieldErrors("measurementsResult")} />
        <SelectField name="colourResult" label={`Result: ${CHECKLIST_LABELS.colour.toLowerCase()}`} options={RESULTS} placeholder="Choose" errors={fieldErrors("colourResult")} />
        <SelectField name="artworkResult" label={`Result: ${CHECKLIST_LABELS.artwork.toLowerCase()}`} options={RESULTS} placeholder="Choose" errors={fieldErrors("artworkResult")} />
        <SelectField name="namesNumbersResult" label={`Result: ${CHECKLIST_LABELS.names_numbers.toLowerCase()}`} options={RESULTS} placeholder="Choose" errors={fieldErrors("namesNumbersResult")} />
      </fieldset>
      <TextAreaField name="measurements" label="Measurement lines" rows={4} hint="One per line: point, spec mm, measured mm, tolerance mm. Type the numbers you measured and the tolerance you were given; none is filled in for you." errors={fieldErrors("measurements")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="sampleSize"
          label="Pieces inspected"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={sampleSize ?? undefined}
          hint={sampleSize === null ? "No sampling plan is on file, so type the number you looked at." : `The plan on file gives ${sampleSize}. Change it to what you actually looked at.`}
          errors={fieldErrors("sampleSize")}
        />
        <Field name="defectCount" label="Pieces with a defect" type="number" inputMode="numeric" min={0} hint={DEFECT_RULE_LABEL} errors={fieldErrors("defectCount")} />
      </div>
      <TextAreaField
        name="colourReadings"
        label="Colour readings"
        rows={3}
        hint={
          colourLimit === null
            ? `One per line: colour, Delta-E reading. ${colourNote ?? "No tolerance is on file, so a reading is recorded and nothing judges it."}`
            : `One per line: colour, Delta-E reading. Judged against the ${colourLimit} this factory works to; a reading over it fails the inspection.`
        }
        errors={fieldErrors("colourReadings")}
      />
      <TextAreaField name="photos" label="Photo file ids" rows={2} hint="File ids of the photos, separated by spaces or new lines." errors={fieldErrors("photos")} />
      <Field name="note" label="Note" maxLength={300} errors={fieldErrors("note")} />
      <fieldset className="flex flex-col gap-3 rounded-xl border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-ink">If this inspection fails: the remake</legend>
        <TextAreaField name="remakeSizes" label="Remake pieces by size" rows={2} hint="Such as M 2, L 1. Needed only when the inspection fails." errors={fieldErrors("remakeSizes")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="remakeOwner" label="Remake owner" maxLength={80} errors={fieldErrors("remakeOwner")} />
          <Field name="remakeDueOn" label="Remake due date" type="date" errors={fieldErrors("remakeDueOn")} />
        </div>
      </fieldset>
      <div><Button type="submit" pending={pending}>{pending ? "Saving" : "Record inspection"}</Button></div>
    </form>
  );
}
