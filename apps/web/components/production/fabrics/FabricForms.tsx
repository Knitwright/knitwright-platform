"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { addFabricAction, addFabricTestAction, saveSizeMapAction } from "@/lib/fabrics/actions";
import { resetPatternSize } from "@/lib/fabrics/size-map-client";

const NUMBER = { type: "number", inputMode: "decimal", step: "any" } as const;

/** Adds a fabric. Only what the supplier's sheet states is filled in; the rest stays "not set". */
export function AddFabricForm() {
  const { form, state, onSubmit, pending, summary, fieldErrors } = useSendForm(addFabricAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {state.result?.success ? <FormDone>The fabric is added.</FormDone> : null}
      <Field name="name" label="Fabric name" required maxLength={80} defaultValue={state.values.name} errors={fieldErrors("name")} />
      <Field name="composition" label="What it is made of" hint="For example 100 % recycled polyester." maxLength={200} errors={fieldErrors("composition")} />
      <Field name="construction" label="How it is made" hint="For example interlock or rib." maxLength={120} errors={fieldErrors("construction")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="gsm" label="Weight (gsm)" hint="Only if the supplier's sheet says." {...NUMBER} errors={fieldErrors("gsm")} />
        <Field name="usableWidthMm" label="Usable width (mm)" hint="Between the edges. Only if the supplier says." {...NUMBER} errors={fieldErrors("usableWidthMm")} />
      </div>
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Adding" : "Add fabric"}
        </Button>
      </div>
    </form>
  );
}

/** Records one fabric test. Stretch needs its load; shrink needs the heat and time it was pressed at. */
export function AddTestForm({ fabricId, fabricName }: Readonly<{ fabricId: string; fabricName: string }>) {
  const { form, state, onSubmit, pending, summary, fieldErrors } = useSendForm(addFabricTestAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label={`Add a test of ${fabricName}`}>
      <FormSummary message={summary} />
      {state.result?.success ? <FormDone>The test is saved. It cannot be changed, only added to.</FormDone> : null}
      <input type="hidden" name="fabricId" value={fabricId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="testedBy" label="Who ran the test" required maxLength={80} errors={fieldErrors("testedBy")} />
        <Field name="testedOn" label="Day of the test" type="date" required errors={fieldErrors("testedOn")} />
      </div>
      <Field name="method" label="How it was done" hint="One sentence someone else could repeat." required maxLength={300} errors={fieldErrors("method")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="stretchLengthPct" label="Stretch along the length (%)" {...NUMBER} errors={fieldErrors("stretchLengthPct")} />
        <Field name="stretchWidthPct" label="Stretch across the width (%)" {...NUMBER} errors={fieldErrors("stretchWidthPct")} />
        <Field name="recoveryPct" label="Recovery (%)" {...NUMBER} errors={fieldErrors("recoveryPct")} />
      </div>
      <Field name="loadNewtons" label="Load it was stretched at (newtons)" hint="Needed with any stretch or recovery number." {...NUMBER} errors={fieldErrors("loadNewtons")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="shrinkLengthPct" label="Shrink along the length (%)" hint="After pressing, as for printing." {...NUMBER} errors={fieldErrors("shrinkLengthPct")} />
        <Field name="shrinkWidthPct" label="Shrink across the width (%)" {...NUMBER} errors={fieldErrors("shrinkWidthPct")} />
        <Field name="pressTempC" label="Pressed at (°C)" hint="Needed with any shrink number." {...NUMBER} errors={fieldErrors("pressTempC")} />
        <Field name="pressSeconds" label="Pressed for (seconds)" {...NUMBER} errors={fieldErrors("pressSeconds")} />
      </div>
      <Field name="reductionPct" label="Stretch reduction found right (%)" hint="Only if the test gave one for the pattern." {...NUMBER} errors={fieldErrors("reductionPct")} />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Save test"}
        </Button>
      </div>
    </form>
  );
}

type Entry = Readonly<{ label: string; wearer: string; cut: string; patternSize: string; source: string }>;

/**
 * One size label and the pattern size it is cut from, with a way back to the suggestion.
 *
 * The form is named for the size label ("Size label M"), not for the field inside it: a form called
 * "Pattern size for M" contains the name of its own "Pattern size" input, which makes every lookup
 * by label in that row match two things at once.
 *
 * Saving goes through this page's own action. Putting it back goes through
 * `DELETE /api/fabrics/size-map`, which is where that undo lives and which nothing called until now
 * (decision 0124): a brand that typed a pattern size by mistake could not take it off again, and a
 * value nobody chose must never be left reading as one somebody did.
 */
export function SizeMapRowForm({ entry }: Readonly<{ entry: Entry }>) {
  const { form, state, onSubmit, pending, summary, fieldErrors } = useSendForm(saveSizeMapAction);
  return (
    <div className="flex flex-col gap-1">
      <form ref={form} onSubmit={onSubmit} className="flex items-end gap-2" noValidate aria-label={`Size label ${entry.label}`}>
        <input type="hidden" name="label" value={entry.label} />
        <input type="hidden" name="wearer" value={entry.wearer} />
        <input type="hidden" name="cut" value={entry.cut} />
        <input type="hidden" name="source" value="user-edited" />
        <Field name="patternSize" label="Pattern size" defaultValue={entry.patternSize} maxLength={16} errors={fieldErrors("patternSize")} />
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        {state.result?.success ? <span role="status" className="text-sm text-muted">Saved.</span> : null}
        {summary ? <span role="alert" className="text-sm text-warn">{summary}</span> : null}
      </form>
      {entry.source === "suggested" ? null : <UseTheSuggestion entry={entry} />}
    </div>
  );
}

/**
 * Takes the brand's own choice off one label, so Knitwright's suggestion stands again. Its name is
 * "Use the suggestion for M" for the same reason the form's is "Size label M": nothing in this row
 * may carry the name of the field beside it, or a lookup by label finds both at once.
 */
function UseTheSuggestion({ entry }: Readonly<{ entry: Entry }>) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const putBack = () => {
    setProblem(null);
    start(async () => {
      const answer = await resetPatternSize((input, init) => fetch(input, init), { label: entry.label, wearer: entry.wearer, cut: entry.cut });
      if (!answer.ok) return setProblem(answer.reason);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="quiet" pending={pending} onClick={putBack} aria-label={`Use the suggestion for ${entry.label}`}>
        {pending ? "Putting it back" : "Use the suggestion"}
      </Button>
      {problem ? (
        <span role="alert" className="text-sm text-warn">
          {problem}
        </span>
      ) : null}
    </div>
  );
}
