import { describe, expect, it } from "vitest";
import { createSpec } from "@/lib/garment";
import { OUTCOME_KINDS, isNeverSilent, rejection, type IntentOutcome } from "./outcome";

const spec = (() => {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
})();

describe("the outcome of an instruction", () => {
  it("has exactly three kinds", () => {
    expect(OUTCOME_KINDS).toEqual(["applied", "question", "rejection"]);
  });

  it("makes a rejection from a sentence, and falls back to a plain sentence when given none", () => {
    expect(rejection("No such thing.")).toEqual({ kind: "rejection", reason: "No such thing." });
    expect(rejection("   ").reason.length).toBeGreaterThan(0);
  });

  it("counts an applied change as silent when it explains nothing", () => {
    const quiet: IntentOutcome = { kind: "applied", spec, actions: [], explanations: [], notes: [] };
    const blank: IntentOutcome = { kind: "applied", spec, actions: [], explanations: [" "], notes: [] };
    const said: IntentOutcome = { kind: "applied", spec, actions: [], explanations: ["Fit changed."], notes: [] };
    expect(isNeverSilent(quiet)).toBe(false);
    expect(isNeverSilent(blank)).toBe(false);
    expect(isNeverSilent(said)).toBe(true);
  });

  it("counts a question as silent without text, without two choices, or with a recommendation out of range", () => {
    const choices = [
      { label: "Yes", actions: [] },
      { label: "No", actions: [] },
    ];
    expect(isNeverSilent({ kind: "question", question: "Which?", choices, recommended: 0 })).toBe(true);
    expect(isNeverSilent({ kind: "question", question: "", choices, recommended: 0 })).toBe(false);
    expect(isNeverSilent({ kind: "question", question: "Which?", choices: choices.slice(0, 1), recommended: 0 })).toBe(false);
    expect(isNeverSilent({ kind: "question", question: "Which?", choices, recommended: 2 })).toBe(false);
    expect(isNeverSilent({ kind: "question", question: "Which?", choices: [{ label: " ", actions: [] }, choices[1]], recommended: 0 })).toBe(false);
  });

  it("counts a rejection as silent without a reason", () => {
    expect(isNeverSilent({ kind: "rejection", reason: "Not a garment." })).toBe(true);
    expect(isNeverSilent({ kind: "rejection", reason: "" })).toBe(false);
  });
});
