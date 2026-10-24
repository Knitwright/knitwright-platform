"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Finding } from "@/lib/production/contract";
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
  status: "draft" | "validated" | "ordered";
  statusSentence: string;
}>;

function Body({ projectId }: Readonly<{ projectId: string }>) {
  const url = projectUrl(projectId, "validation");
  const { data, problem, reload } = useRemote<Report>(url);
  const [moveProblem, setMoveProblem] = useState<string | null>(null);

  const move = async (to: "validated" | "draft") => {
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
      {data.status === "draft" ? (
        <div><Button variant="secondary" disabled={!data.orderable} onClick={() => void move("validated")}>Record no blockers today</Button></div>
      ) : null}
      {data.status === "validated" ? (
        <div><Button variant="quiet" onClick={() => void move("draft")}>Back to draft</Button></div>
      ) : null}
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
