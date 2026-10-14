import { describe, expect, it } from "vitest";
import { STAND_IN_MAPPER, STAND_IN_TEMPLATE, mapperFromPattern, templateFromPattern } from "./template";
import { TEE_EU48 } from "@/lib/production/fixtures";

describe("the stand-in template", () => {
  const front = STAND_IN_TEMPLATE.landmarks("front");
  const back = STAND_IN_TEMPLATE.landmarks("back");

  it("stands the rotated benchmark piece upright, in measured millimetres", () => {
    expect(front["cf-neck"]).toEqual({ x: 0, y: 0 });
    expect(front["cf-hem"]?.x).toBeCloseTo(0, 0);
    expect(front["cf-hem"]?.y).toBeCloseTo(589.63, 1);
    expect(front["side-hem"]?.x).toBeCloseTo(259.32, 1);
    expect(front.underarm?.y).toBeCloseTo(129.07, 0);
    expect(front.hps?.y).toBeLessThan(front.underarm?.y ?? 0);
  });

  it("does the same for the back with its own names", () => {
    expect(back["cb-neck"]).toEqual({ x: 0, y: 0 });
    expect(back["cb-hem"]?.y).toBeGreaterThan(500);
    expect(back["cf-neck"]).toBeUndefined();
  });

  it("has nothing for a sleeve or a collar, which are not fitted in this version", () => {
    expect(STAND_IN_TEMPLATE.landmarks("sleeve-left")).toEqual({});
    expect(STAND_IN_TEMPLATE.landmarks("collar")).toEqual({});
  });

  it("has nothing for a size the pattern does not hold", () => {
    expect(templateFromPattern(TEE_EU48, "99", "x").landmarks("front")).toEqual({});
  });
});

describe("the stand-in mapper", () => {
  it("puts a point on the piece and mirrors the half that is cut on the fold", () => {
    const hit = STAND_IN_MAPPER.toPiece("front", { x: 50, y: 300 }, "48");
    expect(hit?.pieceId).toBe("front");
    expect(STAND_IN_MAPPER.toPiece("front", { x: -50, y: 300 }, "48")).toEqual(hit);
  });

  it("gives null off the piece, for other sizes, and for views it does not fit", () => {
    expect(STAND_IN_MAPPER.toPiece("front", { x: 900, y: 300 }, "48")).toBeNull();
    expect(STAND_IN_MAPPER.toPiece("front", { x: 50, y: 300 }, "52")).toBeNull();
    expect(STAND_IN_MAPPER.toPiece("collar", { x: 0, y: 0 }, "48")).toBeNull();
  });

  it("maps the neck point to the piece's own neck point", () => {
    const hit = mapperFromPattern(TEE_EU48).toPiece("front", { x: 0.01, y: 0.01 }, "48");
    expect(hit?.xMm).toBeCloseTo(114.73, 0);
  });
});
