"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { markReviewedAction, moveRequestAction } from "@/lib/pattern-service/actions";
import type { PatternRequestStatus } from "@/lib/pattern-service/transitions";

const STEP_LABEL: Readonly<Record<string, string>> = { accepted: "Accept", in_progress: "Mark in progress", delivered: "Mark delivered" };

function MoveForm({ requestId, to, label, needsReason }: Readonly<{ requestId: string; to: string; label: string; needsReason: boolean }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(moveRequestAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="to" value={to} />
      {needsReason ? <Field name="note" label="Reason" maxLength={500} errors={fieldErrors("note")} /> : null}
      <Button type="submit" variant="secondary" pending={pending}>{label}</Button>
    </form>
  );
}

function ReviewForm({ requestId }: Readonly<{ requestId: string }>) {
  const { form, submit, pending, summary, fieldErrors } = useFormAction(markReviewedAction);
  return (
    <form ref={form} action={submit} noValidate className="flex flex-wrap items-end gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="requestId" value={requestId} />
      <Field name="reviewerName" label="Technician who reviewed the files" maxLength={120} errors={fieldErrors("reviewerName")} />
      <Button type="submit" variant="secondary" pending={pending}>Record the review</Button>
    </form>
  );
}

function UploadForm({ requestId }: Readonly<{ requestId: string }>) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const send = async () => {
    const files = input.current?.files;
    if (!files || files.length === 0) return setMessage("Choose at least one DXF file.");
    const body = new FormData();
    for (const file of Array.from(files)) body.append("files", file);
    setPending(true);
    try {
      const response = await fetch(`/ops/pattern-requests/${requestId}/files`, { method: "POST", body });
      const answer = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
      if (answer?.success) {
        setMessage(null);
        if (input.current) input.current.value = "";
        router.refresh();
      } else setMessage(answer?.error?.message ?? "The files could not be attached.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Pattern files (DXF)
        <input ref={input} type="file" name="files" accept=".dxf" multiple />
      </label>
      <Button type="button" variant="secondary" pending={pending} onClick={send}>Attach files</Button>
      {message ? <p role="alert" className="w-full text-sm text-warn">{message}</p> : null}
    </div>
  );
}

/** What ops can do with a request at its current step. */
export function PatternRequestControls({ requestId, status, reviewed, fileCount }: Readonly<{ requestId: string; status: PatternRequestStatus; reviewed: boolean; fileCount: number }>) {
  const next = status === "requested" ? "accepted" : status === "accepted" ? "in_progress" : status === "in_progress" ? "delivered" : null;
  return (
    <div className="mt-3 flex flex-col gap-3">
      {status === "in_progress" ? <UploadForm requestId={requestId} /> : null}
      {next && !(next === "delivered" && fileCount === 0) ? <MoveForm requestId={requestId} to={next} label={STEP_LABEL[next]!} needsReason={false} /> : null}
      {next === "delivered" && fileCount === 0 ? <p className="text-sm text-muted">Attach the DXF files to deliver.</p> : null}
      {next ? <MoveForm requestId={requestId} to="declined" label="Decline" needsReason /> : null}
      {status === "delivered" && !reviewed ? <ReviewForm requestId={requestId} /> : null}
    </div>
  );
}
