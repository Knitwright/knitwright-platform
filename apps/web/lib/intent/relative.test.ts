import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec } from "@/lib/garment";
import { createStubProvider } from "@/lib/providers/stub";
import { looksRelative, relativeReply } from "./relative";
import { answeredWithoutModel, runTextIntent } from "./text-flow";

function start(...actions: unknown[]): GarmentSpec {
  const made = createSpec("team-jersey", "men");
  if (!made.ok) throw new Error(made.reason);
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, made.spec);
}

const sleeve = (value: number) => ({ type: "set-measurement", pointId: "sleeve-length", value, provenance: "user-edited" });

describe("a length made longer or shorter by an amount the person tapped or typed", () => {
  it("moves the value there is by the amount, read without a model", () => {
    expect(relativeReply("Make the sleeve length 2 cm longer", start(sleeve(2200)))).toEqual({
      kind: "changes",
      actions: [{ type: "set-measurement", pointId: "sleeve-length", cm: 24 }],
    });
    expect(relativeReply("make the sleeve length 1.5 cm shorter.", start(sleeve(2200)))).toEqual({
      kind: "changes",
      actions: [{ type: "set-measurement", pointId: "sleeve-length", cm: 20.5 }],
    });
  });

  it("asks for a value first when there is none to move", () => {
    expect(relativeReply("Make the sleeve length 2 cm longer", start())).toEqual({
      kind: "changes",
      actions: [{ type: "ask-amount", pointId: "sleeve-length", direction: "longer" }],
    });
  });

  it("refuses to take away more than there is", () => {
    const reply = relativeReply("Make the sleeve length 30 cm shorter", start(sleeve(2200)));
    expect(reply).toEqual({ kind: "rejection", reason: "That would leave the sleeve length at nothing. Nothing was changed." });
  });

  it("says so when the design has no such length, still without a model", () => {
    const reply = relativeReply("Make the inseam 2 cm longer", start());
    expect(reply).toEqual({ kind: "rejection", reason: "This design has no measurement called inseam. Nothing was changed." });
  });

  it("leaves any other wording to the rules and the model", () => {
    expect(looksRelative("make the sleeves a bit longer")).toBe(false);
    expect(relativeReply("make the sleeves a bit longer", start(sleeve(2200)))).toBeNull();
    expect(looksRelative("Make the sleeve length 2 cm longer")).toBe(true);
  });

  it("costs nothing and is made through the same checks as any change", async () => {
    expect(answeredWithoutModel("Make the sleeve length 2 cm longer")).toBe(true);
    const model = createStubProvider([]);
    const result = await runTextIntent({ utterance: "Make the sleeve length 2 cm longer", spec: start(sleeve(2200)) }, { primary: model, retry: null });
    expect(result.answeredBy).toBe("rules");
    expect(result.outcome.kind).toBe("applied");
    if (result.outcome.kind !== "applied") return;
    expect(result.outcome.spec.measurements).toEqual([{ pointId: "sleeve-length", value: 2400, provenance: "ai-suggested" }]);
  });
});
