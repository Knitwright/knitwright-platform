import { getType, listTypes } from "@/lib/garment";
import { describe, expect, it } from "vitest";
import { pointsAlwaysApplying, pointsThatCanApply } from "./applicable-points";

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

  it("gives every top at least the points every top has", () => {
    for (const type of listTypes("tops")) {
      expect(pointsThatCanApply(type).length).toBeGreaterThanOrEqual(11);
    }
  });

  it("gives every type of every family some points, all of them its own", () => {
    for (const type of listTypes()) {
      const ids = pointsThatCanApply(type).map((point) => point.id);
      expect(ids.length, type.id).toBeGreaterThanOrEqual(8);
      for (const id of ids) expect(type.pointsOfMeasure.some((point) => point.id === id)).toBe(true);
    }
  });

  it("leaves the knee out of shorts, which end above it", () => {
    expect(idsFor("shorts")).not.toContain("knee");
    expect(idsFor("joggers")).toContain("knee");
  });
});

describe("pointsAlwaysApplying", () => {
  const always = (typeId: string): readonly string[] => {
    const type = getType(typeId);
    if (!type) throw new Error(`Missing type ${typeId}.`);
    return pointsAlwaysApplying(type).map((point) => point.id);
  };

  it("keeps every point of a tee, since none of them depends on a choice the tee offers", () => {
    expect(always("crew-tee")).toEqual(idsFor("crew-tee"));
  });

  it("keeps the collar and placket of a polo, which every polo has", () => {
    expect(always("polo")).toEqual(expect.arrayContaining(["collar-height", "placket-length", "placket-width"]));
  });

  it("leaves out points a jersey has only with some choices", () => {
    const ids = always("team-jersey");
    expect(ids).toContain("chest-width");
    expect(ids).not.toContain("shoulder-width");
    expect(ids).not.toContain("collar-height");
    expect(ids).not.toContain("placket-length");
  });
});
