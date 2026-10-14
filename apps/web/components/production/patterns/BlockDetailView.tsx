"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { dxfAddress, sendReview } from "@/lib/pattern-library/client";
import type { BlockDetail } from "@/lib/pattern-library/records";
import { measuredTable } from "@/lib/pattern-library/table";

function MeasuredTable({ detail }: Readonly<{ detail: BlockDetail }>) {
  const table = measuredTable(detail.sizes.map((s) => ({ size: s.size, measurements: s.measurements, skipped: s.skipped })));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px] text-ink-2">
        <caption className="pb-2 text-left text-sm font-medium text-ink">Measured on the pattern, in centimetres</caption>
        <thead>
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">
              Measurement
            </th>
            {table.sizes.map((size) => (
              <th key={size} scope="col" className="px-2 py-1 text-right font-medium">
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.pointId} className="border-t border-hairline align-top">
              <th scope="row" className="py-1 pr-3 font-normal" title={row.note}>
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td key={table.sizes[i]} className="px-2 py-1 text-right tabular-nums">
                  {cell ?? "n/a"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewForm({ blockId, onReviewed }: Readonly<{ blockId: string; onReviewed: () => Promise<void> }>) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const result = await sendReview(blockId, {
      reviewerName: String(form.get("reviewerName") ?? ""),
      reviewerRole: String(form.get("reviewerRole") ?? ""),
      note: String(form.get("note") ?? ""),
      reviewedOn: String(form.get("reviewedOn") ?? ""),
    });
    setBusy(false);
    if (result.ok) await onReviewed();
    else setProblem(result.reason);
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-xl border border-hairline p-4">
      <h4 className="text-sm font-medium text-ink">Record a review</h4>
      <p className="text-[13px] text-muted">Name the person who looked at this pattern, their role and the day. It is saved as written and cannot be changed.</p>
      <Field name="reviewerName" label="Reviewed by" required maxLength={120} />
      <Field name="reviewerRole" label="Role" defaultValue="technician" maxLength={60} />
      <Field name="reviewedOn" label="Date" type="date" required />
      <Field name="note" label="Note" maxLength={1000} />
      <div>
        <Button type="submit" pending={busy}>
          Save the review
        </Button>
      </div>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
    </form>
  );
}

/** One pattern opened: what the library did to the files, the checks, the measured table and the review. */
export function BlockDetailView({ detail, onBack, onReviewed }: Readonly<{ detail: BlockDetail; onBack: () => void; onReviewed: () => Promise<void> }>) {
  const { block } = detail;
  const failing = detail.sizes.flatMap((s) => s.checks).filter((c) => !c.ok);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="quiet" onClick={onBack}>
          Back to the library
        </Button>
        <h4 className="text-sm font-medium text-ink">
          {block.name}, version {block.version}
        </h4>
      </div>
      <p className="text-[13px] text-muted">
        {block.sources}.{" "}
        {block.review ? `Reviewed by ${block.review.reviewerName} (${block.review.reviewerRole}) on ${block.review.reviewedOn}.` : "Draft pattern, not reviewed."}
      </p>
      <div className="flex flex-wrap gap-3 text-[15px]">
        {block.sizes.map((size) => (
          <a key={size} className="soft-link text-ink" href={dxfAddress(block.id, size)}>
            DXF, size {size}
          </a>
        ))}
      </div>
      <MeasuredTable detail={detail} />
      {failing.length > 0 ? (
        <details className="rounded-xl border border-hairline p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">{failing.length} things the library could not find in the file</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-[13px] text-ink-2">
            {failing.map((check) => (
              <li key={`${check.size}-${check.id}`}>
                Size {check.size}: {check.sentence}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {block.derived.length > 0 ? (
        <details className="rounded-xl border border-hairline p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">What Knitwright added to the file</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-[13px] text-ink-2">
            {block.derived.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <ReviewForm blockId={block.id} onReviewed={onReviewed} />
    </div>
  );
}
