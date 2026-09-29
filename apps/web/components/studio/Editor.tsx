"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { applyDesignActionAction, restoreVersionAction } from "@/lib/projects/actions";
import type { EditorData } from "@/lib/projects/editor-data";
import { parseCmInput } from "@/lib/projects/measurement-input";
import { editMeasurementAction, resetMeasurementAction } from "@/lib/sizing";
import type { SpecAction } from "@/lib/garment";
import { DetailsForm } from "./DetailsForm";
import { History } from "./History";
import { MeasurementTables, measurementKey } from "./MeasurementTables";
import { OptionControls, fieldKey } from "./OptionControls";
import { SizesForm } from "./SizesForm";
import { useDesignChanges, type Problem } from "./useDesignChanges";

/*
 * Fabrics, colourways and artwork are part of the design but have no screen yet. They
 * arrive with later steps. The design keeps whatever they hold.
 */

type EditorProps = Readonly<{ data: EditorData }>;

const FOCUSABLE = "input:checked, input:not(:disabled), select, button";

/** Moves focus to the control a problem belongs to, or to the summary when it has none. */
const focusProblem = (problem: Problem, summary: HTMLElement | null): void => {
  const owner = problem.key && !problem.conflict
    ? document.querySelector<HTMLElement>(`[data-field="${CSS.escape(problem.key)}"]`)
    : null;
  const target = owner?.matches("input, select, button") ? owner : owner?.querySelector<HTMLElement>(FOCUSABLE);
  (target ?? summary)?.focus();
};

function Section({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-hairline bg-surface p-6">
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Editor({ data }: EditorProps) {
  const router = useRouter();
  const changes = useDesignChanges(data.version);
  const summary = useRef<HTMLDivElement>(null);
  const { problem, dropped, status, busy, run, fail } = changes;

  useEffect(() => {
    if (problem) focusProblem(problem, summary.current);
  }, [problem]);

  const errorFor = (key: string): string | null =>
    problem && !problem.conflict && problem.key === key ? problem.message : null;

  const send = (key: string | null, action: SpecAction) =>
    run(key, (expectedVersion) => applyDesignActionAction({ projectId: data.projectId, expectedVersion, action }));

  const restore = (key: string | null, version: number) =>
    run(key, (expectedVersion) => restoreVersionAction({ projectId: data.projectId, expectedVersion, version }));

  const editMeasurement = (pointId: string, text: string) => {
    const key = measurementKey(pointId);
    const typed = parseCmInput(text);
    if (!typed.ok) return fail(key, typed.reason);
    const made = editMeasurementAction(data.spec, pointId, typed.tenths, "user-edited");
    if (!made.ok) return fail(key, made.reason);
    send(key, made.action);
  };

  const resetMeasurement = (pointId: string) => {
    const made = resetMeasurementAction(data.spec, pointId);
    if (!made.ok) return fail(measurementKey(pointId), made.reason);
    send(measurementKey(pointId), made.action);
  };

  const shownDropped = dropped ?? data.dropped;
  const summaryProblem = problem && (problem.conflict || problem.key === null) ? problem : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            {data.typeLabel} for {data.wearerLabel.toLowerCase()}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{data.name}</h1>
          <p className="mt-2 text-sm text-muted">
            <span data-testid="version">Version {data.version}</span>
            {data.styleNumber ? ` · Style ${data.styleNumber}` : ""}
            {data.season ? ` · ${data.season}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={data.undoTo === null}
          onClick={() => data.undoTo !== null && restore(null, data.undoTo)}
        >
          Undo
        </Button>
      </header>

      <p role="status" className="min-h-5 text-sm text-ink-2" data-testid="save-status">
        {busy ? "Saving" : (status ?? "")}
      </p>

      {summaryProblem ? (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-lg bg-warn-wash px-4 py-3 text-sm leading-relaxed text-warn">
          <p>{summaryProblem.message}</p>
          {summaryProblem.conflict ? (
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={() => router.refresh()}>
                Reload
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {shownDropped.length > 0 ? (
        <Notice tone="warn">
          <p className="font-medium">This change removed or reset some things.</p>
          <ul className="mt-2 list-disc pl-5">
            {shownDropped.map((entry, index) => (
              <li key={`${entry.kind}-${entry.id}-${index}`}>{entry.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="options" title="Options">
            <OptionControls
              controls={data.controls}
              errorFor={errorFor}
              onChoose={(optionId, choiceId) =>
                send(fieldKey(optionId), { type: "set-option", optionId, choiceId, provenance: "user-edited" })
              }
            />
          </Section>

          <Section id="sizes" title="Sizes">
            <p className="mb-4 text-[15px] leading-relaxed text-muted">
              {data.sizes.set
                ? "The measurements below are for the base size. The other sizes are worked out from it."
                : "Add the sizes you will make. The measurements below are for the base size."}
            </p>
            <SizesForm
              initialText={data.sizes.text}
              initialBase={data.sizes.baseSize}
              isSet={data.sizes.set}
              busy={busy}
              errorFor={errorFor}
              onInvalid={fail}
              onSave={(action) => send(null, action)}
            />
          </Section>

          <Section id="measurements" title={data.table.size ? `Measurements for size ${data.table.size}` : "Measurements"}>
            <p className="mb-4 text-[15px] leading-relaxed text-muted">
              Lengths are in centimetres. Type a value to use your own. It is then marked as typed in by you.
            </p>
            <MeasurementTables
              table={data.table}
              errorFor={errorFor}
              onEdit={editMeasurement}
              onReset={resetMeasurement}
            />
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Section id="history" title="History">
            <History versions={data.versions} onRestore={(version) => restore(null, version)} />
          </Section>
          <Section id="details" title="Design details">
            <DetailsForm
              projectId={data.projectId}
              name={data.name}
              styleNumber={data.styleNumber}
              season={data.season}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}
