import type { BoardStatus } from "@/lib/launch";
import { clock } from "@/lib/media/video/formats";
import { GENERATING_PREFIX, STAGE_LABELS } from "./copy";

/**
 * HONEST PROGRESS, because video is the slowest thing in the product.
 *
 * A spinner says only "something is happening". These stages say which one: asking the model, taking
 * frames out of what came back, checking the garment in every frame, saving. Two rules keep it honest:
 *
 *   * the bar **never reaches the end before the work does**. The only stage with a guess behind it is
 *     the wait on the model, and that guess is capped below the end of its own share, so a model that
 *     takes twice as long as its estimate shows a bar that has slowed down, not one that is finished;
 *   * the clock counts **what has really passed**, and an estimate is shown as an estimate beside it.
 */

export const STAGES = ["waiting", "asking", "sampling", "checking", "saving", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** The share of the bar each stage has finished by the time it ends. Knitwright defaults. */
const DONE_BY: Readonly<Record<Stage, number>> = { waiting: 0, asking: 0.7, sampling: 0.8, checking: 0.95, saving: 1, done: 1 };

const STARTS_AT: Readonly<Record<Stage, number>> = { waiting: 0, asking: 0, sampling: 0.7, checking: 0.8, saving: 0.95, done: 1 };

export interface RunProgress {
  readonly stage: Stage;
  /** The words for the stage, for the status line and for the bar's label. */
  readonly label: string;
  /** 0 to 1. Never 1 before the run has really finished. */
  readonly part: number;
  /** "Generating 00:07": what has really passed. */
  readonly elapsedLabel: string;
  /** What the model's own estimate said, or null when there is none. Always shown as an estimate. */
  readonly estimateLabel: string | null;
  /** True once the wait has gone past the estimate, so the panel can say so rather than hide it. */
  readonly overEstimate: boolean;
}

export interface ProgressInput {
  readonly stage: Stage;
  readonly elapsedMs: number;
  /** The model's own estimate of the whole wait, in milliseconds, or null. */
  readonly estimateMs?: number | null;
}

/** How far through the wait on the model we are, as a share of that stage, capped short of its end. */
function askingPart(elapsedMs: number, estimateMs: number | null): number {
  if (!estimateMs || estimateMs <= 0) return 0.35;
  return Math.min(0.95, Math.max(0, elapsedMs / estimateMs));
}

export function runProgress(input: ProgressInput): RunProgress {
  const estimate = input.estimateMs ?? null;
  const elapsed = Math.max(0, input.elapsedMs);
  const start = STARTS_AT[input.stage];
  const span = DONE_BY[input.stage] - start;
  const within = input.stage === "asking" ? askingPart(elapsed, estimate) : input.stage === "done" ? 1 : 0.5;
  return {
    stage: input.stage,
    label: STAGE_LABELS[input.stage],
    part: input.stage === "done" ? 1 : Math.min(0.99, start + span * within),
    elapsedLabel: `${GENERATING_PREFIX} ${clock(elapsed / 1000)}`,
    estimateLabel: estimate === null ? null : `About ${clock(estimate / 1000)} expected`,
    overEstimate: estimate !== null && elapsed > estimate,
  };
}

/**
 * The stage a board's own status stands for. The shell knows only queued, running, ready and failed
 * (L1's board table), so a panel that has not started the run itself shows the stage that status
 * really means and no more.
 */
export function stageFromStatus(status: BoardStatus): Stage {
  if (status === "queued") return "waiting";
  if (status === "running") return "asking";
  return "done";
}

/** Whole percent for `aria-valuenow`, so a screen reader reads the same number the bar shows. */
export const percentOf = (progress: RunProgress): number => Math.round(progress.part * 100);
