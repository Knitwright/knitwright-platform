import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fixtureLabelInput, fixtureSubject, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { destinationLabel } from "./labels";
import { assertHandOffAllowed, handOffGate, whyNoHandOff } from "./review";

const classB = (humanAllowed: boolean | null) => fixtureSubject({ source: "order", moderation: { state: "clear", productionClass: "B", humanAllowed } });

describe("the gate before a run is handed off", () => {
  it("is ready for a Class A run with nothing against it, and carries no note", () => {
    const gate = handOffGate(fixtureSubject({ source: "order" }));
    expect(gate.status).toBe("ready");
    expect(gate.status === "ready" && gate.notes).toEqual([]);
    expect(whyNoHandOff(gate)).toBeNull();
  });

  it("carries the notes with a ready run rather than hiding them", () => {
    const gate = handOffGate(fixtureSubject({ source: "order", moderation: { state: "not_built", productionClass: "A", humanAllowed: null } }));
    expect(gate.status).toBe("ready");
    expect(gate.status === "ready" && gate.notes.map((note) => note.code)).toEqual(["moderation_not_built"]);
  });

  it("refuses a Class B run until a person has looked at the design", () => {
    const gate = handOffGate(classB(null));
    expect(gate.status).toBe("blocked");
    expect(whyNoHandOff(gate)).toContain("nobody has been asked yet");
    expect(gate.status === "blocked" && gate.findings.map((found) => found.code)).toEqual(["class_b_human_review_required"]);
  });

  it("refuses a Class B run waiting in the queue, and lets it go once allowed", () => {
    expect(handOffGate(classB(false)).status).toBe("blocked");
    expect(handOffGate(classB(true)).status).toBe("ready");
  });

  it("refuses for every other reason too: the whole checklist is the gate", () => {
    const gate = handOffGate(fixtureSubject({ source: "order", labels: [destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }))] }));
    expect(gate.status).toBe("blocked");
    expect(gate.status === "blocked" && gate.findings.map((found) => found.code)).toContain("care_symbols_missing");
  });

  it("hands back the whole checklist either way, so a screen can show every row", () => {
    expect(handOffGate(classB(null)).result.items).toHaveLength(10);
    expect(handOffGate(fixtureSubject({ source: "order" })).result.items).toHaveLength(10);
  });
});

describe("the guard at the act", () => {
  it("lets a run that may go through without a word", () => {
    expect(() => assertHandOffAllowed(classB(true))).not.toThrow();
  });

  it("throws, so a caller cannot forget to look", () => {
    expect(() => assertHandOffAllowed(classB(null))).toThrow(AppError);
    try {
      assertHandOffAllowed(classB(false));
      expect.unreachable("the hand-off should have been refused");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("conflict");
      expect((error as AppError).message).toContain("review queue");
    }
  });
});
