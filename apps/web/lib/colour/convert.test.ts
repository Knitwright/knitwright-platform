import { describe, expect, it } from "vitest";
import { toLab } from "@/lib/print/rules/colour";
import { fromLch, labToHex, toLch } from "./convert";

/** The way back from Lab, against the forward transform the print checks already use. */

const ROUND_TRIP = ["#000000", "#ffffff", "#808080", "#0b1f4b", "#1b2a49", "#c8102e", "#00843d", "#ffd100"];

describe("labToHex", () => {
  it("returns every sRGB colour it was given, to the byte", () => {
    for (const hex of ROUND_TRIP) expect(labToHex(toLab(hex))).toBe(hex);
  });

  it("gives white for L 100 and black for L 0", () => {
    expect(labToHex([100, 0, 0])).toBe("#ffffff");
    expect(labToHex([0, 0, 0])).toBe("#000000");
  });

  it("clips a Lab colour no screen can show instead of returning nonsense", () => {
    const hex = labToHex([50, 200, -200]);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(hex).toBe("#ae00ff");
  });

  it("agrees with the package's own figure for #0B1F4B (owner decision 15)", () => {
    const [l, a, b] = toLab("#0b1f4b");
    expect([Math.round(l), Math.round(a * 10) / 10, Math.round(b * 10) / 10]).toEqual([13, 10.7, -29.6]);
  });
});

describe("toLch and fromLch", () => {
  it("reads a red as a high chroma near hue 40 and goes back to it", () => {
    const { l, c, h } = toLch("#c8102e");
    expect(c).toBeGreaterThan(60);
    expect(h).toBeGreaterThan(20);
    expect(h).toBeLessThan(45);
    expect(labToHex(fromLch(l, c, h))).toBe("#c8102e");
  });

  it("gives a grey no hue it can act on: chroma 0 is grey whatever the hue", () => {
    expect(labToHex(fromLch(50, 0, 0))).toBe(labToHex(fromLch(50, 0, 270)));
  });
});
