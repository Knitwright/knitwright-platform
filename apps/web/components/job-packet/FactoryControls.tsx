"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { TextAreaField } from "@/components/ops/TextAreaField";
import { Button } from "@/components/ui/Button";
import { recordNoteAction, recordStepAction } from "@/lib/job-packet/actions";
import { EVENT_LABELS, NOTE_MAX, type FactoryStep } from "@/lib/job-packet/steps";

/** The one step the factory may press next. */
function StepForm({ token, step }: Readonly<{ token: string; step: FactoryStep }>) {
  const { form, state, submit, pending, summary } = useFormAction(recordStepAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="step" value={step} />
      <TextAreaField name="note" label="Note with this step (optional)" rows={2} maxLength={NOTE_MAX} />
      <Button type="submit" pending={pending}>{pending ? "Saving" : EVENT_LABELS[step]}</Button>
      {state.result?.success === true ? <FormDone>Recorded.</FormDone> : null}
    </form>
  );
}

function NoteForm({ token }: Readonly<{ token: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(recordNoteAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3">
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      <TextAreaField name="note" label="Note to Knitwright" maxLength={NOTE_MAX} errors={fieldErrors("note")} />
      <Button type="submit" variant="secondary" pending={pending}>{pending ? "Sending" : "Send note"}</Button>
      {state.result?.success === true ? <FormDone>Note sent.</FormDone> : null}
    </form>
  );
}

function PhotoForm({ token }: Readonly<{ token: string }>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    setDone(false);
    try {
      const response = await fetch(`/api/job/${token}/photos`, { method: "POST", body: new FormData(form) });
      const result = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
      if (result?.success) {
        form.reset();
        setDone(true);
        router.refresh();
      } else {
        setMessage(result?.error?.message ?? "The photo could not be sent. Try again.");
      }
    } catch {
      setMessage("The photo could not be sent. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-3">
      <FormSummary message={message} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="job-photo" className="text-sm font-medium text-ink">Photo (PNG, JPEG or WebP, up to 8 MB)</label>
        <input id="job-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
      </div>
      <TextAreaField name="note" label="Caption (optional)" rows={2} maxLength={NOTE_MAX} />
      <Button type="submit" variant="secondary" pending={pending}>{pending ? "Sending" : "Send photo"}</Button>
      {done ? <FormDone>Photo sent.</FormDone> : null}
    </form>
  );
}

/** The factory's buttons: the next step, a note and a photo. */
export function FactoryControls({ token, next }: Readonly<{ token: string; next: FactoryStep | null }>) {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      <section aria-labelledby="job-step" className="flex flex-col gap-3">
        <h3 id="job-step" className="text-base font-semibold text-ink">Status</h3>
        {next ? <StepForm token={token} step={next} /> : <p className="text-sm text-muted">This batch is marked Ready for QC. Nothing more to press.</p>}
      </section>
      <section aria-labelledby="job-note" className="flex flex-col gap-3">
        <h3 id="job-note" className="text-base font-semibold text-ink">Note</h3>
        <NoteForm token={token} />
      </section>
      <section aria-labelledby="job-photo-heading" className="flex flex-col gap-3">
        <h3 id="job-photo-heading" className="text-base font-semibold text-ink">Photo</h3>
        <PhotoForm token={token} />
      </section>
    </div>
  );
}
