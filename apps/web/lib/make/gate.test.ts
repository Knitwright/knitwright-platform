import { describe, expect, it } from "vitest";
import { runGate, whyNoRun, type SignedOffSample } from "./gate";
import type { ChangedField } from "./surface";

const sample = (over: Partial<SignedOffSample> = {}): SignedOffSample => ({
  id: "gs-1",
  designVersion: 3,
  state: "approved",
  approvedAt: "2026-11-01T10:00:00.000Z",
  changedSince: null,
  ...over,
});

const surface: readonly ChangedField[] = [{ field: "artwork", group: "surface" }];
const structural: readonly ChangedField[] = [{ field: "artwork", group: "surface" }, { field: "fabrics", group: "structural" }];

describe("a run with no golden sample", () => {
  it("is blocked, and says what to do", () => {
    const gate = runGate(3, []);
    expect(gate.status).toBe("blocked");
    expect(whyNoRun(gate)).toContain("Order a sample");
    expect(gate.status === "blocked" && gate.finding.ruleId).toBe("R-GAP-000");
  });

  it("is blocked while the golden sample is only being judged or had changes asked for", () => {
    expect(runGate(3, [sample({ state: "draft", approvedAt: null })]).status).toBe("blocked");
    expect(runGate(3, [sample({ state: "changes_requested", approvedAt: null })]).status).toBe("blocked");
  });

  it("is blocked when a row says it is signed off but holds no date", () => {
    expect(runGate(3, [sample({ approvedAt: null })]).status).toBe("blocked");
  });
});

describe("a run of the version that was judged", () => {
  it("goes, with no note and no carry-over", () => {
    const gate = runGate(3, [sample()]);
    expect(gate).toEqual({ status: "ready", goldenSampleId: "gs-1", fromVersion: 3, carriedOver: false, changed: [], notes: [] });
  });

  it("prefers the sign-off of the version being made over a parent's", () => {
    const gate = runGate(3, [sample({ id: "parent", designVersion: 2, changedSince: surface }), sample({ id: "exact" })]);
    expect(gate.status === "ready" && gate.goldenSampleId).toBe("exact");
  });
});

describe("a run of a version that differs only on the surface", () => {
  it("goes on the parent's sign-off, with the note about its colour readings", () => {
    const gate = runGate(4, [sample({ id: "parent", designVersion: 3, changedSince: surface })]);
    expect(gate.status).toBe("ready");
    expect(gate.status === "ready" && gate.carriedOver).toBe(true);
    expect(gate.status === "ready" && gate.fromVersion).toBe(3);
    expect(gate.status === "ready" && gate.notes[0]?.message).toContain("colour readings");
    expect(gate.status === "ready" && gate.notes[0]?.code).toBe("golden_sample_carried_over");
    expect(gate.status === "ready" && gate.changed).toEqual(surface);
  });

  it("takes the one signed off most recently when two cover the same version", () => {
    const gate = runGate(4, [
      sample({ id: "older", designVersion: 3, approvedAt: "2026-11-01T10:00:00.000Z", changedSince: surface }),
      sample({ id: "newest", designVersion: 3, approvedAt: "2026-11-05T10:00:00.000Z", changedSince: surface }),
    ]);
    expect(gate.status === "ready" && gate.goldenSampleId).toBe("newest");
  });

  it("takes the newest parent that differs only on the surface", () => {
    const gate = runGate(9, [
      sample({ id: "older", designVersion: 2, changedSince: surface }),
      sample({ id: "newer", designVersion: 7, changedSince: surface }),
    ]);
    expect(gate.status === "ready" && gate.goldenSampleId).toBe("newer");
  });
});

describe("a run of a version that differs structurally", () => {
  it("is blocked and names the structural fields", () => {
    const gate = runGate(4, [sample({ designVersion: 3, changedSince: structural })]);
    expect(gate.status).toBe("blocked");
    expect(whyNoRun(gate)).toContain("fabrics");
    expect(whyNoRun(gate)).not.toContain("artwork");
  });

  it("is blocked while nobody has compared the versions", () => {
    const gate = runGate(4, [sample({ designVersion: 3, changedSince: null })]);
    expect(gate.status).toBe("blocked");
    expect(whyNoRun(gate)).toContain("version 4");
  });

  it("is blocked when the parent's version is the same but was recorded as unchanged", () => {
    expect(runGate(4, [sample({ designVersion: 3, changedSince: [] })]).status).toBe("blocked");
  });

  it("says nothing is wrong when the gate is open", () => {
    expect(whyNoRun(runGate(3, [sample()]))).toBeNull();
  });
});
