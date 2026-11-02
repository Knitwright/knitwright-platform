"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Finding } from "@/lib/production/contract";
// `moves.ts`, never `status.ts`: this is a client component and `status.ts` holds a zod schema.
import { panelMoves, type PanelMove } from "@/lib/validation/moves";
import type { VersionStatus } from "@/lib/validation/status";
import { call, projectUrl } from "../orders/call";
import { useRemote } from "../orders/useRemote";
import { FindingList } from "./FindingList";

type Report = Readonly<{
  findings: readonly Finding[];
  blockers: number;
  warnings: number;
  orderable: boolean;
  profileName: string;
  profileLabel: string;
  status: VersionStatus;
  statusSentence: string;
}>;

function Body({ projectId }: Readonly<{ projectId: string }>) {
  const url = projectUrl(projectId, "validation");
  const { data, problem, reload } = useRemote<Report>(url);
  const [moveProblem, setMoveProblem] = useState<string | null>(null);

  const move = async (to: PanelMove) => {
    const reply = await call<Report>(url, "POST", { to });
    setMoveProblem(reply.ok ? null : reply.message);
    reload();
  };

  if (problem) return <Notice tone="warn" role="alert">{problem}</Notice>;
  if (!data) return <p className="text-[13px] text-chalk-muted">Reading the factory file.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-chalk-muted" data-testid="validation-profile">{data.profileLabel}</p>
      <p className="text-[15px] font-medium text-ink" data-testid="validation-status" data-status={data.status}>{data.statusSentence}</p>
      <p className="text-[14px] text-ink" data-testid="validation-summary">
        {data.blockers === 0 ? "No blockers." : `${data.blockers} ${data.blockers === 1 ? "blocker" : "blockers"} to clear before this can be ordered.`}
        {data.warnings > 0 ? ` ${data.warnings} to be aware of.` : ""}
      </p>
      <FindingList findings={data.findings} />
      {moveProblem ? <Notice tone="warn" role="alert">{moveProblem}</Notice> : null}
      {/* The moves this panel offers come from `lib/validation/status.ts`, so the panel cannot
          forget a status the route accepts: "Accept for ordering" was missing before. */}
      {panelMoves(data.status).length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {panelMoves(data.status).map((entry) => (
            <Button
              key={entry.to}
              variant={entry.to === "draft" ? "quiet" : "secondary"}
              disabled={entry.needsNoBlockers && !data.orderable}
              onClick={() => void move(entry.to)}
              data-testid={`validation-move-${entry.to}`}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The "Factory file" readiness list: what stands between this design and an order. */
export function ValidationPanel() {
  const projectId = useParams<{ projectId?: string }>()?.projectId;
  return (
    <section aria-labelledby="validation-heading" className="flex flex-col gap-3" data-testid="validation-panel">
      <h3 id="validation-heading" className="text-[15px] font-medium text-ink">Factory file</h3>
      {projectId ? <Body projectId={projectId} /> : <p className="text-[13px] text-chalk-muted">Open a design to see what it needs.</p>}
    </section>
  );
}
