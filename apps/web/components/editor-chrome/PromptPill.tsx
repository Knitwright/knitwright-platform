"use client";

import { PROMPT_BAR, type PromptSlotProps } from "./slots";

type Props = Readonly<{
  bar: PromptSlotProps;
  busy: boolean;
  /** "Run ⓒ 4" for the selected board, or null when nothing is selected. */
  runLabel: string | null;
  canRun: boolean;
  /** The selected board's estimate, said under the bar when it costs anything. */
  note: string | null;
  onRun: () => void;
}>;

/**
 * THE PROMPT AREA over the dock (`08` §5.1, prototype e01 and e34; decisions 0146 and 0149): E5's
 * prompt bar, mounted through `PROMPT_BAR` (`slots.ts`), and beside it the selected board's own Run
 * button with its cost, which the launch shell's prompt pill carried before -- so a board can still
 * be run, and says why it cannot, from the bottom of the canvas.
 */
export function PromptPill({ bar, busy, runLabel, canRun, note, onRun }: Props) {
  const Bar = PROMPT_BAR;
  return (
    <div className="pointer-events-auto flex w-full max-w-180 flex-col items-center gap-1">
      <div className="flex w-full items-end justify-center gap-2">
        <div className="min-w-0 flex-1">
          <Bar {...bar} />
        </div>
        {runLabel ? (
          <button
            type="button"
            disabled={busy || !canRun}
            onClick={onRun}
            className="h-11 shrink-0 rounded-md bg-navy px-3.5 text-body font-semibold text-on-dark shadow-e1 hover:bg-navy-2 disabled:cursor-not-allowed disabled:opacity-40"
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
