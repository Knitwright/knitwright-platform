import { describe, expect, it } from "vitest";
import { fabricFor, NO_FABRIC, UNKNOWN_FABRIC } from "./fabric";

describe("the fabric a channel's orders are made in (decision 0155)", () => {
  it("is a listed fabric, the first by default, or the brand's own where none is listed", () => {
    expect(fabricFor(["mesh", "interlock"], null)).toBe("mesh");
    expect(fabricFor(["mesh", "interlock"], " interlock ")).toBe("interlock");
    expect(() => fabricFor(["mesh"], "silk")).toThrow(UNKNOWN_FABRIC);
    expect(fabricFor([], "mesh-140")).toBe("mesh-140");
    expect(() => fabricFor([], " ")).toThrow(NO_FABRIC);
    expect(() => fabricFor([], null)).toThrow(NO_FABRIC);
  });
});
