import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "./images/images.json";
import {
  imageRecordingSchema,
  imageSetSchema,
  replayImageCase,
  scoreImageCase,
  summariseImages,
  type ImageCase,
} from "./image-replay";

const set = imageSetSchema.parse(manifest);

describe("the golden image set", () => {
  it("is empty and unapproved until the owner supplies and approves images (A8, A7)", () => {
    expect(set.status).toBe("proposed");
    expect(set.cases.every((entry) => entry.approved === false)).toBe(true);
    for (const entry of set.cases) expect(readdirSync(join(dirname(fileURLToPath(import.meta.url)), "images"))).toContain(entry.file);
  });

  it("refuses a case whose file name could reach outside the folder", () => {
    const bad = { ...set, cases: [{ id: "x", file: "../secret.png", kind: "photo", start: { typeId: "crew-tee" }, expected: { kind: "rejection" }, approved: false }] };
    expect(imageSetSchema.safeParse(bad).success).toBe(false);
  });
});

const cases: ImageCase[] = [
  { id: "img-polo", file: "polo.png", kind: "sketch", start: { typeId: "crew-tee" }, expected: { kind: "proposal", typeId: "polo", options: { fit: "slim" } }, approved: false },
  { id: "img-dog", file: "dog.jpg", kind: "photo", start: { typeId: "crew-tee" }, expected: { kind: "rejection" }, approved: false },
];

describe("the image replay harness (stubbed replies)", () => {
  it("scores garment type and options beside each other, and rejections of non-garments", () => {
    const polo = JSON.stringify({ kind: "changes", actions: [{ type: "change-type", typeId: "polo" }, { type: "set-option", optionId: "fit", choiceId: "slim" }] });
    const dog = JSON.stringify({ kind: "rejection", reason: "The picture shows a dog, not a garment." });
    const scores = [scoreImageCase(cases[0], replayImageCase(cases[0], polo)), scoreImageCase(cases[1], replayImageCase(cases[1], dog))];
    expect(scores).toEqual([
      { id: "img-polo", kindCorrect: true, typeCorrect: true, optionsCorrect: true },
      { id: "img-dog", kindCorrect: true, typeCorrect: null, optionsCorrect: null },
    ]);
    expect(summariseImages(scores)).toEqual({ total: 2, kindCorrect: 2, typeScored: 1, typeCorrect: 1, optionsScored: 1, optionsCorrect: 1 });
  });

  it("counts a wrong type, a wrong option and a missing reply as wrong", () => {
    const tee = JSON.stringify({ kind: "changes", actions: [{ type: "set-option", optionId: "fit", choiceId: "relaxed" }] });
    expect(scoreImageCase(cases[0], replayImageCase(cases[0], tee))).toEqual({ id: "img-polo", kindCorrect: true, typeCorrect: false, optionsCorrect: false });
    expect(scoreImageCase(cases[0], replayImageCase(cases[0], undefined))).toEqual({ id: "img-polo", kindCorrect: false, typeCorrect: false, optionsCorrect: false });
    expect(scoreImageCase(cases[1], replayImageCase(cases[1], tee)).kindCorrect).toBe(false);
  });
});

const HERE = join(dirname(fileURLToPath(import.meta.url)), "images");
const RECORDED = readdirSync(HERE).filter((name) => /^replay-images\..+\.json$/.test(name));

describe.skipIf(RECORDED.length === 0)("replaying image readings recorded from real models", () => {
  it.each(RECORDED)("%s gives every golden image a proposal or an explained rejection", (name) => {
    const recording = imageRecordingSchema.parse(JSON.parse(readFileSync(join(HERE, name), "utf8")));
    for (const entry of set.cases) {
      const outcome = replayImageCase(entry, recording.responses[entry.id]);
      expect(outcome.kind === "proposal" ? outcome.explanations.length > 0 : outcome.reason.trim() !== "").toBe(true);
    }
  });
});
