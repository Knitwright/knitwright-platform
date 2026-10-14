import { describe, expect, it } from "vitest";
import { downloadAddress, pieceFrame, pointsText, zoneWords } from "./ui";

describe("print panel helpers", () => {
  it("builds a download address from a choice", () => {
    expect(downloadAddress("abc", { sizes: ["48", "50"], formats: ["pdf", "svg"] })).toBe("/api/projects/abc/print-files?sizes=48%2C50&format=pdf%2Csvg");
    expect(downloadAddress("abc", { sizes: [], formats: [], colourway: "away", guides: false })).toBe("/api/projects/abc/print-files?format=pdf&colourway=away&guides=off");
  });
  it("frames a piece with the y axis turned up the page", () => {
    const f = pieceFrame([[0, 0], [100, 0], [100, 50], [0, 50]], 5);
    expect(f.viewBox).toBe("-5 -55 110 60");
    expect(pointsText([[1, 2], [3.456, -4]])).toBe("1,-2 3.46,4");
  });
  it("names zones in plain words", () => {
    expect(zoneWords("back-name")).toBe("Name");
    expect(zoneWords("something-new")).toBe("something new");
  });
});
