"use client";

import { useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { APPLY_PARTS, PART_LABELS, type ApplyPart } from "@/lib/clubs/wording";

type Props = Readonly<{ projectId: string; version: number }>;

/** Puts the kit's colours, crest and sponsors on one design. The design keeps its own copy. */
export function UseKitButton({ projectId, version }: Props) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<readonly ApplyPart[]>(["colours"]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(version);
  const [result, setResult] = useState<Readonly<{ tone: "ok" | "warn"; lines: readonly string[] }> | null>(null);

  const toggle = (part: ApplyPart) => setParts((now) => (now.includes(part) ? now.filter((p) => p !== part) : [...now, part]));

  const apply = async () => {
    setBusy(true);
    const reply = await call<{ version: number; changed: boolean; notes: readonly string[] }>("/api/club/kit/apply", "POST", { projectId, expectedVersion: current, parts });
    setBusy(false);
    if (!reply.ok) return setResult({ tone: "warn", lines: [reply.message] });
    setCurrent(reply.data.version);
    setResult({ tone: "ok", lines: [reply.data.changed ? "Saved as a new version of the design." : "The design already had these.", ...reply.data.notes] });
  };

  if (!open) return <Button variant="secondary" type="button" onClick={() => setOpen(true)}>Use club kit</Button>;
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-hairline p-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-sm font-medium text-ink">Put on this design</legend>
        {APPLY_PARTS.map((part) => (
          <label key={part} className="flex items-center gap-2 text-[15px] text-ink">
            <input type="checkbox" className="size-5 accent-cobalt-soft" checked={parts.includes(part)} onChange={() => toggle(part)} />
            {PART_LABELS[part]}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="button" pending={busy} disabled={parts.length === 0} onClick={() => void apply()}>Apply</Button>
        <Button variant="quiet" type="button" onClick={() => setOpen(false)}>Close</Button>
      </div>
      {result ? <Notice tone={result.tone} role={result.tone === "warn" ? "alert" : "status"}>{result.lines.map((line) => <p key={line}>{line}</p>)}</Notice> : null}
    </div>
  );
}
