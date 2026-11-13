"use client";

import { useId } from "react";
import { PROMPT_PLACEHOLDER, type LaunchPanelProps } from "@/lib/launch";
import { PROMPT_BAR } from "./slots";

type Props = Readonly<{
  panel: LaunchPanelProps;
  prompt: string;
  busy: boolean;
  /** "Run ⓒ 4" for the selected board, or null when nothing is selected. */
  runLabel: string | null;
  canRun: boolean;
  /** The selected board's estimate, said under the pill when it costs anything. */
  note: string | null;
  onPrompt: (prompt: string) => void;
  onRun: () => void;
}>;

/**
 * THE PROMPT PILL over the dock (`08` §5.1; prototype e01; decision 0146). E5 builds the prompt bar
 * of e34 and mounts it through `PROMPT_BAR` (`slots.ts`); until it does, this is the launch shell's
 * prompt field with the selected board's Run button and its cost, as before.
 */
export function PromptPill({ panel, prompt, busy, runLabel, canRun, note, onPrompt, onRun }: Props) {
  const promptId = useId();
  const Bar = PROMPT_BAR;
  if (Bar !== null) return <Bar {...panel} />;
  return (
    <div className="pointer-events-auto flex w-full max-w-180 flex-col gap-1">
      <div className="flex items-center gap-2 rounded-prompt border border-border bg-bg px-4.5 py-2.5 shadow-e1">
        <label htmlFor={promptId} className="sr-only">
          {PROMPT_PLACEHOLDER}
        </label>
        <input
          id={promptId}
          value={prompt}
          disabled={busy}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder={`${PROMPT_PLACEHOLDER}`}
          className="h-9 min-w-0 flex-1 bg-transparent text-body-lg text-text outline-none placeholder:text-muted"
          data-testid="launch-prompt"
        />
        {runLabel ? (
          <button
            type="button"
            disabled={busy || !canRun}
            onClick={onRun}
            className="h-9 shrink-0 rounded-md bg-navy px-3.5 text-body font-semibold text-on-dark hover:bg-navy-2 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="launch-run"
          >
            {runLabel}
          </button>
        ) : null}
      </div>
      {note ? <p className="px-4 text-caption text-muted">{note}</p> : null}
    </div>
  );
}
