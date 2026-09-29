import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isNeverSilent } from "../outcome";
import golden from "./tops.json";
import recorded from "./replay-tops.synthetic.json";
import { goldenSetSchema, recordingSchema, replayCase, scoreCase, startSpec, summarise } from "./replay";

const set = goldenSetSchema.parse(golden);
const recording = recordingSchema.parse(recorded);

describe("the golden set for tops", () => {
  it("has at least 150 cases with unique ids, none approved until the owner approves them (A7)", () => {
    expect(set.cases.length).toBeGreaterThanOrEqual(150);
    expect(new Set(set.cases.map((entry) => entry.id)).size).toBe(set.cases.length);
    expect(set.cases.every((entry) => entry.approved === false)).toBe(true);
    expect(set.status).toBe("proposed");
  });

  it("covers every outcome kind, and scores options as well as garment type", () => {
    const kinds = new Set(set.cases.map((entry) => entry.expected.kind));
    expect([...kinds].sort()).toEqual(["applied", "question", "rejection"]);
    expect(set.cases.some((entry) => entry.expected.kind === "applied" && entry.expected.typeId)).toBe(true);
    expect(set.cases.some((entry) => entry.expected.kind === "applied" && entry.expected.options)).toBe(true);
  });

  it("starts every case from a valid design", () => {
    for (const entry of set.cases) expect(() => startSpec(entry.start)).not.toThrow();
  });
});

describe("replaying recorded model replies", () => {
  it("is marked as synthetic, and has a reply for every case", () => {
    expect(recording.synthetic).toBe(true);
    expect(recording.source).toMatch(/NOT recorded from any real model/);
    for (const entry of set.cases) expect(Object.hasOwn(recording.responses, entry.id)).toBe(true);
  });

  it("is never silent on 100% of the golden set", () => {
    const outcomes = set.cases.map((entry) => replayCase(entry, recording.responses[entry.id]));
    const silent = set.cases.filter((entry, index) => !isNeverSilent(outcomes[index])).map((entry) => entry.id);
    expect(silent).toEqual([]);
  });

  it("gets the proposed outcome, garment type and options on every case with the synthetic replies", () => {
    const scores = set.cases.map((entry) => scoreCase(entry, replayCase(entry, recording.responses[entry.id])));
    const wrong = scores.filter((score) => !score.correct).map((score) => `${score.id}: ${score.problems.join("; ")}`);
    expect(wrong).toEqual([]);
    const summary = summarise(scores);
    expect(summary).toMatchObject({ total: set.cases.length, neverSilent: set.cases.length, correct: set.cases.length });
    expect(summary.typeScored).toBeGreaterThan(0);
    expect(summary.optionsScored).toBeGreaterThan(0);
  });

  it("is never silent on faulty replies either, and gives the outcome each fault should", () => {
    for (const fault of recording.faults) {
      const outcome = replayCase({ id: fault.id, utterance: fault.utterance, start: fault.start }, fault.response);
      expect(isNeverSilent(outcome), fault.id).toBe(true);
      expect(outcome.kind, fault.id).toBe(fault.expectedKind);
    }
  });
});

describe("scoring one case", () => {
  const entry = set.cases.find((item) => item.expected.kind === "applied" && item.expected.options)!;

  it("counts a wrong kind, and names what is wrong", () => {
    const score = scoreCase(entry, { kind: "rejection", reason: "No." });
    expect(score.correct).toBe(false);
    expect(score.problems[0]).toMatch(/expected applied, got rejection/);
  });

  it("counts a wrong option, type, wearer, measurement, colour, fabric field or label", () => {
    const outcome = replayCase(entry, recording.responses[entry.id]);
    if (outcome.kind !== "applied") throw new Error("expected applied");
    const wrong = {
      ...entry,
      expected: {
        kind: "applied" as const,
        typeId: "nope",
        wearer: "youth" as const,
        options: { fit: "nope" },
        measurementsCm: { "chest-width": 1 },
        colours: { "body-front": "pink" },
        fabric: { composition: "silk" },
        labelling: { care: "never" },
      },
    };
    const score = scoreCase(wrong, outcome);
    expect(score.correct).toBe(false);
    expect(score.problems).toHaveLength(7);
    expect(summarise([score])).toMatchObject({ total: 1, correct: 0, typeCorrect: 0, optionsCorrect: 0 });
  });
});

/** Replies recorded from real models by scripts/eval-text.mts. None exist until provider keys do (A3). */
const HERE = dirname(fileURLToPath(import.meta.url));
const RECORDED = readdirSync(HERE).filter((name) => /^replay-tops\..+\.json$/.test(name) && name !== "replay-tops.synthetic.json");

describe.skipIf(RECORDED.length === 0)("replaying replies recorded from real models", () => {
  it.each(RECORDED)("%s is never silent on 100% of the golden set", (name) => {
    const live = recordingSchema.parse(JSON.parse(readFileSync(join(HERE, name), "utf8")));
    expect(live.synthetic).toBe(false);
    const silent = set.cases.filter((entry) => !isNeverSilent(replayCase(entry, live.responses[entry.id]))).map((entry) => entry.id);
    expect(silent).toEqual([]);
  });
});
