"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { readJson } from "@/lib/http/read-json";
import { addMarkAction, decideNoticeAction, reviewCheckAction, setMarkActiveAction } from "@/lib/moderation/actions";

/** Allow or block one flagged item, with a reason (decision 0073). */
export function ReviewForm({ checkId }: Readonly<{ checkId: string }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(reviewCheckAction);
  return (
    <form ref={form} action={submit} noValidate className="mt-2 flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="checkId" value={checkId} />
      <Field name="reason" label="Reason" maxLength={500} errors={fieldErrors("reason")} />
      <Button type="submit" name="decision" value="allowed" variant="secondary" pending={pending}>Allow</Button>
      <Button type="submit" name="decision" value="blocked" variant="secondary" pending={pending}>Block</Button>
    </form>
  );
}

/** Uphold a notice against a brand, or reject it. */
export function NoticeForm({ noticeId }: Readonly<{ noticeId: string }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(decideNoticeAction);
  return (
    <form ref={form} action={submit} noValidate className="mt-2 flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="noticeId" value={noticeId} />
      <Field name="brandId" label="Brand id (to uphold)" maxLength={36} errors={fieldErrors("brandId")} />
      <Field name="note" label="Reason" maxLength={500} errors={fieldErrors("note")} />
      <Button type="submit" name="status" value="upheld" variant="secondary" pending={pending}>Uphold</Button>
      <Button type="submit" name="status" value="rejected" variant="secondary" pending={pending}>Reject</Button>
    </form>
  );
}

/** Add a mark to the registry by name. */
export function MarkForm() {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(addMarkAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <Field name="holder" label="Owner" maxLength={200} errors={fieldErrors("holder")} />
      <Field name="markText" label="Mark (name)" maxLength={120} errors={fieldErrors("markText")} />
      <Field name="contact" label="Contact" maxLength={320} errors={fieldErrors("contact")} />
      <Button type="submit" variant="secondary" pending={pending}>Add mark</Button>
    </form>
  );
}

/** Add a mark by its picture: only the picture's hash is kept. */
export function MarkPictureForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const send = async () => {
    if (!form.current) return;
    setPending(true);
    try {
      const response = await fetch("/ops/review/marks", { method: "POST", body: new FormData(form.current) });
      const answer = (await readJson(response)) as { success?: boolean; error?: { message?: string } } | null;
      if (answer?.success) {
        setMessage(null);
        form.current.reset();
        router.refresh();
      } else setMessage(answer?.error?.message ?? "The mark could not be added.");
    } finally {
      setPending(false);
    }
  };
  return (
    <form ref={form} onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex flex-wrap items-end gap-2">
      <Field name="holder" label="Owner" maxLength={200} />
      <Field name="markText" label="Mark (name, optional)" maxLength={120} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Picture of the mark
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" className="min-h-10 text-sm" />
      </label>
      <Button type="submit" variant="secondary" pending={pending}>Add picture</Button>
      {message ? <p role="alert" className="w-full text-sm text-warn">{message}</p> : null}
    </form>
  );
}

/** Switch a mark on or off. */
export function MarkToggle({ markId, active }: Readonly<{ markId: string; active: boolean }>) {
  const { form, submit, pending, summary } = useFormAction(setMarkActiveAction);
  return (
    <form ref={form} action={submit} noValidate className="inline">
      <FormSummary message={summary} />
      <input type="hidden" name="markId" value={markId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="secondary" pending={pending}>{active ? "Switch off" : "Switch on"}</Button>
    </form>
  );
}
