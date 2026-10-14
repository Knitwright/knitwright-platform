"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { call, projectUrl } from "../orders/call";
import { useRemote } from "../orders/useRemote";
import { SignOffForm } from "./SignOffForm";
import { StrikeOffCard } from "./StrikeOffCard";
import type { FreezeInputs, ReleaseDetailView, ReorderReport } from "./types";

type Props = Readonly<{ projectId: string; releaseId: string; inputs: FreezeInputs | null }>;

function Reorder({ projectId, releaseId, inputs }: Props) {
  const [report, setReport] = useState<ReorderReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!inputs) {
    return <p className="text-[13px] text-muted">Checking a reorder needs the pattern, fabric and print parts to be set up. It is not available yet.</p>;
  }
  const run = async () => {
    const { orderId, patternBlockId, patternBlockVersion, fabricTestIds, printProfile } = inputs;
    const reply = await call<ReorderReport>(projectUrl(projectId, `releases/${releaseId}/reorder`), "POST", { orderId, patternBlockId, patternBlockVersion, fabricTestIds, printProfile });
    if (reply.ok) setReport(reply.data);
    else setProblem(reply.message);
  };
  return (
    <div className="flex flex-col gap-2">
      <div><Button variant="secondary" onClick={() => void run()}>Check a reorder against this release</Button></div>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      {report ? (
        <Notice tone={report.identical ? "ok" : "warn"}>
          <p>{report.identical ? "Every file came out the same as in the release." : "The files are not the same as in the release. Nothing has been sent. Choose what to do next."}</p>
          <ul className="mt-1 list-disc pl-5">
            {report.differences.map((d) => (
              <li key={d.message}>{d.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}

/** One release: what it froze, every file with its fingerprint, who signed, and the strike-offs. */
export function ReleaseDetail({ projectId, releaseId, inputs }: Props) {
  const { data: view, problem: loadProblem, reload } = useRemote<ReleaseDetailView>(projectUrl(projectId, `releases/${releaseId}`));
  const [actionProblem, setActionProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const problem = loadProblem ?? actionProblem;

  const askForStrikeOff = async () => {
    setBusy(true);
    const reply = await call<{ id: string }>(projectUrl(projectId, "proofs"), "POST", { releaseId, note: "" });
    setBusy(false);
    if (reply.ok) reload();
    else setActionProblem(reply.message);
  };

  if (problem) return <Notice tone="warn" role="alert">{problem}</Notice>;
  if (!view) return <p className="text-[13px] text-chalk-muted">Loading the release.</p>;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4" data-testid="release-detail">
      <div>
        <h5 className="text-[15px] font-medium text-ink">Release {view.number}: {view.label}</h5>
        <p className="text-[13px] text-muted">
          Frozen from design version {view.specVersion}, pattern {view.patternBlockId} version {view.patternBlockVersion}, with {view.fabricTestIds.length === 0 ? "no fabric tests" : `fabric tests ${view.fabricTestIds.join(", ")}`}.
          Bleed {view.printProfile.bleedMm} mm at {view.printProfile.dpi} dpi. {view.hasTeamList ? "Made with a team list; only its fingerprint is kept." : "No team list."}
        </p>
      </div>
      <details>
        <summary className="cursor-pointer text-[14px] text-ink">{view.files.length} files, each with its SHA-256</summary>
        <ul className="mt-2 flex flex-col gap-1 font-mono text-[12px] text-muted">
          {view.files.map((f) => (
            <li key={f.path} className="break-all">{f.path} {f.sha256}</li>
          ))}
        </ul>
      </details>
      <div className="flex flex-col gap-2">
        <h6 className="text-[14px] font-medium text-ink">Who has signed</h6>
        <ul className="flex flex-col gap-1 text-[14px] text-ink-2">
          {view.signOffs.map((line) => (
            <li key={line.role}>{line.sentence}</li>
          ))}
        </ul>
        <SignOffForm projectId={projectId} releaseId={releaseId} onDone={reload} />
      </div>
      <div className="flex flex-col gap-2">
        <h6 className="text-[14px] font-medium text-ink">Strike-offs</h6>
        <p className="text-[13px] text-muted" data-testid="proofs-line">{view.proofs.sentence}</p>
        <ul className="flex flex-col gap-2">
          {view.strikeOffs.map((s) => (
            <StrikeOffCard key={`${s.id}-${s.status}`} projectId={projectId} strikeOff={s} onDone={reload} />
          ))}
        </ul>
        <div><Button variant="secondary" pending={busy} disabled={busy} onClick={() => void askForStrikeOff()}>Ask for a strike-off</Button></div>
      </div>
      <Reorder projectId={projectId} releaseId={releaseId} inputs={inputs} />
    </div>
  );
}
