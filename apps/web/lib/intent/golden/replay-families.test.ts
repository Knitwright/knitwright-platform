import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { isNeverSilent } from "../outcome";
import bottoms from "./bottoms.json";
import closeFitting from "./close-fitting.json";
import outerwear from "./outerwear.json";
import recordedBottoms from "./replay-bottoms.synthetic.json";
import recordedCloseFitting from "./replay-close-fitting.synthetic.json";
import recordedOuterwear from "./replay-outerwear.synthetic.json";
import { goldenSetSchema, recordingSchema, replayCase, scoreCase, startSpec, summarise } from "./replay";

/** The golden sets of the families built after tops (steps 18, 21 and 24). */
const FAMILIES = [
  { family: "bottoms", golden: bottoms, recorded: recordedBottoms },
  { family: "outerwear", golden: outerwear, recorded: recordedOuterwear },
  { family: "close-fitting", golden: closeFitting, recorded: recordedCloseFitting },
] as const;

describe.each(FAMILIES)("the golden set for $family", ({ family, golden, recorded }) => {
  const set = goldenSetSchema.parse(golden);
  const recording = recordingSchema.parse(recorded);
  const familyTypes = new Set(listTypes(family).map((type) => type.id));

  it("has at least 50 cases with unique ids, none approved until the owner approves them (A7)", () => {
    expect(set.family).toBe(family);
    expect(set.cases.length).toBeGreaterThanOrEqual(50);
    expect(new Set(set.cases.map((entry) => entry.id)).size).toBe(set.cases.length);
    expect(set.cases.every((entry) => entry.approved === false)).toBe(true);
    expect(set.status).toBe("proposed");
  });

  it("starts every case from a valid design of this family, and names every type of the family", () => {
    for (const entry of set.cases) {
      expect(familyTypes.has(entry.start.typeId), entry.id).toBe(true);
      expect(() => startSpec(entry.start), entry.id).not.toThrow();
    }
    const named = new Set(set.cases.flatMap((entry) => [entry.start.typeId, entry.expected.kind === "applied" ? entry.expected.typeId : undefined]));
    for (const typeId of familyTypes) expect(named.has(typeId), typeId).toBe(true);
  });

  it("covers every outcome kind, and scores options as well as garment type", () => {
    const kinds = new Set(set.cases.map((entry) => entry.expected.kind));
    expect([...kinds].sort()).toEqual(["applied", "question", "rejection"]);
    expect(set.cases.some((entry) => entry.expected.kind === "applied" && entry.expected.typeId)).toBe(true);
    expect(set.cases.some((entry) => entry.expected.kind === "applied" && entry.expected.options)).toBe(true);
  });

  it("has a synthetic reply for every case, marked as not recorded from a model", () => {
    expect(recording.synthetic).toBe(true);
    expect(recording.source).toMatch(/NOT recorded from any real model/);
    for (const entry of set.cases) expect(Object.hasOwn(recording.responses, entry.id), entry.id).toBe(true);
  });

  it("is never silent on 100% of the set, and gets the proposed outcome on every case", () => {
    const scores = set.cases.map((entry) => scoreCase(entry, replayCase(entry, recording.responses[entry.id])));
    expect(scores.filter((score) => !score.neverSilent).map((score) => score.id)).toEqual([]);
    const wrong = scores.filter((score) => !score.correct).map((score) => `${score.id}: ${score.problems.join("; ")}`);
    expect(wrong).toEqual([]);
    expect(summarise(scores)).toMatchObject({ total: set.cases.length, neverSilent: set.cases.length, correct: set.cases.length });
  });

  it("is never silent on faulty replies either, and gives the outcome each fault should", () => {
    expect(recording.faults.length).toBeGreaterThan(0);
    for (const fault of recording.faults) {
      const outcome = replayCase({ id: fault.id, utterance: fault.utterance, start: fault.start }, fault.response);
      expect(isNeverSilent(outcome), fault.id).toBe(true);
      expect(outcome.kind, fault.id).toBe(fault.expectedKind);
    }
  });
});
