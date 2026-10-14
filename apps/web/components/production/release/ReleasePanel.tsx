"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { call, projectUrl } from "../orders/call";
import { useRemote } from "../orders/useRemote";
import { ReleaseDetail } from "./ReleaseDetail";
import type { FreezeInputs, ReleaseSummary } from "./types";

type Props = Readonly<{
  projectId: string;
  /** What the pattern, fabric and print parts say today. Null until those parts are set up. */
  inputs: FreezeInputs | null;
}>;

const INTRO =
  "A release freezes the design, the pattern, the fabric tests, the print settings and a fingerprint of every print file, so a reorder can be printed the same way and any difference is explained.";

function FreezeForm({ projectId, inputs, onDone }: Readonly<{ projectId: string; inputs: FreezeInputs | null; onDone: () => void }>) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!inputs) {
    return <Notice>Freezing a release needs the pattern, fabric and print parts to be set up first. It is not available yet.</Notice>;
  }
  const freeze = async () => {
    setBusy(true);
    setProblem(null);
    const reply = await call<{ id: string }>(projectUrl(projectId, "releases"), "POST", { label, ...inputs });
    setBusy(false);
    if (!reply.ok) return setProblem(Object.values(reply.fields).flat()[0] ?? reply.message);
    setLabel("");
    onDone();
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void freeze(); }}>
      <Field name="release-label" label="Label for this release" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} hint="A release can never be changed or removed. Make a new one to change anything." />
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div><Button variant="primary" pending={busy} disabled={busy || label.trim() === ""}>Freeze a release</Button></div>
    </form>
  );
}

/** The design's releases, and the strike-offs and signatures against each. */
export function ReleasePanel({ projectId, inputs }: Props) {
  const { data, problem, reload } = useRemote<{ releases: readonly ReleaseSummary[] }>(projectUrl(projectId, "releases"));
  const [open, setOpen] = useState<string | null>(null);
  const releases = data?.releases ?? null;

  return (
    <section aria-labelledby="releases-heading" data-testid="releases-panel" className="flex flex-col gap-3">
      <h4 id="releases-heading" className="text-[15px] font-medium text-ink">Releases and strike-offs</h4>
      <p className="text-[13px] leading-relaxed text-chalk-muted">{INTRO}</p>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      {releases && releases.length === 0 ? <p className="text-[13px] text-chalk-muted">No releases yet.</p> : null}
      <ul className="flex flex-col gap-1">
        {(releases ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 text-[14px] text-ink">
            <span>Release {r.number}: {r.label}</span>
            <Button variant="quiet" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "Open"}<span className="sr-only"> release {r.number}</span></Button>
          </li>
        ))}
      </ul>
      {open ? <ReleaseDetail key={open} projectId={projectId} releaseId={open} inputs={inputs} /> : null}
      <FreezeForm projectId={projectId} inputs={inputs} onDone={reload} />
    </section>
  );
}
