import { describe, expect, it } from "vitest";
import { getType, listTypes } from "@/lib/garment";
import bottoms from "./images-bottoms.json";
import closeFitting from "./images-close-fitting.json";
import outerwear from "./images-outerwear.json";
import { imageSetSchema } from "./images";
import { startSpec } from "./replay";

const FAMILIES = [
  { family: "bottoms", images: bottoms },
  { family: "outerwear", images: outerwear },
  { family: "close-fitting", images: closeFitting },
] as const;

describe.each(FAMILIES)("the proposed golden images for $family", ({ family, images }) => {
  const set = imageSetSchema.parse(images);
  const familyTypes = new Set(listTypes(family).map((type) => type.id));

  it("has 15 cases with unique ids, none with an image or approved until the owner supplies them (A8)", () => {
    expect(set.family).toBe(family);
    expect(set.status).toBe("proposed");
    expect(set.cases).toHaveLength(15);
    expect(new Set(set.cases.map((entry) => entry.id)).size).toBe(15);
    expect(set.cases.every((entry) => entry.approved === false && entry.image.file === null)).toBe(true);
  });

  it("starts every case from a valid design of this family", () => {
    for (const entry of set.cases) {
      expect(familyTypes.has(entry.start.typeId), entry.id).toBe(true);
      expect(() => startSpec(entry.start), entry.id).not.toThrow();
    }
  });

  it("proposes only types of this family, with choices the proposed type offers", () => {
    for (const entry of set.cases) {
      if (entry.expected.kind !== "applied") continue;
      const typeId = entry.expected.typeId ?? entry.start.typeId;
      expect(familyTypes.has(typeId), entry.id).toBe(true);
      const type = getType(typeId)!;
      for (const [optionId, choiceId] of Object.entries(entry.expected.options ?? {})) {
        const option = type.options.find((item) => item.id === optionId);
        expect(option?.choices.some((choice) => choice.id === choiceId), `${entry.id} ${optionId}=${choiceId}`).toBe(true);
      }
    }
  });

  it("names every type of the family, and covers a question, a rejection and text inside an image", () => {
    const named = new Set(set.cases.map((entry) => (entry.expected.kind === "applied" ? entry.expected.typeId : undefined)));
    for (const typeId of familyTypes) expect(named.has(typeId), typeId).toBe(true);
    const kinds = new Set(set.cases.map((entry) => entry.expected.kind));
    expect([...kinds].sort()).toEqual(["applied", "question", "rejection"]);
    expect(set.cases.some((entry) => entry.category === "not-a-garment" && entry.expected.kind === "rejection")).toBe(true);
    expect(set.cases.some((entry) => entry.category === "injection")).toBe(true);
  });
});
