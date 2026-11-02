"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBenchmarkAction } from "@/lib/benchmarks/actions";

/**
 * "New benchmark" (spec F-S2 step 1). A name, and the design it is for when it was opened from one. The cards are
 * added on the comparison's own screen, because each one is a fetch or a read and each can be refused on its own.
 */
export function NewBenchmark({ projectId = "" }: Readonly<{ projectId?: string }>) {
  const { form, submit, pending, fieldErrors, summary } = useFormAction(createBenchmarkAction);

  return (
    <form ref={form} action={submit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5">
      <h2 className="text-lg font-medium text-ink">New benchmark</h2>
      <p className="text-sm text-muted">
        Name what you are comparing, such as “Running shorts, 5 inch”. You add up to five products to it next.
      </p>
      <FormSummary message={summary} />
      <Field name="title" label="What are you comparing?" maxLength={120} required errors={fieldErrors("title")} />
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Making it…" : "Make the benchmark"}
      </Button>
    </form>
  );
}
