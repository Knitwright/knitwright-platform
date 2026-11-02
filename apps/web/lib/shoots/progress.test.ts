import { describe, expect, it } from "vitest";
import { ACCEPTANCE_COUNT, ACCEPTANCE_MS, GENERATING_PREFIX, RETRY_LINE, SHOOT_STAGES, STAGE_LABELS, estimateFor, percentOf, shootProgress, stageFromStatus } from "./progress";

/**
 * Honest progress. The two rules being tested: the bar never claims to be finished before the work
 * is, and the clock counts what has really passed.
 */

describe("the progress of a run", () => {
  it("shows F-L1's own placeholder: the word and the clock", () => {
    const progress = shootProgress({ stage: "asking", elapsedMs: 23_000 });
    expect(progress.elapsedLabel).toBe(`${GENERATING_PREFIX} 00:23`);
    expect(GENERATING_PREFIX).toBe("Generating");
  });

  it("names the stage, so a person knows what they are waiting on", () => {
    for (const stage of SHOOT_STAGES) expect(shootProgress({ stage, elapsedMs: 0 }).label).toBe(STAGE_LABELS[stage]);
    expect(STAGE_LABELS.measuring).toMatch(/Measuring the garment/);
  });

  it("never reaches the end before the work does, however long the model takes", () => {
    const late = shootProgress({ stage: "asking", elapsedMs: 10 * 60 * 1000, estimateMs: 45_000 });
    expect(late.part).toBeLessThan(1);
    expect(late.overEstimate).toBe(true);
    const saving = shootProgress({ stage: "saving", elapsedMs: 1000 });
    expect(saving.part).toBeLessThan(1);
    expect(shootProgress({ stage: "done", elapsedMs: 1000 }).part).toBe(1);
  });

  it("moves through the stages in order, never backwards", () => {
    const parts = SHOOT_STAGES.map((stage) => shootProgress({ stage, elapsedMs: 1000, estimateMs: 2000 }).part);
    expect(parts).toEqual([...parts].sort((a, b) => a - b));
  });

  it("shows the estimate as an estimate, or nothing when there is none", () => {
    expect(shootProgress({ stage: "asking", elapsedMs: 0, estimateMs: 45_000 }).estimateLabel).toBe("About 00:45 expected");
    expect(shootProgress({ stage: "asking", elapsedMs: 0 }).estimateLabel).toBeNull();
    expect(shootProgress({ stage: "asking", elapsedMs: 0, estimateMs: 0 }).part).toBeGreaterThan(0);
  });

  it("counts from zero and never backwards, whatever it is handed", () => {
    expect(shootProgress({ stage: "asking", elapsedMs: -5 }).elapsedLabel).toBe(`${GENERATING_PREFIX} 00:00`);
  });

  it("says out loud when the automatic second attempt is running", () => {
    expect(shootProgress({ stage: "asking", elapsedMs: 100, attempt: 2 }).retryLine).toBe(RETRY_LINE);
    expect(shootProgress({ stage: "asking", elapsedMs: 100 }).retryLine).toBeNull();
    expect(shootProgress({ stage: "done", elapsedMs: 100, attempt: 2 }).retryLine).toBeNull();
    expect(RETRY_LINE).toMatch(/costs you nothing/);
  });

  it("gives a screen reader the same number the bar shows", () => {
    expect(percentOf(shootProgress({ stage: "done", elapsedMs: 0 }))).toBe(100);
    expect(percentOf(shootProgress({ stage: "waiting", elapsedMs: 0 }))).toBe(0);
  });
});

describe("the stage a board's own status stands for", () => {
  it("says no more than the status really means", () => {
    expect(stageFromStatus("queued")).toBe("waiting");
    expect(stageFromStatus("running")).toBe("asking");
    expect(stageFromStatus("ready")).toBe("done");
    expect(stageFromStatus("failed")).toBe("done");
    expect(stageFromStatus("empty")).toBe("done");
  });
});

describe("how long a shoot is expected to take", () => {
  it("comes from F-L1's own acceptance test and nowhere else", () => {
    expect(ACCEPTANCE_MS).toBe(180_000);
    expect(ACCEPTANCE_COUNT).toBe(4);
    expect(estimateFor(4)).toBe(180_000);
    expect(estimateFor(1)).toBe(45_000);
    expect(estimateFor(0)).toBe(45_000);
  });
});
