"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { BoardStatus, BoardView, LaunchPanelProps } from "@/lib/launch";
import { readBoardSettings, writeBoardSettings, type AiVideoSettings } from "@/lib/media/video/ai-board";
import { DURATION_BOUNDS, durationVerdict, type VideoAspect } from "@/lib/media/video/formats";
import { PLACEHOLDER_MODEL_CONFIG, unknownModelKeys, videoModelsFrom, type VideoModel } from "@/lib/media/video/models";
import type { PresetKey } from "@/lib/media/video/prompt-presets";
import * as copy from "./copy";
import { panelView, type ModelCard, type PanelView } from "./panel-model";
import { percentOf, runProgress, stageFromStatus } from "./progress";
import { VideoPlayer } from "./VideoPlayer";

/**
 * THE AI VIDEO BOARD'S INSPECTOR PANEL: panel id `board-ai-video` of L1's contract.
 *
 * A default export taking exactly `LaunchPanelProps`, so the shell can load it with `next/dynamic`.
 * It asks and never writes: every change goes to `setBoardSettings` and every run to `requestRun`, so
 * the shell checks the garment lock and shows the cost before anything is spent.
 *
 * What it decides is in `panel-model.ts` and `progress.ts`, which are tested against `panelDouble()`
 * with no shell and no browser. This file is markup, keyboard order and labels.
 */

const SECTION = "flex flex-col gap-2";
const H4 = "text-[13px] font-medium text-ink";
const HINT = "text-[12px] leading-relaxed text-ink-2";
const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-ink disabled:opacity-55";
const CHOSEN = "border-cobalt-soft bg-cobalt-wash";
const FIELD =
  "min-h-10 w-full rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:opacity-55";

/** The models an admin has configured. Until one has, the labelled placeholder list. */
const MODELS: readonly VideoModel[] = videoModelsFrom(PLACEHOLDER_MODEL_CONFIG);
const UNKNOWN: readonly string[] = unknownModelKeys(PLACEHOLDER_MODEL_CONFIG);

export default function AiVideoPanel({ context, commands }: LaunchPanelProps) {
  const board = context.selection?.board ?? null;
  const saved = readBoardSettings(board?.settings ?? {});
  const promptId = useId();
  // The prompt is typed into, so it is held locally and saved when the field is left. It is kept
  // against the board it belongs to, so selecting another board shows that board's own words rather
  // than what was typed into the last one.
  const [draft, setDraft] = useState<Readonly<{ boardId: string; text: string }> | null>(null);
  const prompt = draft && board && draft.boardId === board.id ? draft.text : saved.prompt;

  const view = panelView({ context, settings: saved, models: MODELS, creditsEnforced: false, unknownModels: UNKNOWN });
  const change = (next: Partial<AiVideoSettings>): void => {
    if (board) commands.setBoardSettings(board.id, writeBoardSettings({ ...saved, ...next }));
  };

  return (
    <section aria-label={copy.PANEL_HEADING} data-testid="video-panel" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-[15px] font-medium text-ink">{copy.PANEL_HEADING}</h3>
        <p className={HINT}>{copy.PANEL_LEAD}</p>
      </header>

      {view.empty ? (
        <EmptyState view={view} onAdd={() => board && commands.addBoard("mockup", { x: board.at.x - 320, y: board.at.y }, board.id)} />
      ) : (
        <>
          <Frames view={view} />
          <Presets view={view} busy={view.busy} onPick={(presetKey) => change({ presetKey })} />
          <div className={SECTION}>
            <label htmlFor={promptId} className={H4}>
              {copy.PROMPT_LABEL}
            </label>
            <textarea
              id={promptId}
              value={prompt}
              rows={3}
              maxLength={400}
              disabled={view.busy}
              onChange={(event) => board && setDraft({ boardId: board.id, text: event.target.value })}
              onBlur={() => {
                change({ prompt });
                setDraft(null);
              }}
              aria-describedby={`${promptId}-hint`}
              className={`${FIELD} py-2 leading-relaxed`}
              data-testid="video-prompt"
            />
            <p id={`${promptId}-hint`} className={HINT}>
              {copy.PROMPT_HINT}
            </p>
          </div>
          <Models view={view} onPick={(modelKey) => change({ modelKey })} />
          <Shape view={view} onAspect={(aspect) => change({ aspect })} onSeconds={(seconds) => change({ seconds })} onAudio={(audio) => change({ audio })} />
          <Run view={view} board={board} onRun={() => board && commands.requestRun(board.id)} />
          {board?.status === "ready" && board.outputFileId ? <VideoPlayer fileId={board.outputFileId} seconds={saved.seconds} /> : null}
        </>
      )}

      <footer className="flex flex-col gap-1.5">
        {view.notes.map((note) => (
          <p key={note} className={HINT}>
            {note}
          </p>
        ))}
      </footer>
    </section>
  );
}

function EmptyState({ view, onAdd }: Readonly<{ view: PanelView; onAdd: () => void }>) {
  const empty = view.empty;
  if (!empty) return null;
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/15 bg-white/[0.03] p-3" data-testid="video-empty">
      <h4 className={H4}>{empty.title}</h4>
      <p className={HINT}>{empty.line}</p>
      {empty === copy.EMPTY_NO_FRAME ? (
        <button type="button" onClick={onAdd} disabled={view.busy} className={CHIP} data-testid="video-add-mockup">
          {empty.action}
        </button>
      ) : null}
    </div>
  );
}

function Frames({ view }: Readonly<{ view: PanelView }>) {
  return (
    <section aria-label="Frames" className={SECTION} data-testid="video-frames">
      {[view.frames.first, view.frames.end].map((frame) => (
        <div key={frame.label} className="flex flex-col gap-1 rounded-2xl border border-white/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className={H4}>{frame.label}</span>
            <span className="text-[12px] text-ink-2">{frame.from ?? "—"}</span>
          </div>
          {frame.line ? <p className={HINT}>{frame.line}</p> : null}
        </div>
      ))}
    </section>
  );
}

function Presets({ view, busy, onPick }: Readonly<{ view: PanelView; busy: boolean; onPick: (key: PresetKey) => void }>) {
  return (
    <fieldset className={SECTION} disabled={busy} data-testid="video-presets">
      <legend className={H4}>{copy.PRESETS_HEADING}</legend>
      <p className={HINT}>{copy.PRESETS_LEAD}</p>
      <ul className="flex flex-wrap gap-2">
        {view.presets.map((preset) => (
          <li key={preset.key}>
            <button
              type="button"
              aria-pressed={preset.selected}
              title={preset.lead}
              onClick={() => onPick(preset.key)}
              className={`${CHIP} ${preset.selected ? CHOSEN : ""}`}
            >
              {preset.label}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function Models({ view, onPick }: Readonly<{ view: PanelView; onPick: (key: string) => void }>) {
  const name = useId();
  return (
    <fieldset className={SECTION} disabled={view.busy} data-testid="video-models">
      <legend className={H4}>{copy.MODELS_HEADING}</legend>
      <p className={HINT}>{copy.MODELS_LEAD}</p>
      {view.modelsLine ? <p className={HINT}>{view.modelsLine}</p> : null}
      <ul className="flex flex-col gap-2">
        {view.models.map((model) => (
          <li key={model.key}>
            <ModelRow model={model} name={name} onPick={onPick} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function ModelRow({ model, name, onPick }: Readonly<{ model: ModelCard; name: string; onPick: (key: string) => void }>) {
  const id = `${name}-${model.key}`;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-3 py-2 ${model.selected ? CHOSEN : "border-white/10"}`}>
      <input
        type="radio"
        id={id}
        name={name}
        value={model.key}
        checked={model.selected}
        onChange={() => onPick(model.key)}
        className="mt-1 size-4 shrink-0 accent-cobalt-soft"
      />
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-ink">{model.label}</span>
        <span className={HINT}>{model.lead}</span>
        <span className={HINT}>
          {model.price} · {model.wait}
        </span>
        <span className={model.commercialLicence ? "text-[12px] text-ok" : "text-[12px] text-warn"}>{model.licence}</span>
      </label>
    </div>
  );
}

type ShapeProps = Readonly<{
  view: PanelView;
  onAspect: (aspect: VideoAspect) => void;
  onSeconds: (seconds: number) => void;
  onAudio: (audio: boolean) => void;
}>;

function Shape({ view, onAspect, onSeconds, onAudio }: ShapeProps) {
  const ids = { seconds: useId(), audio: useId() };
  // What was typed, until it is a length the spec allows. A length outside the range is refused with
  // the bounds in the message, never quietly turned into one that is allowed (decision 0091, item 7).
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? String(view.duration.seconds);
  const verdict = durationVerdict(Number(shown));
  return (
    <section aria-label="Shape" className={SECTION}>
      <fieldset disabled={view.busy} className={SECTION} data-testid="video-aspects">
        <legend className={H4}>{copy.ASPECT_HEADING}</legend>
        <ul className="flex flex-wrap gap-2">
          {view.aspects.map((choice) => (
            <li key={choice.aspect}>
              <button type="button" aria-pressed={choice.selected} onClick={() => onAspect(choice.aspect)} className={`${CHIP} ${choice.selected ? CHOSEN : ""}`}>
                {choice.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className={SECTION}>
        <label htmlFor={ids.seconds} className={H4}>
          {copy.DURATION_LABEL}
        </label>
        <input
          id={ids.seconds}
          type="number"
          inputMode="numeric"
          min={DURATION_BOUNDS.minSeconds}
          max={DURATION_BOUNDS.maxSeconds}
          step={1}
          value={shown}
          disabled={view.busy}
          aria-invalid={verdict.ok ? undefined : true}
          onChange={(event) => {
            setTyped(event.target.value);
            const given = durationVerdict(Number(event.target.value));
            if (given.ok) onSeconds(given.seconds);
          }}
          onBlur={() => setTyped(null)}
          aria-describedby={`${ids.seconds}-hint`}
          className={FIELD}
          data-testid="video-seconds"
        />
        <p id={`${ids.seconds}-hint`} className={HINT}>
          {view.duration.min} to {view.duration.max}. {view.duration.note}.
        </p>
        {verdict.ok ? null : (
          <p role="alert" className="text-[12px] leading-relaxed text-warn" data-testid="video-seconds-error">
            {verdict.reason}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <input
            id={ids.audio}
            type="checkbox"
            checked={view.audio.on}
            disabled={view.busy || !view.audio.available}
            onChange={(event) => onAudio(event.target.checked)}
            className="size-5 shrink-0 accent-cobalt-soft"
            data-testid="video-audio"
          />
          <label htmlFor={ids.audio} className="text-[13px] text-ink">
            {copy.AUDIO_LABEL}
          </label>
        </div>
        {view.audio.note ? <p className={HINT}>{view.audio.note}</p> : null}
      </div>
    </section>
  );
}

type RunProps = Readonly<{ view: PanelView; board: BoardView | null; onRun: () => void }>;

/** The wait, with a clock that counts what has really passed rather than a spinner. */
function useElapsed(running: boolean): number {
  const [elapsedMs, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(timer);
  }, [running]);
  // Zero whenever nothing is running, so a finished run's clock is never shown against the next one.
  return running ? elapsedMs : 0;
}

function Run({ view, board, onRun }: RunProps) {
  const status: BoardStatus = board?.status ?? "empty";
  const running = status === "queued" || status === "running";
  const elapsedMs = useElapsed(running);
  const progress = runProgress({ stage: stageFromStatus(status), elapsedMs, estimateMs: view.estimateMs });
  const reasonId = useId();
  return (
    <section aria-label={copy.RUN_HEADING} className={SECTION} data-testid="video-run">
      <Button type="button" onClick={onRun} disabled={view.run.disabled} aria-describedby={view.run.reason ? reasonId : undefined} data-testid="video-generate">
        {view.run.label}
      </Button>
      {view.run.reason ? (
        <p id={reasonId} role="status" className={HINT} data-testid="video-run-reason">
          {view.run.reason}
        </p>
      ) : null}
      {running ? (
        <div className="flex flex-col gap-1" data-testid="video-progress">
          <div
            role="progressbar"
            aria-valuenow={percentOf(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progress.label}
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          >
            <span className="block h-full rounded-full bg-cobalt-soft" style={{ width: `${percentOf(progress)}%` }} />
          </div>
          <p role="status" className={HINT}>
            {progress.label}. {progress.elapsedLabel}
            {progress.estimateLabel ? `. ${progress.estimateLabel}` : ""}
          </p>
        </div>
      ) : null}
      {status === "failed" ? (
        <Notice tone="warn" role="alert">
          <strong className="block">{copy.FAILED_TITLE}</strong>
          {copy.FAILED_COST_LINE} {copy.FAILED_WHAT_NEXT}
        </Notice>
      ) : null}
    </section>
  );
}
