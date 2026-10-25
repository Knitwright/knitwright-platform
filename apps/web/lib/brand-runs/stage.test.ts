import { describe, expect, it } from "vitest";
import { canConfirm, canOrder, isStage, nextStage, STAGE_LABELS, STAGES, whyNotOrder } from "./stage";

describe("stages", () => {
  it("go idea, sample, run and only forward", () => {
    expect(STAGES).toEqual(["idea", "sample", "run"]);
    expect(nextStage("idea")).toBe("sample");
    expect(nextStage("sample")).toBe("run");
    expect(nextStage("run")).toBeNull();
    expect(STAGE_LABELS.sample).toBe("Sample");
  });
  it("recognises a stage", () => {
    expect(isStage("run")).toBe(true);
    expect(isStage("shipped")).toBe(false);
    expect(isStage(null)).toBe(false);
  });
  it("needs a sample order to move from idea to sample", () => {
    expect(canConfirm("idea", false)).toBe(false);
    expect(canConfirm("idea", true)).toBe(true);
  });
  it("lets the brand confirm the sample to reach the run", () => {
    expect(canConfirm("sample", false)).toBe(true);
    expect(canConfirm("run", true)).toBe(false);
  });
  it("orders a sample before the run stage and a run only at it", () => {
    expect(canOrder("idea", "sample")).toBe(true);
    expect(canOrder("sample", "sample")).toBe(true);
    expect(canOrder("run", "sample")).toBe(false);
    expect(canOrder("sample", "run")).toBe(false);
    expect(canOrder("run", "run")).toBe(true);
  });
  it("explains a refusal in plain words", () => {
    expect(whyNotOrder("idea", "sample")).toBeNull();
    expect(whyNotOrder("idea", "run")).toMatch(/sample first/);
    expect(whyNotOrder("run", "sample")).toMatch(/already at the run stage/);
  });
});
