"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { call, projectUrl } from "../orders/call";
import type { StrikeOffView } from "./types";

type Props = Readonly<{ projectId: string; strikeOff: StrikeOffView; onDone: () => void }>;

const numberOrNull = (text: string): number | null => (text.trim() === "" ? null : Number(text));

/** One strike-off: where it stands, then what can be done next. A decided strike-off is shown, never edited. */
export function StrikeOffCard({ projectId, strikeOff, onDone }: Props) {
  const [lengthPct, setLength] = useState(strikeOff.shrinkLengthPct?.toString() ?? "");
  const [widthPct, setWidth] = useState(strikeOff.shrinkWidthPct?.toString() ?? "");
  const [colours, setColours] = useState(strikeOff.colourNotes.map((c) => `${c.colour}: ${c.note}`).join("\n"));
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const decided = strikeOff.status === "accepted" || strikeOff.status === "rejected";
  const base = projectUrl(projectId, `proofs/${strikeOff.id}`);

  const send = async (url: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(true);
    setProblem(null);
    const reply = await call<unknown>(url, method, body);
    setBusy(false);
    if (!reply.ok) return setProblem(Object.values(reply.fields).flat()[0] ?? reply.message);
    onDone();
  };

  const receive = () => {
    const colourNotes = colours
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line) => {
        const at = line.indexOf(":");
        return at < 0 ? { colour: "Colour", note: line } : { colour: line.slice(0, at).trim(), note: line.slice(at + 1).trim() };
      });
    return send(base, "PUT", { shrinkLengthPct: numberOrNull(lengthPct), shrinkWidthPct: numberOrNull(widthPct), colourNotes, photoFileIds: [...strikeOff.photoFileIds] });
  };
  const decide = (accept: boolean) => send(`${base}/decision`, "POST", { accept, name, role });

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-hairline p-3" data-testid="strike-off">
      <p className="text-[14px] text-ink">{strikeOff.sentence}</p>
      {strikeOff.requestedNote ? <p className="text-[13px] text-muted">{strikeOff.requestedNote}</p> : null}
      {strikeOff.shrinkLengthPct !== null || strikeOff.shrinkWidthPct !== null ? (
        <p className="text-[13px] text-muted">Measured shrink: {strikeOff.shrinkLengthPct ?? "not measured"}% along the length, {strikeOff.shrinkWidthPct ?? "not measured"}% across the width.</p>
      ) : null}
      {strikeOff.colourNotes.length > 0 ? (
        <ul className="list-disc pl-5 text-[13px] text-muted">
          {strikeOff.colourNotes.map((c) => (
            <li key={c.colour + c.note}>{c.colour}: {c.note}</li>
          ))}
        </ul>
      ) : null}
      {decided ? null : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="shrink-length" label="Shrink along the length (%)" inputMode="decimal" value={lengthPct} onChange={(e) => setLength(e.target.value)} />
            <Field name="shrink-width" label="Shrink across the width (%)" inputMode="decimal" value={widthPct} onChange={(e) => setWidth(e.target.value)} />
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            How each colour came out, one line each, such as C1: a little darker
            <textarea className="min-h-20 rounded-xl border border-hairline bg-white/[0.04] px-3 py-2 text-[14px] text-ink" value={colours} onChange={(e) => setColours(e.target.value)} />
          </label>
          <div><Button variant="secondary" pending={busy} disabled={busy} onClick={() => void receive()}>Record that it has arrived</Button></div>
          {strikeOff.status === "received" ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="decide-name" label="Your name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                <Field name="decide-role" label="Your role" maxLength={40} value={role} onChange={(e) => setRole(e.target.value)} hint="Today's date is added. A decision cannot be changed." />
              </div>
              <div className="flex gap-3">
                <Button variant="primary" disabled={busy || name.trim() === "" || role.trim() === ""} onClick={() => void decide(true)}>Accept it</Button>
                <Button variant="secondary" disabled={busy || name.trim() === "" || role.trim() === ""} onClick={() => void decide(false)}>Reject it</Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
    </li>
  );
}
