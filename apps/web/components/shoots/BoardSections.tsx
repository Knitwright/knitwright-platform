"use client";

import { useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import type { BoardStatus } from "@/lib/launch";
import { CONSENT_LABEL, CONSENT_PLACEHOLDER, CONSENT_RECORDED, CONSENT_TICK, MODEL_NONE, MODEL_PRESET, MODEL_UPLOAD, consentOf, percentOf, shootProgress, stageFromStatus, type ModelSource, type ShootBoardSettings } from "@/lib/shoots";
import * as copy from "@/lib/shoots/copy";
import { alertProps, busyProps, chipProps, consentProps, generateProps, listProps, presetProps, progressProps } from "./a11y";
import type { BoardPanelView, Choice } from "./panel-model";

/**
 * The sections of the AI image board's inspector, kept out of the panel itself so neither file runs
 * past the 400 lines this repository holds a file to. Each one takes what it draws and a callback,
 * and none of them reads the shell: the panel passes the view `panel-model.ts` decided.
 */

export const SECTION = "flex flex-col gap-2";
export const H4 = "text-[13px] font-medium text-ink";
export const HINT = "text-[12px] leading-relaxed text-ink-2";
export const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] disabled:opacity-55";
export const CHOSEN = "border-cobalt-soft bg-cobalt-wash text-ink";
export const PLAIN = "border-white/20 text-ink-2";

/**
 * How long the run in front of us has really taken. Zero whenever nothing is running, so a finished
 * run's clock is never shown against the next one -- the shape `components/video/AiVideoPanel.tsx`
 * uses, including not calling setState in the effect's own body.
 */
function useElapsed(running: boolean): number {
  const [elapsedMs, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return running ? elapsedMs : 0;
}

export function EmptyState({ view, onAdd, onIdeas }: Readonly<{ view: BoardPanelView; onAdd: () => void; onIdeas: () => void }>) {
  const empty = view.empty;
  if (!empty) return null;
  const isDesign = empty.title === copy.NO_DESIGN_TITLE;
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/15 bg-white/[0.03] p-3" data-testid="shoot-empty">
      <h4 className={H4}>{empty.title}</h4>
      <p className={HINT}>{empty.body}</p>
      {empty.action === null ? null : (
        <button type="button" onClick={isDesign ? onAdd : onIdeas} disabled={view.busy} className={`${CHIP} ${PLAIN}`} data-testid="shoot-empty-action">
          {empty.action}
        </button>
      )}
    </div>
  );
}

export function Scene({ view }: Readonly<{ view: BoardPanelView }>) {
  if (view.scene === null) return null;
  return (
    <section aria-label={copy.SCENE_LABEL} className={SECTION} data-testid="shoot-scene">
      <div className="flex items-baseline justify-between gap-2">
        <span className={H4}>{view.scene.title}</span>
        <span className="text-[12px] text-ink-2">{view.cropLabel}</span>
      </div>
      <p className={HINT}>{view.scene.lighting}</p>
      <p className={HINT}>{view.scene.note}</p>
    </section>
  );
}

/** The waiting state: which step, how long it has really taken, and the estimate beside it. */
export function Waiting({ view, status }: Readonly<{ view: BoardPanelView; status: BoardStatus }>) {
  const running = status === "running" || status === "queued";
  const elapsedMs = useElapsed(running);
  if (!running) return null;
  const progress = shootProgress({ stage: stageFromStatus(status), elapsedMs, estimateMs: view.estimateMs });
  const percent = percentOf(progress);
  return (
    <div className={SECTION} data-testid="shoot-waiting">
      <div {...progressProps(percent, progress.label)} className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cobalt" style={{ width: `${percent}%` }} />
      </div>
      <p {...busyProps()} className={HINT}>
        {progress.elapsedLabel} · {progress.label}
        {progress.estimateLabel === null ? "" : ` · ${progress.estimateLabel}`}
      </p>
      {progress.retryLine === null ? null : <p className={HINT}>{progress.retryLine}</p>}
    </div>
  );
}

type ModelProps = Readonly<{
  view: BoardPanelView;
  settings: ShootBoardSettings;
  consentRef: string;
  consentId: string;
  onRef: (value: string) => void;
  onChange: (next: Partial<ShootBoardSettings>) => void;
}>;

/** The model: nobody, a licensed preset, or the brand's own with the consent they record here. */
export function Model({ view, settings, consentRef, consentId, onRef, onChange }: ModelProps) {
  const sources: readonly Choice<ModelSource>[] = [
    { value: "none", label: MODEL_NONE, selected: settings.modelSource === "none" },
    { value: "preset", label: MODEL_PRESET, selected: settings.modelSource === "preset" },
    { value: "upload", label: MODEL_UPLOAD, selected: settings.modelSource === "upload" },
  ];
  return (
    <section aria-label={copy.MODEL_HEADING} className={SECTION} data-testid="shoot-model">
      <span className={H4}>{copy.MODEL_HEADING}</span>
      <p className={HINT}>{view.modelLead}</p>
      <ul {...listProps(copy.MODEL_HEADING)} className="flex flex-wrap gap-1.5">
        {sources.map((one) => (
          <li key={one.value} role="listitem">
            <button
              {...chipProps("model", one.label, one.selected)}
              disabled={view.busy}
              onClick={() => onChange({ modelSource: one.value })}
              className={`${CHIP} ${one.selected ? CHOSEN : PLAIN}`}
              data-testid={`shoot-model-${one.value}`}
            >
              {one.label}
            </button>
          </li>
        ))}
      </ul>

      {settings.modelSource === "preset" ? (
        <ul {...listProps("Model presets")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {view.presets.map((preset) => (
            <li key={preset.key} role="listitem">
              <button
                {...presetProps(preset.usable, preset.selected)}
                onClick={() => onChange({ modelPresetKey: preset.key })}
                className={`flex w-full flex-col items-start gap-1 rounded-2xl border px-3 py-2 text-left ${preset.selected ? CHOSEN : PLAIN}`}
                data-testid={`shoot-preset-${preset.key}`}
              >
                <span className="text-[13px] text-ink">{preset.label}</span>
                <span className="text-[11px] text-ink-2">{preset.lead}</span>
                <span className="text-[11px] text-ink-2">{preset.licence}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {settings.modelSource === "upload" ? (
        <div className={SECTION} data-testid="shoot-consent">
          <label htmlFor={`${consentId}-ref`} className={HINT}>
            {CONSENT_LABEL}
          </label>
          <input
            id={`${consentId}-ref`}
            type="text"
            value={settings.consent?.ref ?? consentRef}
            placeholder={CONSENT_PLACEHOLDER}
            disabled={view.busy || settings.consent !== null}
            onChange={(event) => onRef(event.target.value)}
            className={`${FIELD_CONTROL} w-full`}
            data-testid="shoot-consent-ref"
          />
          <div className="flex items-start gap-2">
            <input
              {...consentProps(consentId, settings.consent !== null)}
              disabled={view.busy || (consentRef.trim() === "" && settings.consent === null)}
              onChange={(event) => onChange({ consent: event.target.checked ? consentOf(consentRef, new Date()) : null })}
              className="mt-1 size-4 rounded border-hairline"
              data-testid="shoot-consent-tick"
            />
            <label htmlFor={consentId} id={`${consentId}-statement`} className={HINT}>
              {CONSENT_TICK}
            </label>
          </div>
          {settings.consent === null ? null : (
            <p className={HINT} data-testid="shoot-consent-recorded">
              {CONSENT_RECORDED(settings.consent.givenAt)}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

type ChipsProps<T extends string> = Readonly<{
  label: string;
  group: string;
  choices: readonly Choice<T>[];
  busy: boolean;
  onPick: (value: T) => void;
}>;

export function Chips<T extends string>({ label, group, choices, busy, onPick }: ChipsProps<T>) {
  if (choices.length === 0) return null;
  return (
    <div className={SECTION} data-testid={`shoot-${group}s`}>
      <span className={H4}>{label}</span>
      <ul {...listProps(label)} className="flex flex-wrap gap-1.5">
        {choices.map((one) => (
          <li key={one.value} role="listitem">
            <button
              {...chipProps(group, one.label, one.selected)}
              disabled={busy}
              onClick={() => onPick(one.value)}
              className={`${CHIP} ${one.selected ? CHOSEN : PLAIN}`}
              data-testid={`shoot-${group}-${one.value}`}
            >
              {one.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The cost is in the button's own visible words, and the reason it cannot run is beside it. */
export function Run({ view, reasonId, onRun }: Readonly<{ view: BoardPanelView; reasonId: string; onRun: () => void }>) {
  return (
    <div className={SECTION} data-testid="shoot-run">
      <button
        {...generateProps(view.run.disabled, view.run.reason === null ? null : reasonId)}
        onClick={onRun}
        className={`${CHIP} ${view.run.disabled ? PLAIN : CHOSEN} justify-center`}
        data-testid="shoot-generate"
      >
        {view.run.label}
      </button>
      {view.run.reason === null ? null : (
        <p id={reasonId} {...alertProps()} className={HINT} data-testid="shoot-run-reason">
          {view.run.reason}
        </p>
      )}
      <button type="button" disabled={view.regenerate.disabled} onClick={onRun} className={`${CHIP} ${PLAIN} justify-center`} data-testid="shoot-regenerate">
        {view.regenerate.label}
      </button>
      <p className={HINT}>{view.regenerate.hint}</p>
    </div>
  );
}

/** The picture, its label, and -- when the checker turned it away -- what happened and what to do. */
export function Result({ view }: Readonly<{ view: BoardPanelView }>) {
  if (view.result === null) return null;
  return (
    <section aria-label={copy.RESULT_HEADING} className={SECTION} data-testid="shoot-result">
      <span className={H4}>{copy.RESULT_HEADING}</span>
      <p className="text-[12px] font-medium text-ink" data-testid="shoot-result-label">
        {view.result.label}
      </p>
      {view.result.kept ? (
        <>
          <p className={HINT}>{copy.CHECKER_LEAD}</p>
          <p className={HINT}>{view.result.advice}</p>
          <span className={H4}>{copy.EDITS_HEADING}</span>
          <ul {...listProps(copy.EDITS_HEADING)} className="flex flex-wrap gap-1.5">
            {view.edits.map((edit) => (
              <li key={edit.action} role="listitem">
                <span className={`${CHIP} ${PLAIN}`} data-testid={`shoot-edit-${edit.action}`}>
                  {edit.label}
                  {edit.paid ? <span className="ml-1 text-[11px] text-ink-2">· costs credits</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Notice tone="warn" role="alert">
          {view.result.failure}
        </Notice>
      )}
    </section>
  );
}
