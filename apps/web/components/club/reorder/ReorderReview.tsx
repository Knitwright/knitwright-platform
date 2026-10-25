"use client";

import { Button } from "@/components/ui/Button";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { Notice } from "@/components/ui/Notice";
import { allSettled, type Answer, type Answers, type LineView, type PreviewView } from "./model";

type Props = Readonly<{
  preview: PreviewView;
  answers: Answers;
  onAnswer: (index: number, answer: Answer) => void;
  onConfirm: () => void;
  busy: boolean;
}>;

const who = (line: LineView): string => (line.row.name === "" ? `Number ${line.row.number}` : line.row.name);

function FixLine({ line, run, answer, onAnswer }: Readonly<{ line: LineView; run: readonly string[]; answer: Answer | undefined; onAnswer: (a: Answer) => void }>) {
  const left = line.reasons.includes("player-left");
  const sizeBad = line.reasons.includes("size-removed");
  const numberBad = line.reasons.includes("no-number");
  const out = answer?.action === "leave-out";
  const label = who(line);
  return (
    <li className="flex flex-col gap-2 py-3" data-testid="fix-line">
      <p className="text-[15px] text-ink">{label} <span className="text-muted">· size {line.row.sizeLabel}</span></p>
      <ul className="list-disc pl-5 text-sm text-muted">{line.messages.map((m) => <li key={m}>{m}</li>)}</ul>
      <div className="flex flex-wrap items-end gap-3">
        {sizeBad && !out ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Size for {label}
            <select className={FIELD_CONTROL} value={answer?.sizeLabel ?? ""} onChange={(e) => onAnswer({ ...answer, sizeLabel: e.target.value })}>
              <option value="">Choose a size</option>
              {run.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        ) : null}
        {numberBad && !out ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Number for {label}
            <input className={FIELD_CONTROL} inputMode="numeric" maxLength={3} value={answer?.number ?? ""} onChange={(e) => onAnswer({ ...answer, number: e.target.value })} />
          </label>
        ) : null}
        {left ? (
          <Button variant="secondary" type="button" aria-pressed={answer?.action === "keep"} onClick={() => onAnswer({ ...answer, action: "keep" })}>Keep {label}</Button>
        ) : null}
        <Button variant="quiet" type="button" aria-pressed={out} onClick={() => onAnswer(out ? { ...answer, action: undefined } : { ...answer, action: "leave-out" })}>
          {out ? `${label} is left out. Undo` : `Leave ${label} out`}
        </Button>
      </div>
    </li>
  );
}

/** The review before a reorder is made: what changed, what needs an answer, what validation says. */
export function ReorderReview({ preview, answers, onAnswer, onConfirm, busy }: Props) {
  const { plan, report, validation } = preview;
  const fix = plan.lines.filter((l) => l.reasons.length > 0);
  const changed = plan.lines.filter((l) => l.change !== "same" && l.reasons.length === 0);
  const ready = allSettled(plan, answers);
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-hairline p-4" data-testid="reorder-review">
      <p className="text-[15px] text-ink">
        Reordering <strong>{preview.designName}</strong> · {preview.releaseLabel}, with the {preview.source === "season" ? "players and sizes saved on the season" : "list of the earlier order"}.
        {" "}{plan.lines.length} {plan.lines.length === 1 ? "line" : "lines"}.
      </p>
      {preview.nothingChanged ? <Notice>Nothing changed since the earlier order. Press Confirm to make the new team list.</Notice> : null}
      {preview.notes.map((n) => <Notice key={n}>{n}</Notice>)}

      {changed.length > 0 ? (
        <section aria-label="What changed">
          <h4 className="text-sm font-medium text-ink">What changed</h4>
          <ul className="list-disc pl-5 text-sm text-muted">
            {changed.map((l) => (
              <li key={l.index}>{l.change === "new-player" ? `${who(l)} is new on the roster (size ${l.row.sizeLabel}).` : `${who(l)} changed from size ${l.previousSize ?? "?"} to ${l.row.sizeLabel}.`}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {fix.length > 0 ? (
        <section aria-label="Lines to fix">
          <h4 className="text-sm font-medium text-ink">{fix.length} {fix.length === 1 ? "line needs" : "lines need"} an answer</h4>
          <ul className="flex flex-col divide-y divide-hairline">
            {fix.map((l) => <FixLine key={l.index} line={l} run={plan.run} answer={answers[l.index]} onAnswer={(a) => onAnswer(l.index, a)} />)}
          </ul>
        </section>
      ) : null}

      <section aria-label="Against the earlier release">
        <h4 className="text-sm font-medium text-ink">Against the earlier release</h4>
        {report.differences.length === 0 ? <p className="text-sm text-muted">The design and the team list are the same as in the release.</p> : (
          <ul className="list-disc pl-5 text-sm text-muted">{report.differences.map((d) => <li key={d.message}>{d.message}</li>)}</ul>
        )}
        <ul className="mt-1 list-disc pl-5 text-sm text-muted">{report.notCompared.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>

      <section aria-label="Design validation">
        <h4 className="text-sm font-medium text-ink">Design validation</h4>
        <p className="text-sm text-muted">
          {validation.blockers === 0 ? "No blockers" : `${validation.blockers} ${validation.blockers === 1 ? "blocker" : "blockers"}`}
          {" "}against {validation.profileName} ({validation.profileLabel}), {validation.warnings} {validation.warnings === 1 ? "warning" : "warnings"}.
        </p>
        {validation.blockerMessages.length > 0 ? <ul className="list-disc pl-5 text-sm text-muted">{validation.blockerMessages.map((m) => <li key={m}>{m}</li>)}</ul> : null}
        {validation.blockers > 0 ? <p className="text-sm text-muted">These do not stop the team list being made. Fix them on the design before it goes to the factory.</p> : null}
      </section>

      {preview.issues.length > 0 ? (
        <Notice tone="warn">
          <ul className="list-disc pl-5">{preview.issues.map((i, n) => <li key={`${i.row}-${n}`}>{i.message}</li>)}</ul>
        </Notice>
      ) : null}

      <div>
        <Button type="button" pending={busy} disabled={busy || !ready || plan.lines.length === 0} onClick={onConfirm}>Confirm</Button>
        {!ready ? <p className="mt-2 text-sm text-muted">Answer each line above to confirm.</p> : null}
      </div>
    </div>
  );
}

