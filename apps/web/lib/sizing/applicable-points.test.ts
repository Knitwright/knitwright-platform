import { getType, listTypes } from "@/lib/garment";
import { describe, expect, it } from "vitest";
import { pointsThatCanApply } from "./applicable-points";

const idsFor = (typeId: string): readonly string[] => {
  const type = getType(typeId);
  if (!type) throw new Error(`Missing type ${typeId}.`);
  return pointsThatCanApply(type).map((point) => point.id);
};

describe("pointsThatCanApply", () => {
  it("leaves out collar and placket points for a tee, which has neither", () => {
    const ids = idsFor("crew-tee");
    expect(ids).toContain("chest-width");
    expect(ids).toContain("shoulder-width");
    expect(ids).not.toContain("collar-height");
    expect(ids).not.toContain("placket-length");
    expect(ids).not.toContain("placket-width");
  });

  it("keeps collar and placket points for a polo", () => {
    const ids = idsFor("polo");
    expect(ids).toContain("collar-height");
    expect(ids).toContain("placket-length");
    expect(ids).toContain("placket-width");
  });

  it("gives every type at least the points every top has", () => {
    for (const type of listTypes()) {
      expect(pointsThatCanApply(type).length).toBeGreaterThanOrEqual(11);
    }
  });
});
