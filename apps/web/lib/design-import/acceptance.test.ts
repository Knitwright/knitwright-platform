import { describe, expect, it } from "vitest";

/**
 * Cases (a) and (b) of the plan's W7d acceptance read an all-over pattern. They need W7b's `findRepeat` and W7c's
 * generator registry, so they wait for phase B. They are listed here so they are not forgotten.
 */
describe("W7d acceptance, phase B", () => {
  it.skip("(a) a front and back polka-dot flat gives the dots generator within a stated parameter error and a repeat within 10 % of the truth (needs W7b findRepeat and W7c registry)", () => {
    expect(true).toBe(true);
  });

  it.skip("(b) a camo all-over flat gives an image-fill tile, or camo when the fit is close, and the report says which (needs W7b findRepeat and W7c registry)", () => {
    expect(true).toBe(true);
  });
});
