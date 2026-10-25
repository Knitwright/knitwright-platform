import { deliveredLabel, statusLine } from "@/lib/pattern-service/wording";
import type { PatternRequest } from "@/lib/pattern-service/rows";

/** The brand's requests for one design, newest first, with the files once they are delivered. */
export function RequestList({ projectId, requests }: Readonly<{ projectId: string; requests: readonly PatternRequest[] }>) {
  if (requests.length === 0) return <p className="text-[15px] text-muted">No requests yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline" data-testid="pattern-requests">
      {requests.map((r) => (
        <li key={r.id} className="py-3 text-sm" data-testid="pattern-request">
          <p className="font-medium text-ink">Version {r.designVersion}</p>
          <p className="text-ink-2" data-testid="pattern-request-status">{statusLine(r)}</p>
          {r.status === "delivered" ? (
            <div className="mt-2">
              <p className="text-muted">{deliveredLabel(r)}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {r.fileIds.map((fileId, index) => (
                  <li key={fileId}>
                    <a className="underline" href={`/api/projects/${projectId}/pattern-service/${r.id}/files/${fileId}`} download>
                      Download pattern file {index + 1} (DXF)
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
