import type { BoardStatus } from "@/lib/launch";
import { clock } from "@/lib/media/video/formats";
import { ATTEMPTS_ALLOWED } from "./check";

/**
 * HONEST PROGRESS WHILE A SHOOT RUNS (spec F-L1: "Each result appears as an AI Image board with a
 * placeholder ('Generating 00:23') and a Regenerate button on hover").
 *
 * The spec asks for a clock, so the clock counts **what has really passed** -- never a guess dressed
 * as a fact -- and the model's own estimate is shown beside it as an estimate. The stages are the
 * real steps of `run.ts`, so a person waiting knows which one they are waiting on rather than
 * watching a spinner that could mean anything:
 *
 *   asking the model · looking the picture over · measuring the garment · saving.
 *
 * Two rules keep it honest. The bar **never reaches the end before the work does**, and the one
 * stage with a guess behind it is capped short of its own share, so a shoot that takes twice as long
 * as the estimate shows a bar that has slowed down rather than one that claims to be finished. And
 * the second attempt F-L1 allows is **said out loud** (`retryLine`): a person whose picture is being
 * made again should know it is being made again.
 *
 * `clock` is L5's: one mm:ss in the product, not two (`lib/media/video/formats.ts`).
 */

export const SHOOT_STAGES = ["waiting", "asking", "screening", "measuring", "saving", "done"] as const;
export type ShootStage = (typeof SHOOT_STAGES)[number];

export const STAGE_LABELS: Readonly<Record<ShootStage, string>> = {
  waiting: "Waiting to start",
  asking: "Asking the model for the scene",
  screening: "Looking the picture over",
  measuring: "Measuring the garment against your design",
  saving: "Saving the picture",
  done: "Ready",
};

/** F-L1's own words in front of the clock. */
export const GENERATING_PREFIX = "Generating";

/** The share of the bar each stage has finished by the time it ends. Knitwright defaults. */
const DONE_BY: Readonly<Record<ShootStage, number>> = { waiting: 0, asking: 0.7, screening: 0.8, measuring: 0.95, saving: 1, done: 1 };
const STARTS_AT: Readonly<Record<ShootStage, number>> = { waiting: 0, asking: 0, screening: 0.7, measuring: 0.8, saving: 0.95, done: 1 };

export interface ShootProgress {
  readonly stage: ShootStage;
  readonly label: string;
  /** 0 to 1. Never 1 before the run has really finished. */
  readonly part: number;
  /** "Generating 00:23": what has really passed. */
  readonly elapsedLabel: string;
  /** What the estimate said, or null when there is none. Always shown as an estimate. */
  readonly estimateLabel: string | null;
  /** True once the wait has gone past the estimate, so the panel can say so rather than hide it. */
  readonly overEstimate: boolean;
  /** Said out loud when this is the automatic second attempt, or null. */
  readonly retryLine: string | null;
}

export interface ProgressInput {
  readonly stage: ShootStage;
  readonly elapsedMs: number;
  readonly estimateMs?: number | null;
  /** Which attempt is running: 1, or 2 for the automatic retry. */
  readonly attempt?: number;
}

/** What a person is told while the automatic second attempt runs. */
export const RETRY_LINE = "The first picture did not keep your garment, so it is being made once more. This costs you nothing.";

/** How far through the wait on the model we are, as a share of that stage, capped short of its end. */
const askingPart = (elapsedMs: number, estimateMs: number | null): number => {
  if (!estimateMs || estimateMs <= 0) return 0.35;
  return Math.min(0.95, Math.max(0, elapsedMs / estimateMs));
};

export function shootProgress(input: ProgressInput): ShootProgress {
  const estimate = input.estimateMs ?? null;
  const elapsed = Math.max(0, input.elapsedMs);
  const start = STARTS_AT[input.stage];
  const span = DONE_BY[input.stage] - start;
  const within = input.stage === "asking" ? askingPart(elapsed, estimate) : input.stage === "done" ? 1 : 0.5;
  const attempt = input.attempt ?? 1;
  return {
    stage: input.stage,
    label: STAGE_LABELS[input.stage],
    part: input.stage === "done" ? 1 : Math.min(0.99, start + span * within),
    elapsedLabel: `${GENERATING_PREFIX} ${clock(elapsed / 1000)}`,
    estimateLabel: estimate === null ? null : `About ${clock(estimate / 1000)} expected`,
    overEstimate: estimate !== null && elapsed > estimate,
    retryLine: attempt > 1 && attempt <= ATTEMPTS_ALLOWED && input.stage !== "done" ? RETRY_LINE : null,
  };
}

/**
 * The stage a board's own status stands for. The shell knows only queued, running, ready and failed
 * (L1's board table), so a panel that did not start the run itself shows what that status really
 * means and no more.
 */
export function stageFromStatus(status: BoardStatus): ShootStage {
  if (status === "queued") return "waiting";
  if (status === "running") return "asking";
  return "done";
}

/** Whole percent for `aria-valuenow`, so a screen reader reads the same number the bar shows. */
export const percentOf = (progress: ShootProgress): number => Math.round(progress.part * 100);

/**
 * How long a shoot is expected to take, from F-L1's own acceptance test: four pictures in under
 * three minutes. Divided by the count, it is the only time figure the spec gives, and the panel
 * shows it as an estimate.
 */
export const ACCEPTANCE_MS = 3 * 60 * 1000;
export const ACCEPTANCE_COUNT = 4;

export const estimateFor = (count: number): number => Math.round((ACCEPTANCE_MS / ACCEPTANCE_COUNT) * Math.max(1, count));
