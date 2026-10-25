import { describe, expect, it } from "vitest";
import { trapTarget } from "./focus-trap";

describe("trapTarget", () => {
  it("lets the browser move on inside the sheet", () => {
    expect(trapTarget(4, 1, false)).toBeNull();
    expect(trapTarget(4, 2, true)).toBeNull();
  });

  it("wraps from the last control to the first and from the first to the last", () => {
    expect(trapTarget(4, 3, false)).toBe(0);
    expect(trapTarget(4, 0, true)).toBe(3);
  });

  it("brings focus that is outside the sheet back in", () => {
    expect(trapTarget(4, -1, false)).toBe(0);
    expect(trapTarget(4, -1, true)).toBe(3);
  });

  it("does nothing for a sheet with no controls", () => {
    expect(trapTarget(0, -1, false)).toBeNull();
  });

  it("keeps a sheet with one control on that control", () => {
    expect(trapTarget(1, 0, false)).toBe(0);
    expect(trapTarget(1, 0, true)).toBe(0);
  });
});
