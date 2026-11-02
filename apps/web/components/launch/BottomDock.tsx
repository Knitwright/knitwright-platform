"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import {
  DOCK_TOOLS,
  PROMPT_PLACEHOLDER,
  TOOLS,
  toolKeyTarget,
  zoomIn,
  zoomOut,
  type DockTool,
  type RunEstimate,
} from "@/lib/launch";
import { DockIcon } from "./LaunchIcon";

type Props = Readonly<{
  tool: DockTool;
  zoom: number;
  credits: number | null;
  /** The estimate for the selected board, or null when nothing is selected. */
  estimate: RunEstimate | null;
  runLabel: string | null;
  canRun: boolean;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  prompt: string;
  onPrompt: (prompt: string) => void;
  onTool: (tool: DockTool) => void;
  onZoom: (percent: number) => void;
  onRun: () => void;
  onUndo: () => void;
  onRedo: () => void;
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[13px] text-ink disabled:cursor-not-allowed disabled:opacity-55";

/**
 * What undo reaches, said on the button itself. Adding or removing a board, and a connector, are
 * changes to the canvas rather than to a board, and each has its own control (decision 0091).
 */
const UNDO_TITLE =
  "Undo covers a board's place, size, name and settings, and the project's unit and colours. Adding or removing a board, or a connector, is undone with its own control.";

/**
 * The bottom of the shell (spec Launch shell, "Bottom centre"): the prompt pill, the tool dock,
 * undo and redo, the zoom and the credit balance.
 *
 * The Run button carries its cost before anything is spent, which is the spec's own rule for every
 * Generate. The balance beside it is the brand's; where it could not be read the shell says so
 * rather than showing a nought, because charging against a balance nobody read is worse than
 * asking again.
 */
export function BottomDock(props: Props) {
  const promptId = useId();
  const tabs = useRef(new Map<DockTool, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = toolKeyTarget(props.tool, event.key);
    if (!target) return;
    event.preventDefault();
    props.onTool(target);
    tabs.current.get(target)?.focus();
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-3xl px-3 py-2" data-testid="launch-dock">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={promptId} className="sr-only">
          {PROMPT_PLACEHOLDER}
        </label>
        <input
          id={promptId}
          value={props.prompt}
          disabled={props.busy}
          onChange={(event) => props.onPrompt(event.target.value)}
          placeholder={`✦ ${PROMPT_PLACEHOLDER}`}
          className="min-h-11 min-w-56 flex-1 rounded-full border border-white/15 bg-surface px-4 text-[13px] text-ink"
          data-testid="launch-prompt"
        />
        {props.runLabel ? (
          <button type="button" disabled={props.busy || !props.canRun} onClick={props.onRun} className={CHIP} data-testid="launch-run">
            {props.runLabel}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Tools" aria-orientation="horizontal" onKeyDown={move} className="flex gap-1 rounded-full bg-tile-2/90 p-1" data-testid="launch-tools">
          {DOCK_TOOLS.map((id) => {
            const selected = id === props.tool;
            return (
              <button
                key={id}
                ref={(element) => {
                  if (element) tabs.current.set(id, element);
                  else tabs.current.delete(id);
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                title={TOOLS[id].hint}
                onClick={() => props.onTool(id)}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium ${
                  selected ? "bg-cobalt text-white" : "text-chalk-muted hover:text-ink"
                }`}
              >
                <DockIcon tool={id} size={16} />
                <span className="sr-only sm:not-sr-only">{TOOLS[id].label}</span>
              </button>
            );
          })}
        </div>

        <button type="button" title={UNDO_TITLE} disabled={props.busy || !props.canUndo} onClick={props.onUndo} className={CHIP} data-testid="launch-undo">
          Undo
        </button>
        <button type="button" title={UNDO_TITLE} disabled={props.busy || !props.canRedo} onClick={props.onRedo} className={CHIP} data-testid="launch-redo">
          Redo
        </button>

        <div role="group" aria-label="Zoom" className="flex items-center gap-1">
          <button type="button" onClick={() => props.onZoom(zoomOut(props.zoom))} className={CHIP} data-testid="zoom-out">
            <span className="sr-only">Zoom out</span>
            <span aria-hidden="true">−</span>
          </button>
          <output className="min-w-14 text-center font-mono text-[12px] text-ink-2" data-testid="zoom-percent">
            {props.zoom}%
          </output>
          <button type="button" onClick={() => props.onZoom(zoomIn(props.zoom))} className={CHIP} data-testid="zoom-in">
            <span className="sr-only">Zoom in</span>
            <span aria-hidden="true">+</span>
          </button>
        </div>

        <p className="ml-auto text-[12px] text-chalk-muted" data-testid="launch-credits">
          {props.credits === null ? "Credit balance not read" : `${props.credits} credits`}
          {props.estimate && props.estimate.credits > 0 ? ` · ${props.estimate.note}` : ""}
        </p>
      </div>
    </div>
  );
}
