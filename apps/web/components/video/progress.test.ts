import { describe, expect, it } from "vitest";
import { STAGE_LABELS } from "./copy";
import { percentOf, runProgress, stageFromStatus, STAGES } from "./progress";

describe("honest progress", () => {
  it("names the stage, so waiting says what is happening", () => {
    for (const stage of STAGES) {
      expect(runProgress({ stage, elapsedMs: 0 }).label).toBe(STAGE_LABELS[stage]);
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(3);
    }
  });

  it("moves forward through the stages", () => {
    const parts = STAGES.map((stage) => runProgress({ stage, elapsedMs: 1000, estimateMs: 60_000 }).part);
    expect([...parts].sort((a, b) => a - b)).toEqual(parts);
  });

  it("never reaches the end before the work does", () => {
    for (const stage of STAGES.filter((one) => one !== "done")) {
      expect(runProgress({ stage, elapsedMs: 10_000_000, estimateMs: 1000 }).part, stage).toBeLessThan(1);
    }
    expect(runProgress({ stage: "done", elapsedMs: 0 }).part).toBe(1);
  });

  it("counts what has really passed, and shows the estimate as an estimate", () => {
    const progress = runProgress({ stage: "asking", elapsedMs: 7000, estimateMs: 60_000 });
    expect(progress.elapsedLabel).toBe("Generating 00:07");
    expect(progress.estimateLabel).toBe("About 01:00 expected");
    expect(progress.overEstimate).toBe(false);
  });

  it("says when the wait has gone past the estimate rather than hiding it", () => {
    expect(runProgress({ stage: "asking", elapsedMs: 90_000, estimateMs: 60_000 }).overEstimate).toBe(true);
    expect(runProgress({ stage: "asking", elapsedMs: 90_000 }).estimateLabel).toBeNull();
  });

  it("slows down rather than finishing when a model takes longer than its estimate", () => {
    const near = runProgress({ stage: "asking", elapsedMs: 59_000, estimateMs: 60_000 }).part;
    const past = runProgress({ stage: "asking", elapsedMs: 120_000, estimateMs: 60_000 }).part;
    expect(past).toBeGreaterThanOrEqual(near);
    expect(past).toBeLessThan(0.7);
  });

  it("shows something moving even for a model with no estimate at all", () => {
    expect(runProgress({ stage: "asking", elapsedMs: 0, estimateMs: null }).part).toBeGreaterThan(0);
  });

  it("holds the clock at zero for a nonsense elapsed time", () => {
    expect(runProgress({ stage: "asking", elapsedMs: -5000 }).elapsedLabel).toBe("Generating 00:00");
  });

  it("reads a board's own status as the stage it really means", () => {
    expect(stageFromStatus("queued")).toBe("waiting");
    expect(stageFromStatus("running")).toBe("asking");
    expect(stageFromStatus("ready")).toBe("done");
    expect(stageFromStatus("failed")).toBe("done");
    expect(stageFromStatus("empty")).toBe("done");
  });

  it("gives a screen reader the same whole number the bar shows", () => {
    expect(percentOf(runProgress({ stage: "waiting", elapsedMs: 0 }))).toBe(0);
    expect(percentOf(runProgress({ stage: "done", elapsedMs: 0 }))).toBe(100);
    expect(percentOf(runProgress({ stage: "checking", elapsedMs: 0 }))).toBeGreaterThan(80);
  });
});
