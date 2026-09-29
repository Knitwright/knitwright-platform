import { describe, expect, it } from "vitest";
import { modelEntry } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import { evaluateText, selectModel, type EvalReport } from "./live-eval";
import { recordingSchema, type GoldenCase } from "./replay";

const cases: GoldenCase[] = [
  { id: "c1", category: "fit", utterance: "slim fit", start: { typeId: "crew-tee" }, expected: { kind: "applied", options: { fit: "slim" } }, approved: false },
  { id: "c2", category: "fit", utterance: "less tight please", start: { typeId: "crew-tee" }, expected: { kind: "applied", options: { fit: "relaxed" } }, approved: false },
  { id: "c3", category: "off", utterance: "write me a poem", start: { typeId: "crew-tee" }, expected: { kind: "rejection" }, approved: false },
];

const relaxed = JSON.stringify({ kind: "changes", actions: [{ type: "set-option", optionId: "fit", choiceId: "relaxed" }] });
const refuse = JSON.stringify({ kind: "rejection", reason: "Not about the garment." });

describe("the live evaluation harness", () => {
  it("runs every case the way the product does, scores it, prices it, and records the replies", async () => {
    const entry = modelEntry("claude-haiku-4-5");
    const report = await evaluateText({ cases, provider: createStubProvider([relaxed, refuse], "claude-haiku-4-5"), entry, date: "2026-10-01" });
    expect(report.summary).toMatchObject({ total: 3, correct: 3, neverSilent: 3 });
    expect(report.accuracy).toBe(1);
    expect(report.answeredByRules).toBe(1);
    expect(report.model).toBe("claude-haiku-4-5");
    expect(report.date).toBe("2026-10-01");
    expect(report.costMicrodollars).toBeGreaterThan(0);
    expect(report.costPerRequestMicrodollars).toBeCloseTo(report.costMicrodollars / 3);
    const recording = recordingSchema.parse(report.recording);
    expect(recording.synthetic).toBe(false);
    expect(recording.responses).toEqual({ c1: { kind: "changes", actions: [{ type: "set-option", optionId: "fit", choiceId: "slim" }] }, c2: relaxed, c3: refuse });
  });

  it("counts a failed call as wrong and keeps going", async () => {
    const report = await evaluateText({ cases, provider: createStubProvider([new ModelCallError("down"), refuse]), entry: modelEntry("gpt-5-nano"), date: "d" });
    expect(report.summary.correct).toBe(2);
    expect(report.failures).toEqual(["c2"]);
  });
});

describe("choosing a model", () => {
  const report = (model: string, accuracy: number): EvalReport => ({ model, accuracy }) as EvalReport;

  it("tries candidates from cheapest to dearest and stops at the first that meets the target", async () => {
    const tried: string[] = [];
    const result = await selectModel(["gpt-5-nano", "claude-haiku-4-5", "claude-sonnet-5-5"], 0.9, async (id) => {
      tried.push(id);
      return report(id, id === "claude-haiku-4-5" ? 0.93 : 0.8);
    });
    expect(result.chosen).toBe("claude-haiku-4-5");
    expect(tried).toEqual(["gpt-5-nano", "claude-haiku-4-5"]);
    expect(result.reports.map((entry) => entry.model)).toEqual(tried);
  });

  it("chooses none when no candidate meets the target", async () => {
    const result = await selectModel(["gpt-5-nano"], 0.9, async (id) => report(id, 0.5));
    expect(result.chosen).toBeNull();
  });
});
