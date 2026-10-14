import { describe, expect, it } from "vitest";
import { darken, hslOf, hueWord, lighten, mixHex, parseHex } from "./colour";

describe("colour helpers", () => {
  it("reads and mixes screen colours", () => {
    expect(parseHex("#ff8000")).toEqual([255, 128, 0]);
    expect(parseHex("nonsense")).toEqual([154, 163, 174]);
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(darken("#ffffff", 0.5)).toBe("#808080");
    expect(lighten("#000000", 1)).toBe("#ffffff");
  });

  it("names a colour by its hue", () => {
    const names: Record<string, string> = {
      "#000000": "black", "#ffffff": "white", "#808080": "grey", "#c8102e": "red", "#6b4226": "brown", "#f2711c": "orange", "#ffd400": "yellow",
      "#1e8c3a": "green", "#00807f": "teal", "#1f5fbf": "blue", "#5b2a86": "purple", "#f19cbb": "pink",
    };
    for (const [hex, word] of Object.entries(names)) expect(hueWord(hex), hex).toBe(word);
  });

  it("measures hue, saturation and lightness", () => {
    expect(hslOf("#ff0000")).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(hslOf("#0000ff").h).toBe(240);
    expect(hslOf("#00ff00").h).toBe(120);
    expect(hslOf("#555555").s).toBe(0);
    expect(hslOf("#ff8080").l).toBeGreaterThan(0.5);
  });
});
