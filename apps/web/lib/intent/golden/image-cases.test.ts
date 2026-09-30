import { describe, expect, it } from "vitest";
import type { GoldenImageCase } from "./images";
import { allGoldenImageCases, toImageCase } from "./image-cases";

const described = (patch: Partial<GoldenImageCase> = {}): GoldenImageCase => ({
  id: "bottoms-image-01",
  category: "sketch",
  image: { describes: "Joggers from the front.", file: "joggers-front.png" },
  utterance: "",
  start: { typeId: "track-pants" },
  expected: { kind: "applied", typeId: "joggers", options: { "leg-finish": "rib-cuff" } },
  approved: false,
  ...patch,
});

describe("toImageCase", () => {
  it("turns a family case with an image into a case of the image harness", () => {
    expect(toImageCase(described())).toEqual({
      ok: true,
      entry: {
        id: "bottoms-image-01",
        file: "joggers-front.png",
        kind: "sketch",
        start: { typeId: "track-pants" },
        expected: { kind: "proposal", typeId: "joggers", options: { "leg-finish": "rib-cuff" } },
        approved: false,
      },
    });
  });

  it("reads every category that is not a sketch as a photo, and keeps the start type when none is named", () => {
    const made = toImageCase(described({ category: "worn-photo", expected: { kind: "applied", options: { fit: "slim" } } }));
    expect(made).toMatchObject({ ok: true, entry: { kind: "photo", expected: { kind: "proposal", typeId: "track-pants" } } });
  });

  it("keeps a rejection a rejection", () => {
    expect(toImageCase(described({ expected: { kind: "rejection" } }))).toMatchObject({ ok: true, entry: { expected: { kind: "rejection" } } });
  });

  it("skips, with the reason, a case with no image yet, words sent with it, or a question expected", () => {
    expect(toImageCase(described({ image: { describes: "x", file: null } }))).toEqual({ ok: false, id: "bottoms-image-01", reason: "No image yet (owner action A8)." });
    expect(toImageCase(described({ utterance: "make these slim" }))).toMatchObject({ ok: false, reason: expect.stringMatching(/words/) });
    expect(toImageCase(described({ expected: { kind: "question" } }))).toMatchObject({ ok: false, reason: expect.stringMatching(/question/) });
  });
});

describe("allGoldenImageCases", () => {
  it("gathers tops and every other family, and today skips every family case for want of images", () => {
    const { cases, skipped } = allGoldenImageCases();
    expect(cases).toEqual([]);
    expect(skipped).toHaveLength(45);
    expect(new Set(skipped.map((entry) => entry.id)).size).toBe(45);
  });
});
